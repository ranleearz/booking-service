import type { ZodTypeAny } from 'zod'
import { AppError } from '../lib/errors.js'

export function parse<T>(schema: ZodTypeAny, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError(400, 'VALIDATION', result.error.issues[0]?.message ?? 'Проверьте поля формы')
  }
  return result.data as T
}
