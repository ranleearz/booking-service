import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../../db/pool.js'
import { asyncHandler } from '../../lib/async.js'
import { parse } from '../../middleware/validate.js'
import { findSlots } from './slots.service.js'

const querySchema = z.object({
  specialistId: z.string().uuid('Некорректный идентификатор специалиста'),
  serviceId: z.string().uuid('Некорректный идентификатор услуги'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата'),
})

export const slotsRouter = Router()

slotsRouter.get('/', asyncHandler(async (req, res) => {
  const query = parse<z.infer<typeof querySchema>>(querySchema, req.query)
  const slots = await findSlots(pool, query)
  res.json({
    slots: slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    })),
  })
}))
