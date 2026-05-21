import { queryOptions } from '@tanstack/react-query'
import { getBootstrapState } from '../server/dashboard'
import type { CodexCliStatus } from './server/codex-cli'
import type { OperatorProject } from './server/projects'
import type { PublicProjectChannel } from './server/provider-accounts'
import type { PublicSettingsStatus } from './server/settings'

export const bootstrapQueryKey = ['bootstrap-state'] as const

export function bootstrapQueryOptions() {
  return queryOptions({
    queryKey: bootstrapQueryKey,
    queryFn: () => getBootstrapState(),
    staleTime: 30_000,
  })
}

type BootstrapBase = {
  /** True when both X + LinkedIn OAuth app credentials are configured. */
  instanceConfigured: boolean
  isInstanceOwner: boolean
  /** Currently selected project for the operator (resolved by the server). */
  activeProjectId: string | null
  projects: OperatorProject[]
  connectedChannels: PublicProjectChannel[]
}

export type BootstrapState =
  | (BootstrapBase & {
      databaseAvailable: false
      hasOperator: false
      isAuthenticated: false
      operatorEmail: undefined
      operatorFirstName: undefined
      onboardingStepCompleted: 0
      onboardingDismissed: false
      settings: null
      codexCli: null
    })
  | (BootstrapBase & {
      databaseAvailable: true
      hasOperator: boolean
      isAuthenticated: boolean
      operatorEmail: string | undefined
      operatorFirstName: string | null | undefined
      onboardingStepCompleted: number
      onboardingDismissed: boolean
      settings: PublicSettingsStatus | null
      codexCli: CodexCliStatus | null
    })
