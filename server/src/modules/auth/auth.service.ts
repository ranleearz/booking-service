import type { Response } from 'express'
import type { PoolClient } from 'pg'
import { config } from '../../config.js'
import { queryOne, withTransaction } from '../../db/pool.js'
import { AppError } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { isPgError } from '../../lib/pg.js'
import { hashToken, newRefreshToken, signAccess, type UserRole } from '../../lib/tokens.js'

const REFRESH_MS = 30 * 24 * 60 * 60 * 1000

type UserRow = {
  id: string
  email: string
  password_hash: string
  name: string
  role: UserRole
}

export type PublicUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

export type Session = {
  refreshToken: string
  accessToken: string
  user: PublicUser
}

function toPublic(user: UserRow): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.nodeEnv === 'production',
    path: '/api/auth',
  }
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie('refresh_token', token, { ...cookieOptions(), maxAge: REFRESH_MS })
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie('refresh_token', cookieOptions())
}

async function persistRefresh(client: PoolClient, user: UserRow): Promise<string> {
  const refreshToken = newRefreshToken()
  const expiresAt = new Date(Date.now() + REFRESH_MS)
  await client.query(
    `DELETE FROM refresh_tokens WHERE user_id = $1 AND (expires_at < now() OR revoked_at IS NOT NULL)`,
    [user.id],
  )
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, hashToken(refreshToken), expiresAt],
  )
  return refreshToken
}

function pack(user: UserRow, refreshToken: string): Session {
  return {
    refreshToken,
    accessToken: signAccess({ sub: user.id, role: user.role, email: user.email }),
    user: toPublic(user),
  }
}

async function issue(user: UserRow): Promise<Session> {
  const refreshToken = await withTransaction((client) => persistRefresh(client, user))
  return pack(user, refreshToken)
}

export async function register(input: { email: string; password: string; name: string }): Promise<Session> {
  const passwordHash = await hashPassword(input.password)
  try {
    const user = await queryOne<UserRow>(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'client')
       RETURNING id, email, password_hash, name, role`,
      [input.email.toLowerCase(), passwordHash, input.name],
    )
    if (!user) throw new AppError(500, 'INTERNAL', 'Внутренняя ошибка')
    return issue(user)
  } catch (error) {
    if (error instanceof AppError) throw error
    if (isPgError(error) && error.code === '23505') {
      throw new AppError(409, 'EMAIL_TAKEN', 'Такой email уже зарегистрирован')
    }
    throw error
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const user = await queryOne<UserRow>(
    `SELECT id, email, password_hash, name, role FROM users WHERE email = $1`,
    [email.toLowerCase()],
  )
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new AppError(401, 'UNAUTHORIZED', 'Неверный email или пароль')
  }
  return issue(user)
}

export async function refresh(token: string | undefined): Promise<Session> {
  if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Сессия не найдена')
  const tokenHash = hashToken(token)
  return withTransaction(async (client) => {
    const row = await queryOne<{ id: string; user_id: string; expires_at: Date | string; revoked_at: Date | string | null }>(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
      client,
    )
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
      throw new AppError(401, 'UNAUTHORIZED', 'Сессия истекла')
    }
    await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [row.id])
    const user = await queryOne<UserRow>(
      `SELECT id, email, password_hash, name, role FROM users WHERE id = $1`,
      [row.user_id],
      client,
    )
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Сессия истекла')
    const refreshToken = await persistRefresh(client, user)
    return pack(user, refreshToken)
  })
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return
  await queryOne(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(token)],
  )
}

export async function getUser(id: string): Promise<PublicUser> {
  const user = await queryOne<UserRow>(
    `SELECT id, email, password_hash, name, role FROM users WHERE id = $1`,
    [id],
  )
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Сессия истекла')
  return toPublic(user)
}
