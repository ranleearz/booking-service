import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Некорректный JSON' } })
    return
  }
  console.error(error)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Внутренняя ошибка' } })
}
