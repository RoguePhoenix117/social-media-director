import { queryOptions } from '@tanstack/react-query'
import { getBootstrapState } from '../server/dashboard'
import type { CodexCliStatus } from './server/codex-cli'
import type { OperatorProject } from './server/projects'
import type { PublicProjectChannel } from './server/provider-accounts'
import type { InstanceOAuthProviders } from './server/instance-config'
import type { DraftCounts, ScheduledPostItem } from './db/draft-types'
import type { RecentPublishItem } from './db/repository'
import type { PublicSettingsStatus } from './server/settings'

export type { DraftCounts }

export const bootstrapQueryKey = ['bootstrap-state'] as const

export type DashboardOverviewData = {
  draftCounts: DraftCounts
  recentPublishes: RecentPublishItem[]
  upcomingScheduled: ScheduledPostItem[]
}

export function bootstrapQueryOptions() {
  return queryOptions({
    queryKey: bootstrapQueryKey,
    queryFn: () => getBootstrapState(),
    staleTime: 30_000,
  })
}

type BootstrapBase = {
  /** True once the deployer finishes Setup Mode (providers are optional). */
  instanceConfigured: boolean
  /** Which OAuth apps the deployer registered — operators can only connect these. */
  instanceOAuthProviders: InstanceOAuthProviders
  isInstanceOwner: boolean
  /** Currently selected project for the operator (resolved by the server). */
  activeProjectId: string | null
  projects: OperatorProject[]
  connectedChannels: PublicProjectChannel[]
  draftCounts: DraftCounts
  recentPublishes: RecentPublishItem[]
  upcomingScheduled: ScheduledPostItem[]
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
      draftCounts: { draft: 0, ready: 0, published: 0, total: 0 }
      recentPublishes: []
      upcomingScheduled: []
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
