import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ActiveAiBackendControl } from '../../components/active-ai-backend-control'
import { AiWorkspace } from '../../components/ai-workspace'
import { AppLayout } from '../../components/app-layout'
import { ChannelProgressButton } from '../../components/channel-progress-button'
import { ConnectChannelsModal } from '../../components/connect-channels/connect-channels-modal'
import { OnboardingWizard } from '../../components/onboarding/onboarding-wizard'
import { LoginScreen } from '../../components/onboarding/login-screen'
import { ProjectSwitcher } from '../../components/project-switcher'
import {
  bootstrapQueryKey,
  bootstrapQueryOptions,
  type BootstrapState,
} from '../../lib/bootstrap-query'
import { TOTAL_CHANNEL_SLOTS } from '../../lib/channel-catalog'
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
import { DashboardStatusGrid } from './dashboard-status-grid'
import { DatabaseSetupScreen } from './database-setup-screen'
import { ImportWorkspace } from './import-workspace'

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

export function DashboardScreen({ bootstrap }: Readonly<{ bootstrap: BootstrapLoaderData }>) {
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

  if (!authState.hasOperator) {
    return (
      <OnboardingWizard
        codexCli={authState.codexCli}
        connectedChannels={[]}
        mode="first-run"
        onAccountSave={async (data) => {
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
            isInstanceOwner: true,
            activeProjectId: null,
            projects: [],
            connectedChannels: [],
          })
        }}
        onCreateProject={async (input) => {
          applyOnboardingResult(await createProjectStepFn({ data: input }))
        }}
        onCompleteChannels={async () => {
          applyOnboardingResult(await completeChannelsStepFn())
        }}
        onCompleteOnboarding={async () => {
          applyOnboardingResult(await completeOnboardingFn())
        }}
        onboardingStepCompleted={0}
        settings={null}
      />
    )
  }

  if (!authState.isAuthenticated) {
    return (
      <LoginScreen
        onSubmit={async (data) => {
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
            isInstanceOwner: authState.isInstanceOwner,
            activeProjectId: authState.activeProjectId,
            projects: authState.projects,
            connectedChannels: authState.connectedChannels,
          })
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
      isInstanceOwner: false,
      activeProjectId: null,
      projects: [],
      connectedChannels: [],
    })
  }

  async function onSwitchProject(projectId: string) {
    const result = await setActiveProjectFn({ data: { projectId } })
    applyOnboardingResult(result)
    await queryClient.invalidateQueries({ queryKey: settingsPageQueryKey, refetchType: 'all' })
    // Auto-open Connect Channels for any project that still needs OAuth — covers
    // both the "just created a 2nd project" UX and switching back to a project
    // whose channels haven't been connected yet.
    if (result.connectedChannels.length === 0) {
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
            totalChannelSlots={TOTAL_CHANNEL_SLOTS}
          />
        ) : null
      }
    >
      <header className="topbar">
        <div>
          <p className="eyebrow">MVP V1</p>
          <h1>Welcome to your Dashboard, {displayName}</h1>
          <p className="page-summary">
            Import a public post, shape it with AI, and publish channel-ready drafts
            from one self-hosted dashboard.
          </p>
        </div>
        <ChannelProgressButton
          connectedCount={authState.connectedChannels.length}
          onClick={() => setChannelsModalOpen(true)}
        />
      </header>

      <DashboardStatusGrid
        draftCount={0}
        onChannelsClick={() => setChannelsModalOpen(true)}
        settings={authState.settings}
      />

      {onboardingActive ? (
        <OnboardingWizard
          codexCli={authState.codexCli}
          connectedChannels={authState.connectedChannels}
          mode="resume"
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

      <ImportWorkspace
        key={authState.activeProjectId ?? 'no-project'}
        settings={authState.settings}
      />

      <ConnectChannelsModal
        connectedChannels={authState.connectedChannels}
        onClose={() => setChannelsModalOpen(false)}
        onContinue={() => setChannelsModalOpen(false)}
        open={channelsModalOpen}
      />
    </AppLayout>
  )
}
