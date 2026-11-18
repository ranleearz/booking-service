import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { asyncHandler } from '../../lib/async.js'
import { parse } from '../../middleware/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import * as authService from './auth.service.js'

const credentialsSchema = z.object({
  email: z.string().trim().email('Укажите корректный email').max(254),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов').max(72, 'Пароль слишком длинный'),
})

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, 'Укажите имя').max(80, 'Имя слишком длинное'),
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Слишком много попыток, попробуйте позже' } },
})

function readRefreshCookie(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export const authRouter = Router()

authRouter.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const body = parse<z.infer<typeof registerSchema>>(registerSchema, req.body)
  const session = await authService.register(body)
  authService.setRefreshCookie(res, session.refreshToken)
  res.status(201).json({ accessToken: session.accessToken, user: session.user })
}))

authRouter.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const body = parse<z.infer<typeof credentialsSchema>>(credentialsSchema, req.body)
  const session = await authService.login(body.email, body.password)
  authService.setRefreshCookie(res, session.refreshToken)
  res.json({ accessToken: session.accessToken, user: session.user })
}))

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const session = await authService.refresh(readRefreshCookie(req.cookies?.refresh_token))
  authService.setRefreshCookie(res, session.refreshToken)
  res.json({ accessToken: session.accessToken, user: session.user })
}))

authRouter.post('/logout', asyncHandler(async (req, res) => {
  await authService.logout(readRefreshCookie(req.cookies?.refresh_token))
  authService.clearRefreshCookie(res)
  res.status(204).end()
}))

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await authService.getUser(req.user!.id)
  res.json({ user })
}))
