import { DateTime } from 'luxon'
import { z } from 'zod'
import './env.js'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  CLIENT_ORIGIN: z.string().url(),
  APP_TIMEZONE: z.string().min(1).default('Europe/Moscow'),
  PORT: z.coerce.number().int().positive().default(4000),
  CANCEL_BEFORE_HOURS: z.coerce.number().int().positive().default(2),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
  throw new Error(`Некорректные переменные окружения\n${fields}`)
}

const zoneProbe = DateTime.now().setZone(parsed.data.APP_TIMEZONE)

if (!zoneProbe.isValid) {
  throw new Error(`Неизвестный часовой пояс: ${parsed.data.APP_TIMEZONE}`)
}

export const config = {
  databaseUrl: parsed.data.DATABASE_URL,
  jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
  jwtRefreshSecret: parsed.data.JWT_REFRESH_SECRET,
  clientOrigin: parsed.data.CLIENT_ORIGIN,
  timeZone: parsed.data.APP_TIMEZONE,
  port: parsed.data.PORT,
  cancelBeforeHours: parsed.data.CANCEL_BEFORE_HOURS,
  nodeEnv: parsed.data.NODE_ENV,
}
