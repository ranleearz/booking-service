import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/async.js'
import { optionalAuth, requireAdmin, requireAuth } from '../../middleware/auth.js'
import { parse } from '../../middleware/validate.js'
import { parseClock } from '../../lib/time.js'
import * as specialistsService from './specialists.service.js'

const idSchema = z.object({
  id: z.string().uuid('Некорректный идентификатор'),
})

const specialistSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя').max(120, 'Имя слишком длинное'),
  bio: z.string().trim().max(2000, 'Описание слишком длинное'),
  isActive: z.boolean(),
})

const servicesSchema = z.object({
  serviceIds: z.array(z.string().uuid('Некорректный идентификатор услуги')).max(50),
})

const hourSchema = z.object({
  weekday: z.number({ invalid_type_error: 'Укажите день недели' }).int().min(1).max(7),
  startTime: z.string(),
  endTime: z.string(),
}).superRefine((hour, context) => {
  const start = parseClock(hour.startTime)
  const end = parseClock(hour.endTime, true)
  if (start === null) {
    context.addIssue({ code: 'custom', path: ['startTime'], message: 'Некорректное время начала' })
  }
  if (end === null) {
    context.addIssue({ code: 'custom', path: ['endTime'], message: 'Некорректное время окончания' })
  }
  if (start !== null && end !== null && end <= start) {
    context.addIssue({ code: 'custom', path: ['endTime'], message: 'Конец рабочего дня должен быть позже начала' })
  }
})

const hoursSchema = z.object({
  hours: z.array(hourSchema).max(7),
}).superRefine((value, context) => {
  const seen = new Set<number>()
  value.hours.forEach((hour, index) => {
    if (seen.has(hour.weekday)) {
      context.addIssue({ code: 'custom', path: ['hours', index, 'weekday'], message: 'День недели указан дважды' })
    }
    seen.add(hour.weekday)
  })
})

const dayOffSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата'),
})

const dayParamSchema = z.object({
  id: z.string().uuid('Некорректный идентификатор'),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата'),
})

const listQuerySchema = z.object({
  serviceId: z.string().uuid('Некорректный идентификатор услуги').optional(),
  all: z.enum(['1']).optional(),
})

export const specialistsRouter = Router()

specialistsRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const query = parse<z.infer<typeof listQuerySchema>>(listQuerySchema, req.query)
  if (query.all === '1' && req.user?.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Недостаточно прав')
  }
  const items = await specialistsService.listSpecialists({
    serviceId: query.serviceId,
    includeInactive: query.all === '1',
  })
  res.json({ items })
}))

specialistsRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const specialist = await specialistsService.getSpecialist(params.id, req.user?.role === 'admin')
  res.json({ specialist })
}))

specialistsRouter.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const body = parse<z.infer<typeof specialistSchema>>(specialistSchema, req.body)
  const specialist = await specialistsService.createSpecialist(body)
  res.status(201).json({ specialist })
}))

specialistsRouter.patch('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const body = parse<z.infer<typeof specialistSchema>>(specialistSchema, req.body)
  const specialist = await specialistsService.updateSpecialist(params.id, body)
  res.json({ specialist })
}))

specialistsRouter.put('/:id/services', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const body = parse<z.infer<typeof servicesSchema>>(servicesSchema, req.body)
  const specialist = await specialistsService.replaceServices(params.id, body.serviceIds)
  res.json({ specialist })
}))

specialistsRouter.put('/:id/hours', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const body = parse<z.infer<typeof hoursSchema>>(hoursSchema, req.body)
  const hours = body.hours.map((hour) => ({
    weekday: hour.weekday,
    startMinute: parseClock(hour.startTime) ?? 0,
    endMinute: parseClock(hour.endTime, true) ?? 0,
  }))
  const specialist = await specialistsService.replaceHours(params.id, hours)
  res.json({ specialist })
}))

specialistsRouter.post('/:id/days-off', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const body = parse<z.infer<typeof dayOffSchema>>(dayOffSchema, req.body)
  const specialist = await specialistsService.addDayOff(params.id, body.day)
  res.status(201).json({ specialist })
}))

specialistsRouter.delete('/:id/days-off/:day', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const params = parse<z.infer<typeof dayParamSchema>>(dayParamSchema, req.params)
  await specialistsService.removeDayOff(params.id, params.day)
  res.status(204).end()
}))
