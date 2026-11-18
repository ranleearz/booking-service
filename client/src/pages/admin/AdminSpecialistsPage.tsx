import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, api } from '../../api/http'
import type { Service, Specialist, SpecialistDetail } from '../../api/types'
import { Button, controlClass } from '../../components/Button'
import { Notice, PageHeader } from '../../components/PageHeader'
import { formatDayLabel, moscowToday, weekdayLong } from '../../lib/dates'

export function AdminSpecialistsPage() {
  const queryClient = useQueryClient()
  const specialists = useQuery({
    queryKey: ['specialists', 'all'],
    queryFn: () => api<{ items: Specialist[] }>('/api/specialists?all=1'),
  })
  const services = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => api<{ items: Service[] }>('/api/services?all=1'),
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const activeId = selectedId ?? specialists.data?.items[0]?.id ?? null
  const detail = useQuery({
    queryKey: ['specialist', activeId, 'admin'],
    queryFn: () => api<{ specialist: SpecialistDetail }>(`/api/specialists/${activeId}`),
    enabled: Boolean(activeId),
  })

  useEffect(() => {
    document.title = 'Специалисты — Ателье'
  }, [])

  async function createSpecialist(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Укажите имя')
      return
    }
    setPending(true)
    setError('')
    try {
      const created = await api<{ specialist: SpecialistDetail }>('/api/specialists', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), bio: bio.trim(), isActive: true }),
      })
      setName('')
      setBio('')
      setSelectedId(created.specialist.id)
      await queryClient.invalidateQueries({ queryKey: ['specialists'] })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось добавить специалиста')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader
        kicker="Администрирование"
        title="Специалисты"
        text="График задаётся по дням недели. Закрыть день можно, только если на него нет подтверждённых записей. Смена часов уже созданные записи не отменяет."
      />
      <form className="mb-8 grid gap-3 border border-line bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => { void createSpecialist(event) }}>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Имя</span>
          <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Коротко о специалисте</span>
          <input className={controlClass} value={bio} onChange={(event) => setBio(event.target.value)} />
        </label>
        <Button type="submit" disabled={pending}>Добавить</Button>
      </form>
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      {specialists.isLoading ? <p className="text-muted">Загрузка…</p> : null}
      {specialists.isError ? <Notice>{specialists.error instanceof ApiError ? specialists.error.message : 'Не удалось загрузить специалистов'}</Notice> : null}
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <div className="flex flex-col gap-1">
          {specialists.data?.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`px-3 py-2 text-left ${item.id === activeId ? 'bg-card text-accent' : 'hover:bg-card'}`}
            >
              <span className="block">{item.name}</span>
              {!item.isActive ? <span className="text-xs text-muted">скрыт</span> : null}
            </button>
          ))}
        </div>
        {detail.isLoading ? <p className="text-muted">Загрузка карточки…</p> : null}
        {detail.data && services.data ? (
          <SpecialistEditor
            key={detail.data.specialist.id}
            specialist={detail.data.specialist}
            services={services.data.items}
          />
        ) : null}
      </div>
    </>
  )
}

function hoursState(hours: SpecialistDetail['hours']) {
  const state: Record<number, { enabled: boolean; start: string; end: string }> = {}
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const found = hours.find((hour) => hour.weekday === weekday)
    state[weekday] = found
      ? { enabled: true, start: found.startTime, end: found.endTime }
      : { enabled: false, start: '10:00', end: '19:00' }
  }
  return state
}

function SpecialistEditor({ specialist, services }: { specialist: SpecialistDetail; services: Service[] }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(specialist.name)
  const [bio, setBio] = useState(specialist.bio)
  const [isActive, setIsActive] = useState(specialist.isActive)
  const [serviceIds, setServiceIds] = useState(specialist.serviceIds)
  const [hours, setHours] = useState(() => hoursState(specialist.hours))
  const [day, setDay] = useState(moscowToday())
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function save(task: () => Promise<void>, success: string) {
    setPending(true)
    setError('')
    setMessage('')
    try {
      await task()
      await queryClient.invalidateQueries({ queryKey: ['specialists'] })
      await queryClient.invalidateQueries({ queryKey: ['specialist', specialist.id] })
      await queryClient.invalidateQueries({ queryKey: ['slots'] })
      setMessage(success)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? <Notice>{error}</Notice> : null}
      {message ? <p className="text-sm text-accent">{message}</p> : null}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-3xl">Профиль</h2>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Имя</span>
          <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">О специалисте</span>
          <textarea className={controlClass} rows={3} value={bio} onChange={(event) => setBio(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Принимает запись
        </label>
        <div>
          <Button
            disabled={pending}
            onClick={() => {
              void save(async () => {
                await api(`/api/specialists/${specialist.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ name: name.trim(), bio: bio.trim(), isActive }),
                })
              }, 'Профиль сохранён')
            }}
          >
            Сохранить профиль
          </Button>
        </div>
      </section>
      <section>
        <h2 className="font-serif text-3xl">Услуги</h2>
        <div className="mt-3 flex flex-col gap-2">
          {services.map((service) => {
            const checked = serviceIds.includes(service.id)
            return (
              <label key={service.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    setServiceIds((current) => event.target.checked
                      ? [...current, service.id]
                      : current.filter((item) => item !== service.id))
                  }}
                />
                <span>{service.name}</span>
                {!service.isActive ? <span className="text-muted">скрыта</span> : null}
              </label>
            )
          })}
        </div>
        <Button
          className="mt-3"
          disabled={pending}
          onClick={() => {
            void save(async () => {
              await api(`/api/specialists/${specialist.id}/services`, {
                method: 'PUT',
                body: JSON.stringify({ serviceIds }),
              })
            }, 'Услуги сохранены')
          }}
        >
          Сохранить услуги
        </Button>
      </section>
      <section>
        <h2 className="font-serif text-3xl">Неделя</h2>
        <div className="mt-3 flex flex-col gap-2">
          {Object.entries(hours).map(([weekday, value]) => (
            <div key={weekday} className="grid items-center gap-2 sm:grid-cols-[10rem_auto_1fr_1fr]">
              <span className="text-sm">{weekdayLong(Number(weekday))}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.enabled}
                  onChange={(event) => setHours((current) => ({
                    ...current,
                    [weekday]: { ...current[Number(weekday)], enabled: event.target.checked },
                  }))}
                />
                работает
              </label>
              <input
                type="time"
                className={controlClass}
                value={value.start}
                disabled={!value.enabled}
                onChange={(event) => setHours((current) => ({
                  ...current,
                  [weekday]: { ...current[Number(weekday)], start: event.target.value },
                }))}
              />
              <input
                type="time"
                className={controlClass}
                value={value.end}
                disabled={!value.enabled}
                onChange={(event) => setHours((current) => ({
                  ...current,
                  [weekday]: { ...current[Number(weekday)], end: event.target.value },
                }))}
              />
            </div>
          ))}
        </div>
        <Button
          className="mt-3"
          disabled={pending}
          onClick={() => {
            const payload = Object.entries(hours)
              .filter(([, value]) => value.enabled)
              .map(([weekday, value]) => ({ weekday: Number(weekday), startTime: value.start, endTime: value.end }))
            if (payload.some((item) => item.endTime <= item.startTime)) {
              setError('Конец рабочего дня должен быть позже начала')
              return
            }
            void save(async () => {
              await api(`/api/specialists/${specialist.id}/hours`, {
                method: 'PUT',
                body: JSON.stringify({ hours: payload }),
              })
            }, 'График сохранён')
          }}
        >
          Сохранить график
        </Button>
      </section>
      <section>
        <h2 className="font-serif text-3xl">Выходные</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            void save(async () => {
              await api(`/api/specialists/${specialist.id}/days-off`, {
                method: 'POST',
                body: JSON.stringify({ day }),
              })
            }, 'День закрыт')
          }}
        >
          <input type="date" className={controlClass} value={day} onChange={(event) => setDay(event.target.value)} />
          <Button type="submit" disabled={pending}>Закрыть день</Button>
        </form>
        <ul className="mt-4">
          {specialist.daysOff.length === 0 ? <li className="text-sm text-muted">Закрытых дней нет.</li> : null}
          {specialist.daysOff.map((item) => (
            <li key={item} className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm">
              <span className={item < moscowToday() ? 'text-muted' : ''}>{formatDayLabel(item)}</span>
              <button
                type="button"
                className="text-accent"
                onClick={() => {
                  void save(async () => {
                    await api(`/api/specialists/${specialist.id}/days-off/${item}`, { method: 'DELETE' })
                  }, 'День снова открыт')
                }}
              >
                Открыть
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
