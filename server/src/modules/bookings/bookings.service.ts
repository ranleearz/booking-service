import { DateTime } from 'luxon'
import { config } from '../../config.js'
import { query, queryOne, withTransaction, type Queryable } from '../../db/pool.js'
import { AppError } from '../../lib/errors.js'
import { isPgError } from '../../lib/pg.js'
import { asDate, asIso, formatSlotLabel, parseDay } from '../../lib/time.js'
import type { UserRole } from '../../lib/tokens.js'
import { createNotifications, listAdminIds } from '../notifications/notifications.service.js'
import { findSlots } from '../slots/slots.service.js'
import { canClientCancel } from './booking.policy.js'

type Viewer = { id: string; role: UserRole }

type BookingRow = {
  id: string
  client_id: string
  client_name: string
  specialist_id: string
  specialist_name: string
  service_id: string
  service_name: string
  duration_minutes: number
  price_cents: number
  starts_at: Date | string
  ends_at: Date | string
  status: 'confirmed' | 'cancelled'
  cancel_reason: string | null
  cancelled_at: Date | string | null
  created_at: Date | string
}

export type BookingDto = {
  id: string
  clientId: string
  clientName: string
  specialistId: string
  specialistName: string
  serviceId: string
  serviceName: string
  durationMinutes: number
  priceCents: number
  startsAt: string
  endsAt: string
  status: 'confirmed' | 'cancelled'
  cancelReason: string | null
  cancelledAt: string | null
  createdAt: string
  canCancel: boolean
}

export type BookingFilters = {
  clientId?: string
  specialistId?: string
  status?: 'confirmed' | 'cancelled'
  from?: string
  to?: string
  limit: number
  offset: number
}

const BOOKING_FROM = `
  FROM bookings b
  JOIN users u ON u.id = b.client_id
  JOIN specialists s ON s.id = b.specialist_id
  JOIN services sv ON sv.id = b.service_id
`

const BOOKING_SELECT = `
  SELECT
    b.id,
    b.client_id,
    u.name AS client_name,
    b.specialist_id,
    s.name AS specialist_name,
    b.service_id,
    sv.name AS service_name,
    sv.duration_minutes,
    sv.price_cents,
    b.starts_at,
    b.ends_at,
    b.status,
    b.cancel_reason,
    b.cancelled_at,
    b.created_at
  ${BOOKING_FROM}
`

function mapBooking(row: BookingRow, viewer: Viewer): BookingDto {
  const startsAt = asDate(row.starts_at)
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    specialistId: row.specialist_id,
    specialistName: row.specialist_name,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    startsAt: startsAt.toISOString(),
    endsAt: asIso(row.ends_at),
    status: row.status,
    cancelReason: row.cancel_reason,
    cancelledAt: row.cancelled_at ? asIso(row.cancelled_at) : null,
    createdAt: asIso(row.created_at),
    canCancel: canViewerCancel(row, viewer, startsAt),
  }
}

function canViewerCancel(row: BookingRow, viewer: Viewer, startsAt: Date): boolean {
  if (row.status !== 'confirmed') return false
  if (viewer.role === 'admin') return true
  if (row.client_id !== viewer.id) return false
  return canClientCancel(startsAt, new Date(), config.cancelBeforeHours)
}

function visitLabel(booking: Pick<BookingDto, 'serviceName' | 'specialistName' | 'startsAt'>): string {
  return `${booking.serviceName} у ${booking.specialistName}, ${formatSlotLabel(new Date(booking.startsAt), config.timeZone)}`
}

function withReason(text: string, reason: string | null): string {
  if (!reason) return text
  return `${text}. Причина: ${reason}`
}

async function getBooking(id: string, viewer: Viewer, db?: Queryable): Promise<BookingDto> {
  const row = await queryOne<BookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [id], db)
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Запись не найдена')
  return mapBooking(row, viewer)
}

function filtersOf(filters: BookingFilters) {
  const conditions: string[] = []
  const params: unknown[] = []
  const add = (sql: string, value: unknown) => {
    params.push(value)
    conditions.push(sql.replaceAll('?', `$${params.length}`))
  }
  if (filters.clientId) add('b.client_id = ?', filters.clientId)
  if (filters.specialistId) add('b.specialist_id = ?', filters.specialistId)
  if (filters.status) add('b.status = ?', filters.status)
  if (filters.from) {
    const day = parseDay(filters.from, config.timeZone)
    if (!day) throw new AppError(400, 'VALIDATION', 'Некорректная дата')
    add('b.starts_at >= ?', day.startOf('day').toJSDate())
  }
  if (filters.to) {
    const day = parseDay(filters.to, config.timeZone)
    if (!day) throw new AppError(400, 'VALIDATION', 'Некорректная дата')
    add('b.starts_at < ?', day.plus({ days: 1 }).startOf('day').toJSDate())
  }
  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export async function listBookings(filters: BookingFilters, viewer: Viewer) {
  if (filters.from && filters.to && filters.to < filters.from) {
    throw new AppError(400, 'VALIDATION', 'Конец периода раньше начала')
  }
  const { where, params } = filtersOf(filters)
  const totalRow = await queryOne<{ total: number }>(
    `SELECT count(*)::int AS total ${BOOKING_FROM} ${where}`,
    params,
  )
  const rows = await query<BookingRow>(
    `${BOOKING_SELECT} ${where} ORDER BY b.starts_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, filters.offset],
  )
  return {
    items: rows.map((row) => mapBooking(row, viewer)),
    total: totalRow?.total ?? 0,
  }
}

async function notifyCreated(db: Queryable, booking: BookingDto) {
  const admins = await listAdminIds(db)
  const visit = visitLabel(booking)
  await createNotifications(db, {
    userIds: [booking.clientId],
    type: 'booking_created',
    title: 'Запись подтверждена',
    body: visit,
    payload: { bookingId: booking.id },
  })
  await createNotifications(db, {
    userIds: admins,
    type: 'booking_created',
    title: 'Новая запись',
    body: `${booking.clientName}: ${visit}`,
    payload: { bookingId: booking.id },
  })
}

async function notifyCancelled(db: Queryable, booking: BookingDto, actorRole: UserRole) {
  const admins = await listAdminIds(db)
  const visit = visitLabel(booking)
  if (actorRole === 'admin') {
    await createNotifications(db, {
      userIds: [booking.clientId],
      type: 'booking_cancelled',
      title: 'Запись отменена',
      body: withReason(`Администратор отменил ${visit}`, booking.cancelReason),
      payload: { bookingId: booking.id },
    })
    await createNotifications(db, {
      userIds: admins,
      type: 'booking_cancelled',
      title: 'Запись отменена',
      body: withReason(`Отменена запись ${booking.clientName}: ${visit}`, booking.cancelReason),
      payload: { bookingId: booking.id },
    })
    return
  }
  await createNotifications(db, {
    userIds: [booking.clientId],
    type: 'booking_cancelled',
    title: 'Запись отменена',
    body: withReason(visit, booking.cancelReason),
    payload: { bookingId: booking.id },
  })
  await createNotifications(db, {
    userIds: admins,
    type: 'booking_cancelled',
    title: 'Клиент отменил запись',
    body: withReason(`${booking.clientName} отменил ${visit}`, booking.cancelReason),
    payload: { bookingId: booking.id },
  })
}

export async function createBooking(
  clientId: string,
  input: { specialistId: string; serviceId: string; startsAt: string },
): Promise<BookingDto> {
  const startsAt = new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) throw new AppError(400, 'VALIDATION', 'Некорректное время')
  const day = DateTime.fromJSDate(startsAt).setZone(config.timeZone).toISODate()
  if (!day) throw new AppError(400, 'VALIDATION', 'Некорректное время')
  const viewer: Viewer = { id: clientId, role: 'client' }
  try {
    return await withTransaction(async (client) => {
      const locked = await queryOne(`SELECT id FROM specialists WHERE id = $1 FOR UPDATE`, [input.specialistId], client)
      if (!locked) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден')
      const slots = await findSlots(client, {
        specialistId: input.specialistId,
        serviceId: input.serviceId,
        from: day,
        to: day,
      })
      const match = slots.find((slot) => slot.start.getTime() === startsAt.getTime())
      if (!match) throw new AppError(409, 'SLOT_UNAVAILABLE', 'Это время недоступно')
      const inserted = await queryOne<{ id: string }>(
        `INSERT INTO bookings (client_id, specialist_id, service_id, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [clientId, input.specialistId, input.serviceId, match.start, match.end],
        client,
      )
      if (!inserted) throw new AppError(500, 'INTERNAL', 'Внутренняя ошибка')
      const booking = await getBooking(inserted.id, viewer, client)
      await notifyCreated(client, booking)
      return booking
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    if (isPgError(error) && error.code === '23P01') {
      throw new AppError(409, 'SLOT_TAKEN', 'Это время уже занято')
    }
    throw error
  }
}

export async function cancelBooking(actor: Viewer, bookingId: string, reason?: string): Promise<BookingDto> {
  const trimmed = reason?.trim() ? reason.trim() : null
  return withTransaction(async (client) => {
    const row = await queryOne<BookingRow>(
      `${BOOKING_SELECT} WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId],
      client,
    )
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Запись не найдена')
    if (row.status === 'cancelled') throw new AppError(409, 'CONFLICT', 'Запись уже отменена')
    if (actor.role !== 'admin' && row.client_id !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Нельзя отменить чужую запись')
    }
    if (actor.role !== 'admin' && !canClientCancel(asDate(row.starts_at), new Date(), config.cancelBeforeHours)) {
      throw new AppError(409, 'CANCEL_TOO_LATE', 'Отменить запись уже нельзя')
    }
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancel_reason = $2, cancelled_at = now() WHERE id = $1`,
      [bookingId, trimmed],
    )
    const booking = await getBooking(bookingId, actor, client)
    await notifyCancelled(client, booking, actor.role)
    return booking
  })
}
