import { DateTime } from 'luxon'

export const SLOT_STEP_MINUTES = 15
export const SLOT_LEAD_MINUTES = 15

export type WeeklyWindow = {
  weekday: number
  startMinute: number
  endMinute: number
}

export type BusyInterval = {
  start: Date
  end: Date
}

export type Slot = {
  start: Date
  end: Date
}

export type SlotEngineInput = {
  from: string
  to: string
  timeZone: string
  durationMinutes: number
  stepMinutes: number
  weekly: WeeklyWindow[]
  daysOff: string[]
  busy: BusyInterval[]
  notBefore: Date
}

export function buildSlots(input: SlotEngineInput): Slot[] {
  if (input.stepMinutes < 1 || input.durationMinutes < 1) return []
  const startDay = DateTime.fromISO(input.from, { zone: input.timeZone }).startOf('day')
  const endDay = DateTime.fromISO(input.to, { zone: input.timeZone }).startOf('day')
  if (!startDay.isValid || !endDay.isValid || endDay.toMillis() < startDay.toMillis()) return []
  const span = endDay.diff(startDay, 'days').days
  if (span > 31) return []

  const daysOff = new Set(input.daysOff)
  const byWeekday = new Map(input.weekly.map((window) => [window.weekday, window]))
  const slots: Slot[] = []

  for (let day = startDay; day.toMillis() <= endDay.toMillis(); day = day.plus({ days: 1 })) {
    const key = day.toISODate()
    if (!key || daysOff.has(key)) continue
    const window = byWeekday.get(day.weekday)
    if (!window || window.endMinute <= window.startMinute) continue
    const windowEnd = day.startOf('day').plus({ minutes: window.endMinute })
    let cursor = day.startOf('day').plus({ minutes: window.startMinute })
    let guard = 0
    while (guard < 200) {
      const slotEnd = cursor.plus({ minutes: input.durationMinutes })
      if (slotEnd.toMillis() > windowEnd.toMillis()) break
      guard += 1
      const start = cursor.toJSDate()
      const end = slotEnd.toJSDate()
      if (start.getTime() >= input.notBefore.getTime() && !overlapsAny(start, end, input.busy)) {
        slots.push({ start, end })
      }
      cursor = cursor.plus({ minutes: input.stepMinutes })
    }
  }

  return slots
}

function overlapsAny(start: Date, end: Date, busy: BusyInterval[]): boolean {
  const startMs = start.getTime()
  const endMs = end.getTime()
  return busy.some((item) => startMs < item.end.getTime() && endMs > item.start.getTime())
}
