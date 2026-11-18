import { DateTime } from 'luxon'

export function parseClock(value: string, allowEndOfDay = false): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null
  if (hours === 24 && minutes === 0 && allowEndOfDay) return 24 * 60
  if (hours < 0 || hours > 23) return null
  return hours * 60 + minutes
}

export function formatClock(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function parseDay(value: string, zone: string): DateTime | null {
  const day = DateTime.fromISO(value, { zone })
  if (!day.isValid || day.toISODate() !== value) return null
  return day.startOf('day')
}

export function formatSlotLabel(date: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: 'numeric',
    month: 'long',
  }).format(date)
  const time = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return `${day}, ${time}`
}

export function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function asIso(value: Date | string): string {
  return asDate(value).toISOString()
}
