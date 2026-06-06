import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ActiveAiBackendControl } from '../../components/active-ai-backend-control'
import { AiWorkspace } from '../../components/ai-workspace'
import { AppLayout } from '../../components/app-layout'
import { ChannelProgressButton } from '../../components/channel-progress-button'
import { ConnectChannelsModal } from '../../components/connect-channels/connect-channels-modal'
import { OnboardingWizard } from '../../components/onboarding/onboarding-wizard'
import {
  OperatorAuthScreen,
  type AuthTab,
} from '../../components/onboarding/operator-auth-screen'
import { ProjectSwitcher } from '../../components/project-switcher'
import {
  bootstrapQueryKey,
  bootstrapQueryOptions,
  type BootstrapState,
} from '../../lib/bootstrap-query'
import { countEnabledChannelSlots } from '../../lib/channel-catalog'
import { ONBOARDING_STEPS } from '../../lib/onboarding-steps'
import {
  dismissOnboardingWizard,
  getBootstrapState,
  loginOperator,
  logoutOperator,
  saveAccountStep,
} from '../../server/dashboard'
import {
  completeChannelsStep,
  completeOnboarding,
  createProjectStep,
  setActiveProject,
  type OnboardingStepResult,
} from '../../server/projects'
import { settingsPageQueryKey } from '../settings/settings-query'
import { Link } from '@tanstack/react-router'
import { FileEdit, Send } from 'lucide-react'
import { DashboardOverview } from './dashboard-overview'
import { DashboardStatusGrid } from './dashboard-status-grid'
import { DatabaseSetupScreen } from './database-setup-screen'

/**
 * Authenticated dashboard composition. Handles three auth states:
 *
 *  1. DB unreachable → setup screen
 *  2. No operator yet → first-run onboarding wizard
 *  3. Operator exists but no session → login
 *  4. Authenticated → topbar + status grid + (resume wizard?) + workspace
 *
 * All mutations are delegated to server fns and reflected in the bootstrap
 * cache via `updateBootstrapState`. Keeps this file thin so the route stays
 * compositional.
 */
type BootstrapLoaderData = Awaited<ReturnType<typeof getBootstrapState>>

type DashboardSearch = {
  auth?: AuthTab
  redirect?: string
}

export function DashboardScreen({
  bootstrap,
  search,
}: Readonly<{ bootstrap: BootstrapLoaderData; search: DashboardSearch }>) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: authState, refetch: refetchBootstrap } = useQuery({
    ...bootstrapQueryOptions(),
    initialData: bootstrap,
  })

  const saveAccountStepFn = useServerFn(saveAccountStep)
  const createProjectStepFn = useServerFn(createProjectStep)
  const completeChannelsStepFn = useServerFn(completeChannelsStep)
  const completeOnboardingFn = useServerFn(completeOnboarding)
  const dismissOnboardingWizardFn = useServerFn(dismissOnboardingWizard)
  const loginOperatorFn = useServerFn(loginOperator)
  const logoutOperatorFn = useServerFn(logoutOperator)
  const setActiveProjectFn = useServerFn(setActiveProject)

  const [channelsModalOpen, setChannelsModalOpen] = useState(false)

  function updateBootstrapState(
    next: BootstrapState | ((current: BootstrapState) => BootstrapState),
  ) {
    queryClient.setQueryData<BootstrapState>(bootstrapQueryKey, (current) => {
      const existing = current ?? authState
      return typeof next === 'function' ? next(existing) : next
    })
  }

  function applyOnboardingResult(result: OnboardingStepResult) {
    updateBootstrapState((current) => {
      if (!current.databaseAvailable) return current
      return {
        ...current,
        onboardingStepCompleted: result.onboardingStepCompleted,
        onboardingDismissed: result.onboardingDismissed,
        activeProjectId: result.activeProjectId,
        projects: result.projects,
        connectedChannels: result.connectedChannels,
        settings: result.settings,
      }
    })
  }

  if (!authState.databaseAvailable) {
    return <DatabaseSetupScreen onRetry={() => void refetchBootstrap()} />
  }

  async function afterAuthSuccess() {
    await refetchBootstrap()
    const refreshed = queryClient.getQueryData<BootstrapState>(bootstrapQueryKey) ?? authState
    const returnPath = search.redirect
    const onboardingDone =
      refreshed.onboardingStepCompleted >= ONBOARDING_STEPS.complete ||
      refreshed.onboardingDismissed
    if (returnPath && returnPath.startsWith('/') && onboardingDone) {
      void navigate({ href: returnPath })
    }
  }

  if (!authState.isAuthenticated) {
    const defaultTab: AuthTab =
      search.auth ?? (authState.hasOperator ? 'login' : 'signup')

    if (!authState.hasOperator) {
      return (
        <OperatorAuthScreen
          defaultTab={defaultTab}
          hasOperator={false}
          redirectAfterAuth={search.redirect}
          onLogin={async () => {
            /* no operator yet */
          }}
          onSignUp={async (data) => {
            const result = await saveAccountStepFn({ data })
            updateBootstrapState({
              databaseAvailable: true,
              hasOperator: true,
              isAuthenticated: true,
              operatorEmail: data.email.toLowerCase(),
              operatorFirstName: data.firstName ? data.firstName : null,
              onboardingStepCompleted: result.onboardingStepCompleted,
              onboardingDismissed: false,
              settings: result.settings,
              codexCli: result.codexCli,
              instanceConfigured: authState.instanceConfigured,
              instanceOAuthProviders: authState.instanceOAuthProviders,
              isInstanceOwner: true,
              activeProjectId: null,
              projects: [],
              connectedChannels: [],
              draftCounts: { draft: 0, ready: 0, published: 0, total: 0 },
              recentPublishes: [],
              upcomingScheduled: [],
            })
            await afterAuthSuccess()
          }}
        />
      )
    }

    return (
      <OperatorAuthScreen
        defaultTab={defaultTab}
        hasOperator
        redirectAfterAuth={search.redirect}
        onLogin={async (data) => {
          const result = await loginOperatorFn({ data })
          updateBootstrapState({
            databaseAvailable: true,
            hasOperator: true,
            isAuthenticated: true,
            operatorEmail: data.email.toLowerCase(),
            operatorFirstName: result.firstName,
            onboardingStepCompleted: result.onboardingStepCompleted,
            onboardingDismissed: result.onboardingDismissed,
            settings: result.settings,
            codexCli: result.codexCli,
            instanceConfigured: authState.instanceConfigured,
            instanceOAuthProviders: authState.instanceOAuthProviders,
            isInstanceOwner: authState.isInstanceOwner,
            activeProjectId: result.activeProjectId,
            projects: result.projects,
            connectedChannels: result.connectedChannels,
            draftCounts: { draft: 0, ready: 0, published: 0, total: 0 },
            recentPublishes: [],
            upcomingScheduled: [],
          })
          await afterAuthSuccess()
        }}
        onSignUp={async () => {
          /* handled by tab message when hasOperator */
        }}
      />
    )
  }

  const displayName = authState.operatorFirstName
    ? authState.operatorFirstName
    : authState.operatorEmail ?? 'Signed in'
  const onboardingActive =
    authState.onboardingStepCompleted < ONBOARDING_STEPS.complete && !authState.onboardingDismissed

  async function onLogout() {
    await logoutOperatorFn()
    updateBootstrapState({
      databaseAvailable: true,
      hasOperator: true,
      isAuthenticated: false,
      operatorEmail: undefined,
      operatorFirstName: undefined,
      onboardingStepCompleted: 0,
      onboardingDismissed: false,
      settings: null,
      codexCli: null,
      instanceConfigured: authState.instanceConfigured,
      instanceOAuthProviders: authState.instanceOAuthProviders,
      isInstanceOwner: false,
      activeProjectId: null,
      projects: [],
      connectedChannels: [],
      draftCounts: { draft: 0, ready: 0, published: 0, total: 0 },
      recentPublishes: [],
      upcomingScheduled: [],
    })
  }

  const totalChannelSlots = countEnabledChannelSlots(authState.instanceOAuthProviders)

  async function onSwitchProject(projectId: string) {
    const result = await setActiveProjectFn({ data: { projectId } })
    applyOnboardingResult(result)
    await queryClient.invalidateQueries({ queryKey: settingsPageQueryKey, refetchType: 'all' })
    if (result.connectedChannels.length === 0 && totalChannelSlots > 0) {
      setChannelsModalOpen(true)
    }
  }

  return (
    <AppLayout
      onLogout={() => void onLogout()}
      operatorName={displayName}
      projectSwitcher={
        authState.projects.length > 0 ? (
          <ProjectSwitcher
            activeProjectId={authState.activeProjectId}
            onSwitch={onSwitchProject}
            projects={authState.projects}
            totalChannelSlots={totalChannelSlots}
          />
        ) : null
      }
    >
      <header className="topbar">
        <div>
          <p className="eyebrow">MVP V1</p>
          <h1>Welcome to your Dashboard, {displayName}</h1>
          <p className="page-summary">
            Overview of your project, channels, and recent activity. Create and edit
            content on Draft; publish or schedule on Post.
          </p>
        </div>
        {totalChannelSlots > 0 ? (
          <ChannelProgressButton
            connectedCount={authState.connectedChannels.length}
            onClick={() => setChannelsModalOpen(true)}
            totalSlots={totalChannelSlots}
          />
        ) : null}
      </header>

      <DashboardStatusGrid
        draftCount={authState.draftCounts.total}
        instanceOAuthProviders={authState.instanceOAuthProviders}
        onChannelsClick={() => setChannelsModalOpen(true)}
        settings={authState.settings}
      />

      {authState.activeProjectId ? (
        <DashboardOverview
          data={{
            draftCounts: authState.draftCounts,
            recentPublishes: authState.recentPublishes,
            upcomingScheduled: authState.upcomingScheduled,
          }}
        />
      ) : null}

      {onboardingActive ? (
        <OnboardingWizard
          codexCli={authState.codexCli}
          connectedChannels={authState.connectedChannels}
          instanceOAuthProviders={authState.instanceOAuthProviders}
          mode="resume"
          projectCount={authState.projects.length}
          onCompleteChannels={async () => {
            applyOnboardingResult(await completeChannelsStepFn())
          }}
          onCompleteOnboarding={async () => {
            applyOnboardingResult(await completeOnboardingFn())
          }}
          onCreateProject={async (input) => {
            applyOnboardingResult(await createProjectStepFn({ data: input }))
          }}
          onDismiss={async () => {
            await dismissOnboardingWizardFn()
            updateBootstrapState((current) => {
              if (!current.databaseAvailable) return current
              return { ...current, onboardingDismissed: true }
            })
          }}
          onboardingStepCompleted={authState.onboardingStepCompleted}
          settings={authState.settings}
        />
      ) : null}

      {authState.settings ? (
        authState.settings.configuredAiBackendTypes.length > 0 ? (
          <ActiveAiBackendControl
            onChange={(nextSettings) => {
              updateBootstrapState((current) => {
                if (!current.databaseAvailable) return current
                return { ...current, settings: nextSettings }
              })
            }}
            settings={authState.settings}
          />
        ) : (
          <AiWorkspace
            codexCli={authState.codexCli}
            compactIntro
            onSaved={(nextSettings) => {
              updateBootstrapState((current) => {
                if (!current.databaseAvailable) return current
                return { ...current, settings: nextSettings }
              })
            }}
            settings={authState.settings}
          />
        )
      ) : null}

      <section className="dashboard-quick-actions">
        <Link className="quick-action-card" to="/draft">
          <FileEdit aria-hidden="true" size={22} />
          <div>
            <h3>Drafts</h3>
            <p>Import URLs, edit platform copy, mark ready.</p>
          </div>
        </Link>
        <Link className="quick-action-card" to="/post">
          <Send aria-hidden="true" size={22} />
          <div>
            <h3>Post calendar</h3>
            <p>Publish now or schedule ready drafts.</p>
          </div>
        </Link>
      </section>

      <ConnectChannelsModal
        connectedChannels={authState.connectedChannels}
        instanceOAuthProviders={authState.instanceOAuthProviders}
        onClose={() => setChannelsModalOpen(false)}
        onContinue={() => setChannelsModalOpen(false)}
        open={channelsModalOpen}
      />
    </AppLayout>
  )
}
