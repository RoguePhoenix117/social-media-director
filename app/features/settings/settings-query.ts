import { queryOptions } from '@tanstack/react-query'
import { getDeveloperSettings } from '../../server/setup'
import { getSettingsPageState } from '../../server/settings'

export const settingsPageQueryKey = ['settings-page-state'] as const

export function settingsPageQueryOptions() {
  return queryOptions({
    queryKey: settingsPageQueryKey,
    queryFn: () => getSettingsPageState(),
  })
}

export const developerSettingsQueryKey = ['developer-settings'] as const

export function developerSettingsQueryOptions(options?: { enabled?: boolean }) {
  return queryOptions({
    queryKey: developerSettingsQueryKey,
    queryFn: () => getDeveloperSettings(),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  })
}
