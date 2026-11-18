function plural(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const parts: string[] = []
  if (hours) parts.push(`${hours} ${plural(hours, 'час', 'часа', 'часов')}`)
  if (rest) parts.push(`${rest} ${plural(rest, 'минута', 'минуты', 'минут')}`)
  return parts.join(' ') || '0 минут'
}

export function hoursLabel(value: number): string {
  return `${value} ${plural(value, 'час', 'часа', 'часов')}`
}

export function rublesToCents(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return null
  return cents
}

export function centsToInput(cents: number): string {
  const rubles = cents / 100
  return Number.isInteger(rubles) ? String(rubles) : rubles.toFixed(2).replace('.', ',')
}
