import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/async.js'
import { optionalAuth, requireAdmin, requireAuth } from '../../middleware/auth.js'
import { parse } from '../../middleware/validate.js'
import * as servicesService from './services.service.js'

const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(120, 'Название слишком длинное'),
  description: z.string().trim().max(2000, 'Описание слишком длинное'),
  durationMinutes: z.number().int().min(15, 'Минимум 15 минут').max(480, 'Максимум 8 часов')
    .refine((value) => value % 15 === 0, 'Длительность должна быть кратна 15 минутам'),
  priceCents: z.number().int().min(0, 'Цена не может быть отрицательной').max(10_000_000, 'Слишком большая цена'),
  isActive: z.boolean(),
})

const idSchema = z.object({
  id: z.string().uuid('Некорректный идентификатор'),
})

export const servicesRouter = Router()

servicesRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const query = parse<{ all?: '1' }>(z.object({ all: z.enum(['1']).optional() }), req.query)
  if (query.all === '1' && req.user?.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Недостаточно прав')
  }
  const items = await servicesService.listServices(query.all === '1')
  res.json({ items })
}))

servicesRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const service = await servicesService.getService(params.id, req.user?.role === 'admin')
  res.json({ service })
}))

servicesRouter.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const body = parse<z.infer<typeof serviceSchema>>(serviceSchema, req.body)
  const service = await servicesService.createService(body)
  res.status(201).json({ service })
}))

servicesRouter.patch('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const body = parse<z.infer<typeof serviceSchema>>(serviceSchema, req.body)
  const service = await servicesService.updateService(params.id, body)
  res.json({ service })
}))
