import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../api/http'
import type { Service } from '../api/types'
import { Notice, PageHeader } from '../components/PageHeader'
import { formatDuration, formatPrice } from '../lib/format'

export function CatalogPage() {
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => api<{ items: Service[] }>('/api/services'),
  })

  useEffect(() => {
    document.title = 'Услуги — Ателье'
  }, [])

  return (
    <>
      <PageHeader
        kicker="Студия на Никитской"
        title="Запись на услугу"
        text="Выберите услугу, специалиста и свободное время. Подтверждение и отмена появятся в уведомлениях."
      />
      {services.isLoading ? <p className="text-muted">Загрузка…</p> : null}
      {services.isError ? <Notice>{services.error instanceof ApiError ? services.error.message : 'Не удалось загрузить услуги'}</Notice> : null}
      {services.data && services.data.items.length === 0 ? <p className="text-muted">Услуг пока нет.</p> : null}
      <div className="border-b border-line">
        {services.data?.items.map((service, index) => (
          <Link
            key={service.id}
            to={`/services/${service.id}`}
            className="group grid gap-3 border-t border-line py-6 sm:grid-cols-[4rem_1fr_auto] sm:items-start sm:gap-6"
          >
            <span className="font-serif text-2xl text-muted">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <span className="block font-serif text-3xl leading-tight group-hover:text-accent">{service.name}</span>
              <span className="mt-2 block max-w-xl text-sm leading-6 text-muted">{service.description}</span>
            </span>
            <span className="text-sm sm:text-right">
              <span className="block">{formatDuration(service.durationMinutes)}</span>
              <span className="mt-1 block font-medium">{formatPrice(service.priceCents)}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
