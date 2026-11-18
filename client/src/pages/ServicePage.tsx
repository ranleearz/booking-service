import { useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, api } from '../api/http'
import type { Service, Slot, Specialist, SpecialistDetail } from '../api/types'
import { useMeta } from '../api/useMeta'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/Button'
import { Notice, PageHeader } from '../components/PageHeader'
import { SlotCalendar } from '../features/calendar/SlotCalendar'
import { addDays, formatDateTime, formatTime, formatWeekTitle, moscowToday, startOfWeek, weekDays } from '../lib/dates'
import { formatDuration, formatPrice, hoursLabel } from '../lib/format'

export function ServicePage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meta = useMeta()
  const today = moscowToday()
  const currentWeek = startOfWeek(today)
  const [weekStart, setWeekStart] = useState(currentWeek)
  const [specialistId, setSpecialistId] = useState<string | null>(params.get('specialist'))
  const [selectedStart, setSelectedStart] = useState<string | null>(params.get('slot'))
  const [submitError, setSubmitError] = useState('')
  const [pending, setPending] = useState(false)

  const service = useQuery({
    queryKey: ['service', id],
    queryFn: () => api<{ service: Service }>(`/api/services/${id}`),
    enabled: Boolean(id),
  })
  const specialists = useQuery({
    queryKey: ['specialists', id],
    queryFn: () => api<{ items: Specialist[] }>(`/api/specialists?serviceId=${id}`),
    enabled: Boolean(id),
  })
  const activeSpecialistId = specialistId && specialists.data?.items.some((item) => item.id === specialistId)
    ? specialistId
    : specialists.data?.items[0]?.id ?? null
  const detail = useQuery({
    queryKey: ['specialist', activeSpecialistId],
    queryFn: () => api<{ specialist: SpecialistDetail }>(`/api/specialists/${activeSpecialistId}`),
    enabled: Boolean(activeSpecialistId),
  })
  const days = weekDays(weekStart)
  const slots = useQuery({
    queryKey: ['slots', activeSpecialistId, id, days[0], days[6]],
    queryFn: () => api<{ slots: Slot[] }>(`/api/slots?specialistId=${activeSpecialistId}&serviceId=${id}&from=${days[0]}&to=${days[6]}`),
    enabled: Boolean(activeSpecialistId && id),
  })

  useEffect(() => {
    document.title = service.data ? `${service.data.service.name} — Ателье` : 'Услуга — Ателье'
  }, [service.data])

  useEffect(() => {
    if (selectedStart && slots.data && !slots.data.slots.some((slot) => slot.start === selectedStart)) {
      setSelectedStart(null)
    }
  }, [slots.data, selectedStart])

  const selectedSlot = slots.data?.slots.find((slot) => slot.start === selectedStart) ?? null
  const specialist = specialists.data?.items.find((item) => item.id === activeSpecialistId) ?? null
  const canGoBack = weekStart > currentWeek
  const canGoForward = weekStart < addDays(currentWeek, 7 * 12)

  function chooseSpecialist(nextId: string) {
    setSpecialistId(nextId)
    setSelectedStart(null)
    setSubmitError('')
    const next = new URLSearchParams(params)
    next.set('specialist', nextId)
    next.delete('slot')
    setParams(next, { replace: true })
  }

  function chooseSlot(start: string) {
    setSelectedStart(start)
    setSubmitError('')
    const next = new URLSearchParams(params)
    if (activeSpecialistId) next.set('specialist', activeSpecialistId)
    next.set('slot', start)
    setParams(next, { replace: true })
  }

  async function book() {
    if (!activeSpecialistId || !selectedStart) return
    setPending(true)
    setSubmitError('')
    try {
      await api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ specialistId: activeSpecialistId, serviceId: id, startsAt: selectedStart }),
      })
      await queryClient.invalidateQueries({ queryKey: ['slots'] })
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      navigate('/bookings')
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Не удалось записаться')
      await queryClient.invalidateQueries({ queryKey: ['slots'] })
    } finally {
      setPending(false)
    }
  }

  if (service.isLoading || specialists.isLoading) return <p className="text-muted">Загрузка…</p>
  if (service.isError) return <Notice>{service.error instanceof ApiError ? service.error.message : 'Услуга не найдена'}</Notice>
  if (!service.data) return null
  const current = service.data.service
  const loginNext = `/services/${id}?${new URLSearchParams({
    ...(activeSpecialistId ? { specialist: activeSpecialistId } : {}),
    ...(selectedStart ? { slot: selectedStart } : {}),
  }).toString()}`

  return (
    <>
      <PageHeader
        kicker={formatDuration(current.durationMinutes)}
        title={current.name}
        text={current.description}
      />
      <p className="mb-8 font-serif text-3xl">{formatPrice(current.priceCents)}</p>
      {specialists.data && specialists.data.items.length === 0 ? <p className="text-muted">Эту услугу пока никто не принимает.</p> : null}
      {specialists.data && specialists.data.items.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Специалист</p>
            {specialists.data.items.map((item) => {
              const selected = item.id === activeSpecialistId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseSpecialist(item.id)}
                  className={`border-l-2 px-3 py-3 text-left ${selected ? 'border-accent bg-card' : 'border-transparent hover:bg-card'}`}
                >
                  <span className="block font-medium">{item.name}</span>
                  <span className="mt-1 block text-sm text-muted">{item.bio}</span>
                </button>
              )
            })}
          </div>
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-serif text-2xl">{formatWeekTitle(weekStart)}</p>
              <div className="flex gap-2">
                <Button tone="ghost" disabled={!canGoBack} onClick={() => setWeekStart((value) => addDays(value, -7))}>Назад</Button>
                <Button tone="ghost" disabled={!canGoForward} onClick={() => setWeekStart((value) => addDays(value, 7))}>Дальше</Button>
              </div>
            </div>
            <p className="mb-4 text-sm text-muted">
              Свободные окна с шагом {meta.data?.slotStepMinutes ?? 15} минут. Ближайшее — не раньше чем через {meta.data?.leadMinutes ?? 15} минут.
            </p>
            {slots.isLoading ? <p className="text-muted">Считаем свободное время…</p> : null}
            {slots.isError ? <Notice>{slots.error instanceof ApiError ? slots.error.message : 'Не удалось загрузить слоты'}</Notice> : null}
            {slots.data ? (
              <SlotCalendar
                days={days}
                slots={slots.data.slots}
                daysOff={detail.data?.specialist.daysOff ?? []}
                workingWeekdays={detail.data?.specialist.hours.map((hour) => hour.weekday) ?? []}
                selectedStart={selectedStart}
                onSelect={chooseSlot}
              />
            ) : null}
            <section className="mt-6 border border-line bg-card p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Запись</p>
              {selectedSlot && specialist ? (
                <>
                  <h2 className="mt-2 font-serif text-3xl">{formatDateTime(selectedSlot.start)}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {specialist.name} · {current.name} · {formatTime(selectedSlot.start)}–{formatTime(selectedSlot.end)} · {formatPrice(current.priceCents)}
                  </p>
                </>
              ) : (
                <p className="mt-2">Выберите свободное время в календаре.</p>
              )}
              {submitError ? <div className="mt-4"><Notice>{submitError}</Notice></div> : null}
              <div className="mt-4">
                {!user ? (
                  <Link to={`/login?next=${encodeURIComponent(loginNext)}`} className="inline-flex bg-accent px-4 py-2 text-sm font-medium text-white">
                    Войти и записаться
                  </Link>
                ) : null}
                {user?.role === 'admin' ? <p className="text-sm text-muted">Чтобы записаться, войдите как клиент.</p> : null}
                {user?.role === 'client' ? (
                  <Button disabled={!selectedSlot || pending} onClick={() => { void book() }}>
                    {pending ? 'Записываем…' : 'Записаться'}
                  </Button>
                ) : null}
              </div>
              <p className="mt-4 text-sm text-muted">
                Отменить запись можно не позднее чем за {hoursLabel(meta.data?.cancelBeforeHours ?? 2)} до начала.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </>
  )
}
