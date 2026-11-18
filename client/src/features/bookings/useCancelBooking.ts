import { useQueryClient } from '@tanstack/react-query'
import { useState, useTransition } from 'react'
import { ApiError, api } from '../api/http'

export function useCancelBooking() {
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()

  function cancel(id: string, reason: string, mark: (bookingId: string) => void) {
    setError('')
    setPendingId(id)
    startTransition(async () => {
      mark(id)
      try {
        await api(`/api/bookings/${id}/cancel`, {
          method: 'POST',
          body: JSON.stringify(reason ? { reason } : {}),
        })
        await queryClient.invalidateQueries({ queryKey: ['bookings'] })
        await queryClient.invalidateQueries({ queryKey: ['notifications'] })
        await queryClient.invalidateQueries({ queryKey: ['slots'] })
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Не удалось отменить запись')
      } finally {
        setPendingId(null)
      }
    })
  }

  return { pendingId, error, cancel }
}
