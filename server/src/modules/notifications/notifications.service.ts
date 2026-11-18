import type { Queryable } from '../../db/pool.js'
import { query } from '../../db/pool.js'
import { AppError } from '../../lib/errors.js'

export type NotificationType = 'booking_created' | 'booking_cancelled'

type NotificationRow = {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  payload: { bookingId?: string } | null
  read_at: Date | string | null
  created_at: Date | string
}

export type NotificationDto = {
  id: string
  type: NotificationType
  title: string
  body: string
  payload: { bookingId?: string }
  readAt: string | null
  createdAt: string
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapNotification(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    readAt: row.read_at ? iso(row.read_at) : null,
    createdAt: iso(row.created_at),
  }
}

export async function createNotifications(
  db: Queryable,
  input: {
    userIds: string[]
    type: NotificationType
    title: string
    body: string
    payload: { bookingId: string }
  },
): Promise<void> {
  const userIds = [...new Set(input.userIds)]
  if (userIds.length === 0) return
  const params: unknown[] = []
  const values = userIds.map((userId, index) => {
    const base = index * 5
    params.push(userId, input.type, input.title, input.body, JSON.stringify(input.payload))
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb)`
  })
  await db.query(
    `INSERT INTO notifications (user_id, type, title, body, payload) VALUES ${values.join(', ')}`,
    params,
  )
}

export async function listAdminIds(db: Queryable): Promise<string[]> {
  const rows = await query<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`, [], db)
  return rows.map((row) => row.id)
}

export async function listNotifications(userId: string, limit: number, offset: number) {
  const items = await query<NotificationRow>(
    `SELECT id, user_id, type, title, body, payload, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  )
  const totalRow = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM notifications WHERE user_id = $1`,
    [userId],
  )
  const unreadRow = await query<{ unread: number }>(
    `SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  )
  return {
    items: items.map(mapNotification),
    total: totalRow[0]?.total ?? 0,
    unread: unreadRow[0]?.unread ?? 0,
  }
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await query<{ unread: number }>(
    `SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  )
  return rows[0]?.unread ?? 0
}

export async function markRead(userId: string, id: string): Promise<NotificationDto> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM notifications WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  if (!existing[0]) throw new AppError(404, 'NOT_FOUND', 'Уведомление не найдено')
  const rows = await query<NotificationRow>(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, type, title, body, payload, read_at, created_at`,
    [id, userId],
  )
  const row = rows[0]
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Уведомление не найдено')
  return mapNotification(row)
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await query<{ id: string }>(
    `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id`,
    [userId],
  )
  return { updated: result.length }
}
