import type { UserRole } from '../lib/tokens.js'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        role: UserRole
        email: string
      }
    }
  }
}

export {}
