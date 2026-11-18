import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { ApiError, api } from '../../api/http'
import type { Service } from '../../api/types'
import { Button, controlClass } from '../../components/Button'
import { Notice, PageHeader } from '../../components/PageHeader'
import { centsToInput, formatDuration, formatPrice, rublesToCents } from '../../lib/format'

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(120),
  description: z.string().trim().max(2000),
  durationMinutes: z.number().int().min(15, 'Минимум 15 минут').max(480).refine((value) => value % 15 === 0, 'Длительность кратна 15 минутам'),
  priceCents: z.number().int().min(0, 'Укажите цену в рублях'),
  isActive: z.boolean(),
})

type Draft = {
  id: string | null
  name: string
  description: string
  duration: string
  price: string
  isActive: boolean
}

const emptyDraft: Draft = { id: null, name: '', description: '', duration: '60', price: '', isActive: true }

export function AdminServicesPage() {
  const queryClient = useQueryClient()
  const services = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => api<{ items: Service[] }>('/api/services?all=1'),
  })
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    document.title = 'Каталог — Ателье'
  }, [])

  function edit(service: Service) {
    setDraft({
      id: service.id,
      name: service.name,
      description: service.description,
      duration: String(service.durationMinutes),
      price: centsToInput(service.priceCents),
      isActive: service.isActive,
    })
    setError('')
    setSaved('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const priceCents = rublesToCents(draft.price)
    const parsed = schema.safeParse({
      name: draft.name,
      description: draft.description,
      durationMinutes: Number(draft.duration),
      priceCents: priceCents ?? -1,
      isActive: draft.isActive,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Проверьте поля')
      return
    }
    setPending(true)
    setError('')
    setSaved('')
    try {
      if (draft.id) {
        await api(`/api/services/${draft.id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) })
      } else {
        await api('/api/services', { method: 'POST', body: JSON.stringify(parsed.data) })
        setDraft(emptyDraft)
      }
      await queryClient.invalidateQueries({ queryKey: ['services'] })
      setSaved('Сохранено')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить услугу')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader kicker="Администрирование" title="Каталог услуг" text="Скрытая услуга пропадает из записи, уже созданные брони остаются." />
      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div>
          {services.isLoading ? <p className="text-muted">Загрузка…</p> : null}
          {services.isError ? <Notice>{services.error instanceof ApiError ? services.error.message : 'Не удалось загрузить услуги'}</Notice> : null}
          {services.data?.items.map((service) => (
            <button key={service.id} type="button" onClick={() => edit(service)} className="grid w-full grid-cols-[1fr_auto] gap-3 border-t border-line py-4 text-left">
              <span>
                <span className="block font-serif text-2xl">{service.name}</span>
                <span className="mt-1 block text-sm text-muted">{formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents)}</span>
              </span>
              <span className="text-sm text-muted">{service.isActive ? 'видна' : 'скрыта'}</span>
            </button>
          ))}
        </div>
        <form className="flex flex-col gap-3 border border-line bg-card p-4" onSubmit={(event) => { void submit(event) }}>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">{draft.id ? 'Правка' : 'Новая услуга'}</h2>
            {draft.id ? <button type="button" className="text-sm text-muted" onClick={() => setDraft(emptyDraft)}>Сбросить</button> : null}
          </div>
          {error ? <Notice>{error}</Notice> : null}
          {saved ? <p className="text-sm text-accent">{saved}</p> : null}
          <label className="text-sm">
            <span className="mb-1 block text-muted">Название</span>
            <input className={controlClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Описание</span>
            <textarea className={controlClass} rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Длительность, минуты</span>
            <input className={controlClass} inputMode="numeric" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Цена, ₽</span>
            <input className={controlClass} inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
            Показывать клиентам
          </label>
          <Button type="submit" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить'}</Button>
        </form>
      </div>
    </>
  )
}
