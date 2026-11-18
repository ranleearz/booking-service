import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { buildSlots, type BusyInterval, type WeeklyWindow } from './slot-engine.js'

const zone = 'Europe/Moscow'

function at(day: string, hour: number, minute: number): Date {
  return DateTime.fromISO(day, { zone }).set({ hour, minute, second: 0, millisecond: 0 }).toJSDate()
}

function starts(slots: { start: Date }[]): string[] {
  return slots.map((slot) => slot.start.toISOString())
}

const mondayWindow: WeeklyWindow = { weekday: 1, startMinute: 10 * 60, endMinute: 12 * 60 }

describe('buildSlots', () => {
  it('ставит слоты по сетке, пока услуга целиком входит в окно', () => {
    const slots = buildSlots({
      from: '2026-03-02',
      to: '2026-03-02',
      timeZone: zone,
      durationMinutes: 60,
      stepMinutes: 15,
      weekly: [mondayWindow],
      daysOff: [],
      busy: [],
      notBefore: at('2026-03-01', 0, 0),
    })
    expect(starts(slots)).toEqual([
      at('2026-03-02', 10, 0).toISOString(),
      at('2026-03-02', 10, 15).toISOString(),
      at('2026-03-02', 10, 30).toISOString(),
      at('2026-03-02', 10, 45).toISOString(),
      at('2026-03-02', 11, 0).toISOString(),
    ])
  })

  it('оставляет соседний слот, который начинается ровно в конце занятого', () => {
    const busy: BusyInterval[] = [{ start: at('2026-03-02', 10, 0), end: at('2026-03-02', 11, 0) }]
    const slots = buildSlots({
      from: '2026-03-02',
      to: '2026-03-02',
      timeZone: zone,
      durationMinutes: 60,
      stepMinutes: 15,
      weekly: [mondayWindow],
      daysOff: [],
      busy,
      notBefore: at('2026-03-01', 0, 0),
    })
    expect(starts(slots)).toEqual([at('2026-03-02', 11, 0).toISOString()])
  })

  it('скрывает слоты раньше нижней границы и оставляет границу включительно', () => {
    const slots = buildSlots({
      from: '2026-03-02',
      to: '2026-03-02',
      timeZone: zone,
      durationMinutes: 60,
      stepMinutes: 15,
      weekly: [mondayWindow],
      daysOff: [],
      busy: [],
      notBefore: at('2026-03-02', 10, 30),
    })
    expect(starts(slots)).toEqual([
      at('2026-03-02', 10, 30).toISOString(),
      at('2026-03-02', 10, 45).toISOString(),
      at('2026-03-02', 11, 0).toISOString(),
    ])
  })

  it('пропускает выходной и строит следующий рабочий день', () => {
    const slots = buildSlots({
      from: '2026-03-02',
      to: '2026-03-03',
      timeZone: zone,
      durationMinutes: 60,
      stepMinutes: 60,
      weekly: [
        mondayWindow,
        { weekday: 2, startMinute: 12 * 60, endMinute: 14 * 60 },
      ],
      daysOff: ['2026-03-02'],
      busy: [],
      notBefore: at('2026-03-01', 0, 0),
    })
    expect(starts(slots)).toEqual([
      at('2026-03-03', 12, 0).toISOString(),
      at('2026-03-03', 13, 0).toISOString(),
    ])
  })

  it('не создаёт слот, если услуга не помещается в окно', () => {
    const slots = buildSlots({
      from: '2026-03-02',
      to: '2026-03-02',
      timeZone: zone,
      durationMinutes: 90,
      stepMinutes: 15,
      weekly: [{ weekday: 1, startMinute: 10 * 60, endMinute: 12 * 60 }],
      daysOff: [],
      busy: [],
      notBefore: at('2026-03-01', 0, 0),
    })
    expect(starts(slots)).toEqual([
      at('2026-03-02', 10, 0).toISOString(),
      at('2026-03-02', 10, 15).toISOString(),
      at('2026-03-02', 10, 30).toISOString(),
    ])
  })

  it('возвращает пустой список для пустого шага и перевёрнутого периода', () => {
    const base = {
      from: '2026-03-02',
      to: '2026-03-02',
      timeZone: zone,
      durationMinutes: 60,
      stepMinutes: 15,
      weekly: [mondayWindow],
      daysOff: [],
      busy: [],
      notBefore: at('2026-03-01', 0, 0),
    }
    expect(buildSlots({ ...base, stepMinutes: 0 })).toEqual([])
    expect(buildSlots({ ...base, from: '2026-03-04', to: '2026-03-02' })).toEqual([])
    expect(buildSlots({ ...base, from: '2026-03-03', to: '2026-03-03' })).toEqual([])
  })
})
