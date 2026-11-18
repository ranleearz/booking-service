import { DateTime } from 'luxon'
import type { PoolClient } from 'pg'
import { config } from '../config.js'
import { migrate } from './migrate.js'
import { pool, withTransaction } from './pool.js'
import { hashPassword } from '../lib/password.js'
import { formatSlotLabel } from '../lib/time.js'
import { findSlots } from '../modules/slots/slots.service.js'

const IDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  client: '22222222-2222-4222-8222-222222222222',
  consult: '33333333-3333-4333-8333-333333333331',
  cut: '33333333-3333-4333-8333-333333333332',
  color: '33333333-3333-4333-8333-333333333333',
  anna: '44444444-4444-4444-8444-444444444441',
  mark: '44444444-4444-4444-8444-444444444442',
  eva: '44444444-4444-4444-8444-444444444443',
}

const services = [
  {
    id: IDS.consult,
    name: 'Консультация',
    description: 'Разбор задачи, подбор формы и ухода. На этом визите волосы не трогаем.',
    duration: 30,
    price: 150000,
  },
  {
    id: IDS.cut,
    name: 'Стрижка',
    description: 'Стрижка и укладка по форме. Моем голову до и после.',
    duration: 60,
    price: 350000,
  },
  {
    id: IDS.color,
    name: 'Окрашивание',
    description: 'Однотон или мягкий переход. В слоте заложены два часа.',
    duration: 120,
    price: 890000,
  },
]

const specialists = [
  {
    id: IDS.anna,
    name: 'Анна Ковалева',
    bio: 'Стрижки и короткие консультации. Спокойный темп, точная форма.',
    services: [IDS.consult, IDS.cut],
    hours: [
      [1, 10 * 60, 19 * 60],
      [2, 10 * 60, 19 * 60],
      [3, 10 * 60, 19 * 60],
      [4, 10 * 60, 19 * 60],
      [5, 10 * 60, 19 * 60],
      [6, 11 * 60, 16 * 60],
    ],
  },
  {
    id: IDS.mark,
    name: 'Марк Левин',
    bio: 'Сложное окрашивание и стрижки. Принимает со второй половины дня.',
    services: [IDS.cut, IDS.color],
    hours: [
      [2, 12 * 60, 20 * 60],
      [3, 12 * 60, 20 * 60],
      [4, 12 * 60, 20 * 60],
      [5, 12 * 60, 20 * 60],
      [6, 12 * 60, 20 * 60],
    ],
  },
  {
    id: IDS.eva,
    name: 'Ева Морозова',
    bio: 'Только консультации: разбор ухода и план следующих визитов.',
    services: [IDS.consult],
    hours: [
      [1, 9 * 60, 15 * 60],
      [2, 9 * 60, 15 * 60],
      [3, 9 * 60, 15 * 60],
      [4, 9 * 60, 15 * 60],
    ],
  },
] as const

function previousWorkingDay(from: DateTime, weekdays: number[]): DateTime {
  let cursor = from
  for (let step = 0; step < 14; step += 1) {
    if (weekdays.includes(cursor.weekday)) return cursor
    cursor = cursor.minus({ days: 1 })
  }
  return from
}

async function insertBooking(
  client: PoolClient,
  input: {
    clientId: string
    specialistId: string
    serviceId: string
    start: Date
    end: Date
    status: 'confirmed' | 'cancelled'
    reason?: string
    createdAt: Date
  },
) {
  const row = await client.query<{ id: string }>(
    `INSERT INTO bookings (
       client_id, specialist_id, service_id, starts_at, ends_at, status, cancel_reason, cancelled_at, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.clientId,
      input.specialistId,
      input.serviceId,
      input.start,
      input.end,
      input.status,
      input.reason ?? null,
      input.status === 'cancelled' ? input.createdAt : null,
      input.createdAt,
    ],
  )
  return row.rows[0].id
}

async function notify(
  client: PoolClient,
  userId: string,
  type: 'booking_created' | 'booking_cancelled',
  title: string,
  body: string,
  bookingId: string,
  read: boolean,
) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, payload, read_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [userId, type, title, body, JSON.stringify({ bookingId }), read ? new Date() : null],
  )
}

async function seedBookings(client: PoolClient) {
  const existing = await client.query(`SELECT 1 FROM bookings WHERE client_id = $1 LIMIT 1`, [IDS.client])
  if (existing.rowCount) return

  const annaSlots = await findSlots(client, {
    specialistId: IDS.anna,
    serviceId: IDS.cut,
    from: DateTime.now().setZone(config.timeZone).toISODate() ?? '',
    to: DateTime.now().setZone(config.timeZone).plus({ days: 21 }).toISODate() ?? '',
  })
  const byDay = new Map<string, typeof annaSlots>()
  for (const slot of annaSlots) {
    const key = DateTime.fromJSDate(slot.start).setZone(config.timeZone).toISODate()
    if (!key) continue
    const list = byDay.get(key) ?? []
    list.push(slot)
    byDay.set(key, list)
  }
  const picked = [...byDay.values()].slice(0, 3).map((list) => list[Math.min(4, list.length - 1)])

  const futureIds: string[] = []
  for (const slot of picked) {
    const id = await insertBooking(client, {
      clientId: IDS.client,
      specialistId: IDS.anna,
      serviceId: IDS.cut,
      start: slot.start,
      end: slot.end,
      status: 'confirmed',
      createdAt: new Date(),
    })
    futureIds.push(id)
  }

  const annaWeekdays = [1, 2, 3, 4, 5, 6]
  const yesterday = DateTime.now().setZone(config.timeZone).startOf('day').minus({ days: 1 })
  const pastDay = previousWorkingDay(yesterday, annaWeekdays)
  const earlierDay = previousWorkingDay(pastDay.minus({ days: 1 }), annaWeekdays)
  const pastStart = pastDay.set({ hour: 11, minute: 0, second: 0, millisecond: 0 })
  const cancelledStart = earlierDay.set({ hour: 15, minute: 0, second: 0, millisecond: 0 })

  await insertBooking(client, {
    clientId: IDS.client,
    specialistId: IDS.anna,
    serviceId: IDS.cut,
    start: pastStart.toJSDate(),
    end: pastStart.plus({ minutes: 60 }).toJSDate(),
    status: 'confirmed',
    createdAt: pastStart.minus({ days: 3 }).toJSDate(),
  })

  const cancelledId = await insertBooking(client, {
    clientId: IDS.client,
    specialistId: IDS.anna,
    serviceId: IDS.consult,
    start: cancelledStart.toJSDate(),
    end: cancelledStart.plus({ minutes: 30 }).toJSDate(),
    status: 'cancelled',
    reason: 'Перенос по просьбе клиента',
    createdAt: cancelledStart.minus({ days: 2 }).toJSDate(),
  })

  if (futureIds[0] && picked[0]) {
    const when = formatSlotLabel(picked[0].start, config.timeZone)
    const body = `Стрижка у Анны Ковалевой, ${when}`
    await notify(client, IDS.client, 'booking_created', 'Запись подтверждена', body, futureIds[0], false)
    await notify(client, IDS.admin, 'booking_created', 'Новая запись', `Мария Соколова: ${body}`, futureIds[0], false)
  }

  const cancelledWhen = formatSlotLabel(cancelledStart.toJSDate(), config.timeZone)
  await notify(
    client,
    IDS.client,
    'booking_cancelled',
    'Запись отменена',
    `Консультация у Анны Ковалевой, ${cancelledWhen}. Причина: Перенос по просьбе клиента`,
    cancelledId,
    true,
  )
}

async function seed() {
  const adminHash = await hashPassword('Admin12345')
  const clientHash = await hashPassword('Client12345')
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, role)
       VALUES ($1, 'admin@atelier.local', $2, 'Администратор', 'admin')
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = EXCLUDED.role`,
      [IDS.admin, adminHash],
    )
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, role)
       VALUES ($1, 'client@atelier.local', $2, 'Мария Соколова', 'client')
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = EXCLUDED.role`,
      [IDS.client, clientHash],
    )
    for (const service of services) {
      await client.query(
        `INSERT INTO services (id, name, description, duration_minutes, price_cents, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             duration_minutes = EXCLUDED.duration_minutes,
             price_cents = EXCLUDED.price_cents,
             is_active = true,
             updated_at = now()`,
        [service.id, service.name, service.description, service.duration, service.price],
      )
    }
    for (const specialist of specialists) {
      await client.query(
        `INSERT INTO specialists (id, name, bio, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, bio = EXCLUDED.bio, is_active = true, updated_at = now()`,
        [specialist.id, specialist.name, specialist.bio],
      )
      await client.query(`DELETE FROM specialist_services WHERE specialist_id = $1`, [specialist.id])
      for (const serviceId of specialist.services) {
        await client.query(
          `INSERT INTO specialist_services (specialist_id, service_id) VALUES ($1, $2)`,
          [specialist.id, serviceId],
        )
      }
      await client.query(`DELETE FROM weekly_hours WHERE specialist_id = $1`, [specialist.id])
      for (const [weekday, startMinute, endMinute] of specialist.hours) {
        await client.query(
          `INSERT INTO weekly_hours (specialist_id, weekday, start_minute, end_minute) VALUES ($1, $2, $3, $4)`,
          [specialist.id, weekday, startMinute, endMinute],
        )
      }
    }
    await seedBookings(client)
  })
}

await migrate()
await seed()
await pool.end()
console.log('Seed complete')
