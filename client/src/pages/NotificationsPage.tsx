import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useOptimistic, useState, useTransition } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../api/http'
import type { NotificationList } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/Button'
import { Notice, PageHeader } from '../components/PageHeader'
import { formatDateTime } from '../lib/dates'

export function NotificationsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationList>('/api/notifications?limit=50'),
  })
  const items = list.data?.items ?? []
  const [optimistic, mark] = useOptimistic(
    items,
    (current, action: { type: 'one'; id: string } | { type: 'all' }) => {
      const now = new Date().toISOString()
      if (action.type === 'all') return current.map((item) => ({ ...item, readAt: item.readAt ?? now }))
      return current.map((item) => item.id === action.id ? { ...item, readAt: item.readAt ?? now } : item)
    },
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const href = user?.role === 'admin' ? '/admin/bookings' : '/bookings'

  useEffect(() => {
    document.title = 'Уведомления — Ателье'
  }, [])

  function readOne(id: string) {
    setError('')
    startTransition(async () => {
      mark({ type: 'one', id })
      try {
        await api(`/api/notifications/${id}/read`, { method: 'POST' })
        await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Не удалось отметить уведомление')
      }
    })
  }

  function readAll() {
    setError('')
    startTransition(async () => {
      mark({ type: 'all' })
      try {
        await api('/api/notifications/read-all', { method: 'POST' })
        await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Не удалось отметить уведомления')
      }
    })
  }

  return (
    <>
      <PageHeader kicker="Лента" title="Уведомления" text="Здесь появляются новые записи и отмены." />
      <div className="mb-6">
        <Button tone="ghost" disabled={pending || optimistic.every((item) => item.readAt)} onClick={readAll}>Прочитать все</Button>
      </div>
      {list.isLoading ? <p className="text-muted">Загрузка…</p> : null}
      {list.isError ? <Notice>{list.error instanceof ApiError ? list.error.message : 'Не удалось загрузить уведомления'}</Notice> : null}
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      {list.data && optimistic.length === 0 ? <p className="text-muted">Пока пусто. Здесь появятся записи и отмены.</p> : null}
      <div>
        {optimistic.map((item) => (
          <article key={item.id} className={item.readAt ? 'border-t border-line py-4' : 'border-t border-line bg-card px-4 py-4'}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-medium">{item.title}</h2>
              <p className="text-sm text-muted">{formatDateTime(item.createdAt)}</p>
            </div>
            <p className="mt-1 text-sm">{item.body}</p>
            <div className="mt-3 flex gap-4 text-sm">
              {item.payload.bookingId ? <Link to={href} className="underline decoration-line underline-offset-4">К записи</Link> : null}
              {!item.readAt ? (
                <button type="button" className="text-accent" onClick={() => readOne(item.id)}>Прочитано</button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
