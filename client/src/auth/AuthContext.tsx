import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, refreshSession, setAccessToken } from '../api/http'
import type { Session, User } from '../api/types'

type AuthValue = {
  user: User | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    refreshSession()
      .then((session) => {
        if (!active) return
        setUser(session?.user ?? null)
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  async function login(email: string, password: string) {
    const session = await api<Session>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false)
    setAccessToken(session.accessToken)
    setUser(session.user)
  }

  async function register(name: string, email: string, password: string) {
    const session = await api<Session>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }, false)
    setAccessToken(session.accessToken)
    setUser(session.user)
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider missing')
  return value
}
