import { query, queryOne, withTransaction, type Queryable } from '../../db/pool.js'
import { AppError } from '../../lib/errors.js'
import { isPgError } from '../../lib/pg.js'
import { formatClock, parseDay } from '../../lib/time.js'
import { config } from '../../config.js'

type SpecialistRow = {
  id: string
  name: string
  bio: string
  is_active: boolean
  service_ids: string[] | null
}

type HourRow = {
  weekday: number
  start_minute: number
  end_minute: number
}

export type SpecialistDto = {
  id: string
  name: string
  bio: string
  isActive: boolean
  serviceIds: string[]
}

export type HourDto = {
  weekday: number
  startTime: string
  endTime: string
}

export type SpecialistDetail = SpecialistDto & {
  hours: HourDto[]
  daysOff: string[]
}

export type SpecialistInput = {
  name: string
  bio: string
  isActive: boolean
}

export type HourInput = {
  weekday: number
  startMinute: number
  endMinute: number
}

function mapSpecialist(row: SpecialistRow): SpecialistDto {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    isActive: row.is_active,
    serviceIds: row.service_ids ?? [],
  }
}

const SPECIALIST_SELECT = `
  SELECT s.id, s.name, s.bio, s.is_active,
         COALESCE(array_agg(ss.service_id) FILTER (WHERE ss.service_id IS NOT NULL), '{}') AS service_ids
  FROM specialists s
  LEFT JOIN specialist_services ss ON ss.specialist_id = s.id
`

async function loadDetail(id: string, db?: Queryable): Promise<SpecialistDetail> {
  const row = await queryOne<SpecialistRow>(
    `${SPECIALIST_SELECT} WHERE s.id = $1 GROUP BY s.id`,
    [id],
    db,
  )
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден')
  const hours = await query<HourRow>(
    `SELECT weekday, start_minute, end_minute FROM weekly_hours WHERE specialist_id = $1 ORDER BY weekday`,
    [id],
    db,
  )
  const days = await query<{ day: string }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day FROM days_off WHERE specialist_id = $1 ORDER BY day`,
    [id],
    db,
  )
  return {
    ...mapSpecialist(row),
    hours: hours.map((hour) => ({
      weekday: hour.weekday,
      startTime: formatClock(hour.start_minute),
      endTime: formatClock(hour.end_minute),
    })),
    daysOff: days.map((day) => day.day),
  }
}

export async function listSpecialists(input: { serviceId?: string; includeInactive: boolean }): Promise<SpecialistDto[]> {
  const rows = await query<SpecialistRow>(
    `${SPECIALIST_SELECT}
     WHERE ($1::uuid IS NULL OR EXISTS (
       SELECT 1 FROM specialist_services link
       WHERE link.specialist_id = s.id AND link.service_id = $1
     ))
     AND ($2::boolean = true OR s.is_active = true)
     GROUP BY s.id
     ORDER BY s.name`,
    [input.serviceId ?? null, input.includeInactive],
  )
  return rows.map(mapSpecialist)
}

export async function getSpecialist(id: string, includeInactive: boolean): Promise<SpecialistDetail> {
  const detail = await loadDetail(id)
  if (!detail.isActive && !includeInactive) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден')
  return detail
}

export async function createSpecialist(input: SpecialistInput): Promise<SpecialistDetail> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO specialists (name, bio, is_active) VALUES ($1, $2, $3) RETURNING id`,
    [input.name, input.bio, input.isActive],
  )
  if (!row) throw new AppError(500, 'INTERNAL', 'Внутренняя ошибка')
  return loadDetail(row.id)
}

export async function updateSpecialist(id: string, input: SpecialistInput): Promise<SpecialistDetail> {
  const row = await queryOne<{ id: string }>(
    `UPDATE specialists SET name = $2, bio = $3, is_active = $4, updated_at = now() WHERE id = $1 RETURNING id`,
    [id, input.name, input.bio, input.isActive],
  )
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден')
  return loadDetail(id)
}

export async function replaceServices(id: string, serviceIds: string[]): Promise<SpecialistDetail> {
  const uniqueIds = [...new Set(serviceIds)]
  return withTransaction(async (client) => {
    const specialist = await queryOne<{ id: string }>(`SELECT id FROM specialists WHERE id = $1`, [id], client)
    if (!specialist) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден')
    if (uniqueIds.length > 0) {
      const found = await query<{ id: string }>(
        `SELECT id FROM services WHERE id = ANY($1::uuid[])`,
        [uniqueIds],
        client,
      )
      if (found.length !== uniqueIds.length) throw new AppError(400, 'VALIDATION', 'Некоторые услуги не найдены')
    }
    await client.query(`DELETE FROM specialist_services WHERE specialist_id = $1`, [id])
    if (uniqueIds.length > 0) {
      const params: unknown[] = [id]
      const values = uniqueIds.map((serviceId, index) => {
        params.push(serviceId)
        return `($1, $${index + 2})`
      })
      await client.query(
        `INSERT INTO specialist_services (specialist_id, service_id) VALUES ${values.join(', ')}`,
        params,
      )
    }
    return loadDetail(id, client)
  })
}

export async function replaceHours(id: string, hours: HourInput[]): Promise<SpecialistDetail> {
  return withTransaction(async (client) => {
    const specialist = await queryOne<{ id: string }>(`SELECT id FROM specialists WHERE id = $1`, [id], client)
    if (!specialist) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден')
    await client.query(`DELETE FROM weekly_hours WHERE specialist_id = $1`, [id])
    if (hours.length > 0) {
      const params: unknown[] = [id]
      const values = hours.map((hour, index) => {
        const base = index * 3
        params.push(hour.weekday, hour.startMinute, hour.endMinute)
        return `($1, $${base + 2}, $${base + 3}, $${base + 4})`
      })
      await client.query(
        `INSERT INTO weekly_hours (specialist_id, weekday, start_minute, end_minute) VALUES ${values.join(', ')}`,
        params,
      )
    }
    return loadDetail(id, client)
  })
}

export async function addDayOff(id: string, day: string): Promise<SpecialistDetail> {
  const parsed = parseDay(day, config.timeZone)
  if (!parsed) throw new AppError(400, 'VALIDATION', 'Некорректная дата')
  try {
    return await withTransaction(async (client) => {
      const specialist = await queryOne<{ id: string }>(`SELECT id FROM specialists WHERE id = $1 FOR UPDATE`, [id], client)
      if (!specialist) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден')
      const start = parsed.startOf('day').toJSDate()
      const end = parsed.plus({ days: 1 }).startOf('day').toJSDate()
      const busy = await queryOne(
        `SELECT 1 FROM bookings
         WHERE specialist_id = $1 AND status = 'confirmed' AND starts_at < $3 AND ends_at > $2
         LIMIT 1`,
        [id, start, end],
        client,
      )
      if (busy) {
        throw new AppError(409, 'CONFLICT', 'В этот день есть записи. Сначала отмените их')
      }
      await client.query(`INSERT INTO days_off (specialist_id, day) VALUES ($1, $2::date)`, [id, day])
      return loadDetail(id, client)
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    if (isPgError(error) && error.code === '23505') {
      throw new AppError(409, 'CONFLICT', 'Этот день уже закрыт')
    }
    throw error
  }
}

export async function removeDayOff(id: string, day: string): Promise<void> {
  const parsed = parseDay(day, config.timeZone)
  if (!parsed) throw new AppError(400, 'VALIDATION', 'Некорректная дата')
  const removed = await queryOne(
    `DELETE FROM days_off WHERE specialist_id = $1 AND day = $2::date RETURNING id`,
    [id, day],
  )
  if (!removed) throw new AppError(404, 'NOT_FOUND', 'Выходной не найден')
}
