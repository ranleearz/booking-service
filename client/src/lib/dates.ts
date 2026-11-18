const ZONE = 'Europe/Moscow'

const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const WEEKDAY_LONG = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

export function moscowToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utc.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function weekdayMon1(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return jsDay === 0 ? 7 : jsDay
}

export function startOfWeek(isoDate: string): string {
  return addDays(isoDate, 1 - weekdayMon1(isoDate))
}

export function weekDays(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(startIso, index))
}

export function weekdayShort(isoDate: string): string {
  return WEEKDAY_SHORT[weekdayMon1(isoDate) - 1] ?? ''
}

export function weekdayLong(weekday: number): string {
  return WEEKDAY_LONG[weekday] ?? ''
}

export function dayNumber(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)))
}

export function formatWeekTitle(startIso: string): string {
  const start = new Date(`${startIso}T12:00:00+03:00`)
  const end = new Date(`${addDays(startIso, 6)}T12:00:00+03:00`)
  const formatter = new Intl.DateTimeFormat('ru-RU', { timeZone: ZONE, day: 'numeric', month: 'long' })
  return `${formatter.format(start)} — ${formatter.format(end)}`
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('ru-RU', {
    timeZone: ZONE,
    day: 'numeric',
    month: 'long',
  }).format(date)
  return `${day}, ${formatTime(iso)}`
}

export function formatDayLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: ZONE,
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date(`${isoDate}T12:00:00+03:00`))
}

export function moscowDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}
