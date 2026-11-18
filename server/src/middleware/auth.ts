import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { verifyAccess } from '../lib/tokens.js'

function readUser(req: Request) {
  const header = req.header('authorization')
  if (!header?.startsWith('Bearer ')) return null
  try {
    const token = verifyAccess(header.slice('Bearer '.length).trim())
    return { id: token.sub, role: token.role, email: token.email }
  } catch {
    return null
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const user = readUser(req)
  if (user) req.user = user
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization')
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Нужна авторизация'))
    return
  }
  try {
    const token = verifyAccess(header.slice('Bearer '.length).trim())
    req.user = { id: token.sub, role: token.role, email: token.email }
    next()
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Сессия истекла'))
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    next(new AppError(403, 'FORBIDDEN', 'Недостаточно прав'))
    return
  }
  next()
}
