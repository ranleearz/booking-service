import type { Session } from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let accessToken: string | null = null
let refreshPromise: Promise<Session | null> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export async function refreshSession(): Promise<Session | null> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          accessToken = null
          return null
        }
        const data = (await response.json()) as Session
        accessToken = data.accessToken
        return data
      })
      .catch(() => {
        accessToken = null
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response: Response
  try {
    response = await fetch(path, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'Нет связи с сервером')
  }

  const isAuthAttempt = path.startsWith('/api/auth/login')
    || path.startsWith('/api/auth/register')
    || path.startsWith('/api/auth/refresh')

  if (response.status === 401 && retry && !isAuthAttempt) {
    const session = await refreshSession()
    if (session) return api<T>(path, init, false)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let data: { error?: { code?: string; message?: string } } | undefined
  if (text) {
    try {
      data = JSON.parse(text) as { error?: { code?: string; message?: string } }
    } catch {
      throw new ApiError(response.status, 'Сервер вернул некорректный ответ')
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.message ?? 'Ошибка запроса', data?.error?.code)
  }

  return data as T
}
