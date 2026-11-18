import { query, queryOne } from '../../db/pool.js'
import { AppError } from '../../lib/errors.js'

type ServiceRow = {
  id: string
  name: string
  description: string
  duration_minutes: number
  price_cents: number
  is_active: boolean
}

export type ServiceDto = {
  id: string
  name: string
  description: string
  durationMinutes: number
  priceCents: number
  isActive: boolean
}

export type ServiceInput = {
  name: string
  description: string
  durationMinutes: number
  priceCents: number
  isActive: boolean
}

function mapService(row: ServiceRow): ServiceDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    isActive: row.is_active,
  }
}

export async function listServices(includeInactive: boolean): Promise<ServiceDto[]> {
  const rows = await query<ServiceRow>(
    `SELECT id, name, description, duration_minutes, price_cents, is_active
     FROM services
     WHERE ($1::boolean = true OR is_active = true)
     ORDER BY duration_minutes, name`,
    [includeInactive],
  )
  return rows.map(mapService)
}

export async function getService(id: string, includeInactive: boolean): Promise<ServiceDto> {
  const row = await queryOne<ServiceRow>(
    `SELECT id, name, description, duration_minutes, price_cents, is_active FROM services WHERE id = $1`,
    [id],
  )
  if (!row || (!row.is_active && !includeInactive)) {
    throw new AppError(404, 'NOT_FOUND', 'Услуга не найдена')
  }
  return mapService(row)
}

export async function createService(input: ServiceInput): Promise<ServiceDto> {
  const row = await queryOne<ServiceRow>(
    `INSERT INTO services (name, description, duration_minutes, price_cents, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, duration_minutes, price_cents, is_active`,
    [input.name, input.description, input.durationMinutes, input.priceCents, input.isActive],
  )
  if (!row) throw new AppError(500, 'INTERNAL', 'Внутренняя ошибка')
  return mapService(row)
}

export async function updateService(id: string, input: ServiceInput): Promise<ServiceDto> {
  const row = await queryOne<ServiceRow>(
    `UPDATE services
     SET name = $2, description = $3, duration_minutes = $4, price_cents = $5, is_active = $6, updated_at = now()
     WHERE id = $1
     RETURNING id, name, description, duration_minutes, price_cents, is_active`,
    [id, input.name, input.description, input.durationMinutes, input.priceCents, input.isActive],
  )
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Услуга не найдена')
  return mapService(row)
}
