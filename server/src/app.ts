import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { AppError } from './lib/errors.js'
import { errorHandler } from './middleware/error.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { bookingsRouter } from './modules/bookings/bookings.routes.js'
import { notificationsRouter } from './modules/notifications/notifications.routes.js'
import { servicesRouter } from './modules/services/services.routes.js'
import { specialistsRouter } from './modules/specialists/specialists.routes.js'
import { SLOT_LEAD_MINUTES, SLOT_STEP_MINUTES } from './modules/slots/slot-engine.js'
import { slotsRouter } from './modules/slots/slots.routes.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: config.clientOrigin, credentials: true }))
  app.use(cookieParser())
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/meta', (_req, res) => {
    res.json({
      cancelBeforeHours: config.cancelBeforeHours,
      timeZone: config.timeZone,
      slotStepMinutes: SLOT_STEP_MINUTES,
      leadMinutes: SLOT_LEAD_MINUTES,
    })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/services', servicesRouter)
  app.use('/api/specialists', specialistsRouter)
  app.use('/api/slots', slotsRouter)
  app.use('/api/bookings', bookingsRouter)
  app.use('/api/notifications', notificationsRouter)

  app.use((_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'Маршрут не найден'))
  })
  app.use(errorHandler)
  return app
}
