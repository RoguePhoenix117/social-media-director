import { queryOptions } from '@tanstack/react-query'
import { getInstanceSetupStatus } from '../../server/setup'

export const instanceSetupQueryKey = ['instance-setup-status'] as const

export function instanceSetupQueryOptions(setupKey?: string) {
  return queryOptions({
    queryKey: [...instanceSetupQueryKey, setupKey ?? null] as const,
    queryFn: () => getInstanceSetupStatus({ data: { setupKey } }),
    staleTime: 5_000,
  })
}
