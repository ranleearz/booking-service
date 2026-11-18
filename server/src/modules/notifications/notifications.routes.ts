import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../lib/async.js'
import { requireAuth } from '../../middleware/auth.js'
import { parse } from '../../middleware/validate.js'
import * as notificationsService from './notifications.service.js'

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
})

const idSchema = z.object({
  id: z.string().uuid('Некорректный идентификатор'),
})

export const notificationsRouter = Router()

notificationsRouter.get('/unread-count', requireAuth, asyncHandler(async (req, res) => {
  const unread = await notificationsService.unreadCount(req.user!.id)
  res.json({ unread })
}))

notificationsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const query = parse<z.infer<typeof listSchema>>(listSchema, req.query)
  const result = await notificationsService.listNotifications(req.user!.id, query.limit ?? 30, query.offset ?? 0)
  res.json(result)
}))

notificationsRouter.post('/read-all', requireAuth, asyncHandler(async (req, res) => {
  const result = await notificationsService.markAllRead(req.user!.id)
  res.json(result)
}))

notificationsRouter.post('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const params = parse<{ id: string }>(idSchema, req.params)
  const notification = await notificationsService.markRead(req.user!.id, params.id)
  res.json({ notification })
}))
