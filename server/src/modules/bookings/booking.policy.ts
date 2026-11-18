export function canClientCancel(startsAt: Date, now: Date, hoursBefore: number): boolean {
  const start = startsAt.getTime()
  if (Number.isNaN(start) || Number.isNaN(now.getTime())) return false
  return start - now.getTime() >= hoursBefore * 60 * 60 * 1000
}
