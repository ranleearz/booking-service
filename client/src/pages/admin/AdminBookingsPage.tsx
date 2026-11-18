import { useQuery } from '@tanstack/react-query'
import { useEffect, useOptimistic, useState } from 'react'
import { ApiError, api } from '../../api/http'
import type { Booking, BookingList, Specialist } from '../../api/types'
import { Button, controlClass } from '../../components/Button'
import { CancelAction } from '../../components/CancelAction'
import { Notice, PageHeader } from '../../components/PageHeader'
import { useCancelBooking } from '../../features/bookings/useCancelBooking'
import { addDays, formatDateTime, moscowToday } from '../../lib/dates'
import { formatPrice } from '../../lib/format'

export function AdminBookingsPage() {
  const today = moscowToday()
  const [specialistId, setSpecialistId] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 30))
  const [offset, setOffset] = useState(0)
  const limit = 20
  const specialists = useQuery({
    queryKey: ['specialists', 'all'],
    queryFn: () => api<{ items: Specialist[] }>('/api/specialists?all=1'),
  })
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (specialistId) params.set('specialistId', specialistId)
  if (status) params.set('status', status)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const list = useQuery({
    queryKey: ['bookings', 'admin', specialistId, status, from, to, offset],
    queryFn: () => api<BookingList>(`/api/bookings?${params.toString()}`),
  })
  const bookings = list.data?.items ?? []
  const [optimistic, markCancelled] = useOptimistic(bookings, (current: Booking[], id: string) => (
    current.map((booking) => booking.id === id
      ? { ...booking, status: 'cancelled' as const, canCancel: false, cancelledAt: new Date().toISOString() }
      : booking)
  ))
  const { pendingId, error, cancel } = useCancelBooking()

  useEffect(() => {
    document.title = 'Записи — Ателье'
  }, [])

  const total = list.data?.total ?? 0

  return (
    <>
      <PageHeader kicker="Администрирование" title="Все записи" text="Фильтр по специалисту, статусу и датам. Отмена доступна в любой момент." />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Специалист</span>
          <select className={controlClass} value={specialistId} onChange={(event) => { setSpecialistId(event.target.value); setOffset(0) }}>
            <option value="">Все</option>
            {specialists.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Статус</span>
          <select className={controlClass} value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0) }}>
            <option value="">Все</option>
            <option value="confirmed">Подтверждена</option>
            <option value="cancelled">Отменена</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">С</span>
          <input type="date" className={controlClass} value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0) }} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">По</span>
          <input type="date" className={controlClass} value={to} onChange={(event) => { setTo(event.target.value); setOffset(0) }} />
        </label>
      </div>
      {list.isLoading ? <p className="text-muted">Загрузка…</p> : null}
      {list.isError ? <Notice>{list.error instanceof ApiError ? list.error.message : 'Не удалось загрузить записи'}</Notice> : null}
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      {list.data && optimistic.length === 0 ? <p className="text-muted">Записей нет.</p> : null}
      <div>
        {optimistic.map((booking) => (
          <article key={booking.id} className="border-t border-line py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl">{booking.serviceName}</h2>
              <p className="text-sm text-muted">{booking.status === 'confirmed' ? 'Подтверждена' : 'Отменена'}</p>
            </div>
            <p className="mt-1 text-sm">
              {booking.clientName} · {booking.specialistName} · {formatDateTime(booking.startsAt)} · {formatPrice(booking.priceCents)}
            </p>
            {booking.cancelReason ? <p className="mt-2 text-sm">Причина: {booking.cancelReason}</p> : null}
            <CancelAction
              canCancel={booking.canCancel}
              pending={pendingId === booking.id}
              onConfirm={(reason) => cancel(booking.id, reason, markCancelled)}
            />
          </article>
        ))}
      </div>
      {total > limit ? (
        <div className="mt-6 flex items-center justify-between text-sm">
          <Button tone="ghost" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - limit))}>Назад</Button>
          <span>{offset + 1}–{Math.min(offset + limit, total)} из {total}</span>
          <Button tone="ghost" disabled={offset + limit >= total} onClick={() => setOffset((value) => value + limit)}>Дальше</Button>
        </div>
      ) : null}
    </>
  )
}
