import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { KeyRound, Save, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { bootstrapQueryKey } from '../../lib/bootstrap-query'
import { instanceSetupQueryKey } from '../setup/setup-query'
import { ProviderCredentialFields } from '../setup/provider-credential-fields'
import { saveDeveloperSettings } from '../../server/setup'
import { developerSettingsQueryOptions } from './settings-query'

/**
 * Settings → Developers section. Visible only to the instance owner. Lets the
 * owner edit OAuth app credentials post-setup. Env-sourced credentials render
 * as read-only badges (see ProviderCredentialFields). Secrets are never
 * surfaced — saving leaves the field blank means "keep existing".
 */
export function DevelopersSection({
  isInstanceOwner,
}: Readonly<{ isInstanceOwner: boolean }>) {
  const queryClient = useQueryClient()
  const saveFn = useServerFn(saveDeveloperSettings)
  const developerQuery = useQuery(developerSettingsQueryOptions({ enabled: isInstanceOwner }))
  const [xClientId, setXClientId] = useState('')
  const [xClientSecret, setXClientSecret] = useState('')
  const [linkedinClientId, setLinkedinClientId] = useState('')
  const [linkedinClientSecret, setLinkedinClientSecret] = useState('')
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  if (!isInstanceOwner) return null

  if (developerQuery.isLoading) {
    return (
      <section className="template-card settings-section" id="developers">
        <div className="panel-heading">
          <KeyRound aria-hidden="true" size={22} />
          <div>
            <h2>Developers</h2>
            <p>Loading OAuth app configuration…</p>
          </div>
        </div>
      </section>
    )
  }

  const data = developerQuery.data
  if (!data || developerQuery.error) {
    return (
      <section className="template-card settings-section" id="developers">
        <div className="panel-heading">
          <ShieldAlert aria-hidden="true" size={22} />
          <div>
            <h2>Developers</h2>
            <p className="error">
              {developerQuery.error instanceof Error
                ? developerQuery.error.message
                : 'Could not load developer settings.'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  async function onSave() {
    setMessage(undefined)
    setError(undefined)
    setIsSaving(true)
    try {
      const next = await saveFn({
        data: {
          xClientId: xClientId || undefined,
          xClientSecret: xClientSecret || undefined,
          linkedinClientId: linkedinClientId || undefined,
          linkedinClientSecret: linkedinClientSecret || undefined,
        },
      })
      queryClient.setQueryData(developerSettingsQueryOptions().queryKey, next)
      setXClientSecret('')
      setLinkedinClientSecret('')
      setMessage('Developer credentials saved.')
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey })
      await queryClient.invalidateQueries({ queryKey: instanceSetupQueryKey })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="template-card settings-section" id="developers">
      <div className="panel-heading">
        <KeyRound aria-hidden="true" size={22} />
        <div>
          <h2>Developers</h2>
          <p>
            OAuth app credentials used when end users connect their channels. Env vars
            (<code>X_CLIENT_ID</code>, <code>X_CLIENT_SECRET</code>,{' '}
            <code>LINKEDIN_CLIENT_ID</code>, <code>LINKEDIN_CLIENT_SECRET</code>)
            override these DB values.
          </p>
        </div>
      </div>

      <div className="developer-provider-grid">
        <div>
          <h3>X (Twitter)</h3>
          <ProviderCredentialFields
            callbackUrl={data.callbackUrls.x}
            clientId={xClientId}
            clientSecret={xClientSecret}
            onClientIdChange={(event) => setXClientId(event.target.value)}
            onClientSecretChange={(event) => setXClientSecret(event.target.value)}
            provider="x"
            status={data.providers.x}
          />
        </div>

        <div>
          <h3>LinkedIn</h3>
          <ProviderCredentialFields
            callbackUrl={data.callbackUrls.linkedin}
            clientId={linkedinClientId}
            clientSecret={linkedinClientSecret}
            onClientIdChange={(event) => setLinkedinClientId(event.target.value)}
            onClientSecretChange={(event) => setLinkedinClientSecret(event.target.value)}
            provider="linkedin"
            status={data.providers.linkedin}
          />
        </div>
      </div>

      <div className="settings-submit-row">
        <button disabled={isSaving} onClick={() => void onSave()} type="button">
          <Save aria-hidden="true" size={17} />
          {isSaving ? 'Saving…' : 'Save developer credentials'}
        </button>
        {message ? <p className="publish-state">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </section>
  )
}
