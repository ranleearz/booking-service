import { config } from '../../config.js'
import type { Queryable } from '../../db/pool.js'
import { query, queryOne } from '../../db/pool.js'
import { AppError } from '../../lib/errors.js'
import { asDate, parseDay } from '../../lib/time.js'
import { buildSlots, SLOT_LEAD_MINUTES, SLOT_STEP_MINUTES, type Slot } from './slot-engine.js'

type ServiceRow = {
  id: string
  duration_minutes: number
  is_active: boolean
}

type SpecialistRow = {
  id: string
  is_active: boolean
}

export async function findSlots(
  db: Queryable,
  input: { specialistId: string; serviceId: string; from: string; to: string; notBefore?: Date },
): Promise<Slot[]> {
  const fromDay = parseDay(input.from, config.timeZone)
  const toDay = parseDay(input.to, config.timeZone)
  if (!fromDay || !toDay) throw new AppError(400, 'VALIDATION', 'Некорректная дата')
  if (toDay.toMillis() < fromDay.toMillis()) {
    throw new AppError(400, 'VALIDATION', 'Конец периода раньше начала')
  }
  if (toDay.diff(fromDay, 'days').days > 30) {
    throw new AppError(400, 'VALIDATION', 'Период не длиннее 31 дня')
  }

  const service = await queryOne<ServiceRow>(
    `SELECT id, duration_minutes, is_active FROM services WHERE id = $1`,
    [input.serviceId],
    db,
  )
  if (!service || !service.is_active) throw new AppError(404, 'NOT_FOUND', 'Услуга не найдена')

  const specialist = await queryOne<SpecialistRow>(
    `SELECT id, is_active FROM specialists WHERE id = $1`,
    [input.specialistId],
    db,
  )
  if (!specialist || !specialist.is_active) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден')

  const link = await queryOne(
    `SELECT 1 FROM specialist_services WHERE specialist_id = $1 AND service_id = $2`,
    [input.specialistId, input.serviceId],
    db,
  )
  if (!link) throw new AppError(409, 'CONFLICT', 'Специалист не оказывает эту услугу')

  const weekly = await query<{ weekday: number; start_minute: number; end_minute: number }>(
    `SELECT weekday, start_minute, end_minute FROM weekly_hours WHERE specialist_id = $1`,
    [input.specialistId],
    db,
  )
  const daysOff = await query<{ day: string }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day
     FROM days_off
     WHERE specialist_id = $1 AND day >= $2::date AND day <= $3::date`,
    [input.specialistId, input.from, input.to],
    db,
  )
  const rangeStart = fromDay.startOf('day').toJSDate()
  const rangeEnd = toDay.endOf('day').toJSDate()
  const busy = await query<{ starts_at: Date | string; ends_at: Date | string }>(
    `SELECT starts_at, ends_at
     FROM bookings
     WHERE specialist_id = $1 AND status = 'confirmed' AND starts_at < $3 AND ends_at > $2`,
    [input.specialistId, rangeStart, rangeEnd],
    db,
  )

  return buildSlots({
    from: input.from,
    to: input.to,
    timeZone: config.timeZone,
    durationMinutes: service.duration_minutes,
    stepMinutes: SLOT_STEP_MINUTES,
    weekly: weekly.map((hour) => ({
      weekday: hour.weekday,
      startMinute: hour.start_minute,
      endMinute: hour.end_minute,
    })),
    daysOff: daysOff.map((day) => day.day),
    busy: busy.map((item) => ({ start: asDate(item.starts_at), end: asDate(item.ends_at) })),
    notBefore: input.notBefore ?? new Date(Date.now() + SLOT_LEAD_MINUTES * 60 * 1000),
  })
}
