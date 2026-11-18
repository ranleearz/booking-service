import { describe, expect, it } from 'vitest'
import { canClientCancel } from './booking.policy.js'

describe('canClientCancel', () => {
  const startsAt = new Date('2026-06-01T10:00:00.000Z')
  const twoHoursBefore = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000)

  it('разрешает отмену ровно за заданное число часов', () => {
    expect(canClientCancel(startsAt, twoHoursBefore, 2)).toBe(true)
  })

  it('запрещает отмену, если до начала осталось меньше порога', () => {
    expect(canClientCancel(startsAt, new Date(twoHoursBefore.getTime() + 1), 2)).toBe(false)
  })

  it('запрещает отмену прошедшей записи и битой даты', () => {
    expect(canClientCancel(startsAt, new Date(startsAt.getTime() + 1000), 2)).toBe(false)
    expect(canClientCancel(new Date('invalid'), new Date(), 2)).toBe(false)
  })
})
