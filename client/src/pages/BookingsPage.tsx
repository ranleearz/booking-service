import { useQuery } from '@tanstack/react-query'
import { useEffect, useOptimistic, useState } from 'react'
import { ApiError, api } from '../api/http'
import type { Booking, BookingList } from '../api/types'
import { useMeta } from '../api/useMeta'
import { CancelAction } from '../components/CancelAction'
import { Notice, PageHeader } from '../components/PageHeader'
import { useCancelBooking } from '../features/bookings/useCancelBooking'
import { formatDateTime } from '../lib/dates'
import { formatDuration, formatPrice, hoursLabel } from '../lib/format'

type Tab = 'upcoming' | 'past' | 'cancelled'

function belongs(booking: Booking, tab: Tab, now: number): boolean {
  if (tab === 'cancelled') return booking.status === 'cancelled'
  if (booking.status !== 'confirmed') return false
  const start = new Date(booking.startsAt).getTime()
  return tab === 'upcoming' ? start > now : start <= now
}

export function BookingsPage() {
  const meta = useMeta()
  const list = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: () => api<BookingList>('/api/bookings/mine?limit=100'),
  })
  const bookings = list.data?.items ?? []
  const [optimistic, markCancelled] = useOptimistic(bookings, (current, id: string) => (
    current.map((booking) => booking.id === id
      ? { ...booking, status: 'cancelled' as const, canCancel: false, cancelledAt: new Date().toISOString() }
      : booking)
  ))
  const { pendingId, error, cancel } = useCancelBooking()
  const [tab, setTab] = useState<Tab>('upcoming')
  const now = Date.now()
  const visible = optimistic.filter((booking) => belongs(booking, tab, now))

  useEffect(() => {
    document.title = 'Мои записи — Ателье'
  }, [])

  return (
    <>
      <PageHeader
        kicker="Кабинет"
        title="Мои записи"
        text={`Свою запись можно отменить не позднее чем за ${hoursLabel(meta.data?.cancelBeforeHours ?? 2)} до начала.`}
      />
      <div className="mb-6 flex gap-4 text-sm">
        {([
          ['upcoming', 'Предстоящие'],
          ['past', 'Прошедшие'],
          ['cancelled', 'Отменённые'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? 'text-accent' : 'text-ink'}>
            {label}
          </button>
        ))}
      </div>
      {list.isLoading ? <p className="text-muted">Загрузка…</p> : null}
      {list.isError ? <Notice>{list.error instanceof ApiError ? list.error.message : 'Не удалось загрузить записи'}</Notice> : null}
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      {list.data && visible.length === 0 ? <p className="text-muted">В этом разделе пусто.</p> : null}
      <div>
        {visible.map((booking) => (
          <article key={booking.id} className="border-t border-line py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl">{booking.serviceName}</h2>
              <p>{formatPrice(booking.priceCents)}</p>
            </div>
            <p className="mt-1 text-sm text-muted">
              {booking.specialistName} · {formatDateTime(booking.startsAt)} · {formatDuration(booking.durationMinutes)}
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
    </>
  )
}
