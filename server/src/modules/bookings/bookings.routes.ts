import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/async.js'
import { requireAuth } from '../../middleware/auth.js'
import { parse } from '../../middleware/validate.js'
import * as bookingsService from './bookings.service.js'

const createSchema = z.object({
  specialistId: z.string().uuid('Некорректный идентификатор специалиста'),
  serviceId: z.string().uuid('Некорректный идентификатор услуги'),
  startsAt: z.string().datetime('Некорректное время'),
})

const cancelSchema = z.object({
  reason: z.string().trim().max(500, 'Причина слишком длинная').optional(),
})

const idSchema = z.object({
  id: z.string().uuid('Некорректный идентификатор'),
})

const dayField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата').optional()

const listSchema = z.object({
  specialistId: z.string().uuid('Некорректный идентификатор специалиста').optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
  from: dayField,
  to: dayField,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const bookingsRouter = Router()

bookingsRouter.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const query = parse<z.infer<typeof listSchema>>(listSchema, req.query)
  const result = await bookingsService.listBookings(
    { ...query, clientId: req.user!.id, limit: query.limit ?? 20, offset: query.offset ?? 0 },
    req.user!,
  )
  res.json(result)
}))

bookingsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'Недостаточно прав')
  const query = parse<z.infer<typeof listSchema>>(listSchema, req.query)
  const result = await bookingsService.listBookings(
    { ...query, limit: query.limit ?? 20, offset: query.offset ?? 0 },
    req.user!,
  )
  res.json(result)
}))

bookingsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.role !== 'client') {
    throw new AppError(403, 'FORBIDDEN', 'Запись доступна клиентскому аккаунту')
  }
  const body = parse<z.infer<typeof createSchema>>(createSchema, req.body)
  const booking = await bookingsService.createBooking(req.user!.id, body)
  res.status(201).json({ booking })
}))

bookingsRouter.post('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const body = parse<z.infer<typeof cancelSchema>>(cancelSchema, req.body ?? {})
  const booking = await bookingsService.cancelBooking(req.user!, params.id, body.reason)
  res.json({ booking })
}))
