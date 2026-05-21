import { queryOptions } from '@tanstack/react-query'
import { getBootstrapState } from '../server/dashboard'
import type { CodexCliStatus } from './server/codex-cli'
import type { PublicSettingsStatus } from './server/settings'

export const bootstrapQueryKey = ['bootstrap-state'] as const

export function bootstrapQueryOptions() {
  return queryOptions({
    queryKey: bootstrapQueryKey,
    queryFn: () => getBootstrapState(),
    staleTime: 30_000,
  })
}

export type BootstrapState =
  | {
      databaseAvailable: false
      hasOperator: false
      isAuthenticated: false
      operatorEmail: undefined
      operatorFirstName: undefined
      onboardingStepCompleted: 0
      onboardingDismissed: false
      settings: null
      codexCli: null
    }
  | {
      databaseAvailable: true
      hasOperator: boolean
      isAuthenticated: boolean
      operatorEmail: string | undefined
      operatorFirstName: string | null | undefined
      onboardingStepCompleted: number
      onboardingDismissed: boolean
      settings: PublicSettingsStatus | null
      codexCli: CodexCliStatus | null
    }
