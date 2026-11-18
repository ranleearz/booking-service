import { useQuery } from '@tanstack/react-query'
import { api } from './http'
import type { Meta } from './types'

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => api<Meta>('/api/meta'),
    staleTime: Infinity,
  })
}
