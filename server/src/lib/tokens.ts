import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export type UserRole = 'client' | 'admin'

export type AccessToken = {
  sub: string
  role: UserRole
  email: string
}

const ACCESS_TTL_SECONDS = 15 * 60

function isRole(value: unknown): value is UserRole {
  return value === 'client' || value === 'admin'
}

export function signAccess(token: AccessToken): string {
  return jwt.sign(
    { sub: token.sub, role: token.role, email: token.email },
    config.jwtAccessSecret,
    { expiresIn: ACCESS_TTL_SECONDS },
  )
}

export function verifyAccess(token: string): AccessToken {
  const decoded = jwt.verify(token, config.jwtAccessSecret)
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('bad token')
  }
  if (typeof decoded.sub !== 'string' || typeof decoded.email !== 'string' || !isRole(decoded.role)) {
    throw new Error('bad token')
  }
  return { sub: decoded.sub, role: decoded.role, email: decoded.email }
}

export function newRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
