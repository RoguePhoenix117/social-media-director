import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Building2, Link2, Save, Send, UserRound } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { XApiGuide, XCredentialMappingTable } from '../../components/x-api-guide'
import { bootstrapQueryKey } from '../../lib/bootstrap-query'
import type { PublicSettingsStatus } from '../../lib/server/settings'
import { saveLegacySocialSettings } from '../../server/settings'
import { settingsPageQueryKey } from './settings-query'

const legacyFormSchema = z.object({
  xAccessToken: z.string(),
  xRefreshToken: z.string(),
  linkedinAccessToken: z.string(),
  linkedinAuthorUrn: z.string(),
  linkedinApiVersion: z.string().min(1, 'Enter a LinkedIn REST API version.'),
})

/**
 * @deprecated Removed in PR4 (Connect Channels modal).
 *
 * Manual token paste form. Kept intact in PR2 so existing self-hosted users
 * can still rotate tokens until the Connect Channels OAuth flow ships. Lives
 * here (not in the route file) so the route stays compositional.
 */
export function LegacyPublishingSection({
  settings,
  onSaved,
}: Readonly<{
  settings: PublicSettingsStatus
  onSaved?: (settings: PublicSettingsStatus) => void
}>) {
  const queryClient = useQueryClient()
  const saveFn = useServerFn(saveLegacySocialSettings)
  const [message, setMessage] = useState<string>()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [postingTarget, setPostingTarget] = useState<'person' | 'organization'>('person')

  const form = useForm({
    defaultValues: {
      xAccessToken: '',
      xRefreshToken: '',
      linkedinAccessToken: '',
      linkedinAuthorUrn: '',
      linkedinApiVersion: settings.linkedinApiVersion ?? '202604',
    },
    validators: { onChange: legacyFormSchema },
    onSubmit: async ({ value }) => {
      setMessage(undefined)
      try {
        const nextSettings = await saveFn({
          data: {
            xAccessToken: value.xAccessToken || undefined,
            xRefreshToken: value.xRefreshToken || undefined,
            linkedinAccessToken: value.linkedinAccessToken || undefined,
            linkedinAuthorUrn: value.linkedinAuthorUrn || undefined,
            linkedinApiVersion: value.linkedinApiVersion,
          },
        })
        setHasUnsavedChanges(false)
        await queryClient.invalidateQueries({
          queryKey: settingsPageQueryKey,
          refetchType: 'all',
        })
        await queryClient.invalidateQueries({
          queryKey: bootstrapQueryKey,
          refetchType: 'all',
        })
        form.setFieldValue('xAccessToken', '')
        form.setFieldValue('xRefreshToken', '')
        form.setFieldValue('linkedinAccessToken', '')
        setMessage('Settings saved. Secret fields were cleared from the screen after saving.')
        onSaved?.(nextSettings)
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'Settings failed to save.')
      }
    },
  })

  function markUnsaved() {
    setHasUnsavedChanges(true)
    setMessage(undefined)
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <section className="template-card settings-section" id="x-publishing">
        <div className="panel-heading">
          <Send aria-hidden="true" size={22} />
          <div>
            <h2>X publishing (legacy paste)</h2>
            <p>
              Manual token paste is being replaced by Connect Channels in PR4. Continue
              using these fields until OAuth ships, or move to the Developers section above
              to configure the OAuth app.
            </p>
          </div>
        </div>

        <div className="settings-form-guide">
          <XApiGuide />
        </div>

        <XCredentialMappingTable />

        <form.Field name="xAccessToken">
          {(field) => (
            <label>
              X user access token (OAuth 2.0)
              <input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  markUnsaved()
                  field.handleChange(event.target.value)
                }}
                placeholder={
                  settings.xConfigured
                    ? 'Configured — paste to replace'
                    : 'Paste user Access Token from Authentication Tokens'
                }
                type="password"
                value={field.state.value}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>

        <form.Field name="xRefreshToken">
          {(field) => (
            <label>
              X refresh token (OAuth 2.0, optional)
              <input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  markUnsaved()
                  field.handleChange(event.target.value)
                }}
                placeholder={
                  settings.xRefreshConfigured
                    ? 'Configured — paste to replace'
                    : 'Paste refresh token if you enabled offline.access'
                }
                type="password"
                value={field.state.value}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
      </section>

      <section
        className="template-card settings-section linkedin-settings-section"
        id="linkedin-publishing"
      >
        <div className="panel-heading">
          <Link2 aria-hidden="true" size={22} />
          <div>
            <h2>LinkedIn publishing (legacy paste)</h2>
            <p>
              Choose whether you are posting as yourself or for a company Page, then paste
              the token and author URN from LinkedIn.
            </p>
          </div>
        </div>

        <div className="target-toggle" aria-label="LinkedIn posting target">
          <button
            className={postingTarget === 'person' ? 'selected' : ''}
            onClick={() => setPostingTarget('person')}
            type="button"
          >
            <UserRound aria-hidden="true" size={17} />
            Individual
          </button>
          <button
            className={postingTarget === 'organization' ? 'selected' : ''}
            onClick={() => setPostingTarget('organization')}
            type="button"
          >
            <Building2 aria-hidden="true" size={17} />
            Company Page
          </button>
        </div>

        <div className="setup-callout">
          {postingTarget === 'person' ? (
            <p>
              For an individual profile, create a LinkedIn app, add Share on LinkedIn,
              complete OAuth as yourself, and use an author URN like
              <code>urn:li:person:abc123</code>.
            </p>
          ) : (
            <p>
              For a company Page, confirm your LinkedIn account manages the Page, request
              any required Marketing or Community Management access, and use an author URN
              like <code>urn:li:organization:123456</code>.
            </p>
          )}
        </div>

        <form.Field name="linkedinAccessToken">
          {(field) => (
            <label>
              LinkedIn access token
              <input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  markUnsaved()
                  field.handleChange(event.target.value)
                }}
                placeholder={settings.linkedinConfigured ? 'Configured' : 'Paste OAuth access token'}
                type="password"
                value={field.state.value}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>

        <form.Field name="linkedinAuthorUrn">
          {(field) => (
            <label>
              LinkedIn author URN
              <input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  markUnsaved()
                  field.handleChange(event.target.value)
                }}
                placeholder={
                  postingTarget === 'person'
                    ? 'urn:li:person:abc123'
                    : 'urn:li:organization:123456'
                }
                value={field.state.value}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>

        <form.Field name="linkedinApiVersion">
          {(field) => (
            <label>
              LinkedIn API version
              <input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  markUnsaved()
                  field.handleChange(event.target.value)
                }}
                value={field.state.value}
              />
              <small className="field-guidance">
                Leave this at 202604 unless LinkedIn asks you to use a newer REST API
                version.
              </small>
              <FieldErrors errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
      </section>

      <div className="settings-submit-row">
        {hasUnsavedChanges ? (
          <div className="unsaved-settings-alert" role="status">
            <span aria-hidden="true" />
            Unsaved changes
          </div>
        ) : null}
        <button type="submit">
          <Save aria-hidden="true" size={17} />
          Save settings
        </button>
        {message ? <p className="publish-state">{message}</p> : null}
      </div>
    </form>
  )
}

function FieldErrors({ errors }: Readonly<{ errors: Array<unknown> }>) {
  if (!errors.length) return null
  return (
    <ul className="field-errors">
      {errors.map((error, index) => (
        <li key={index}>{formatFieldError(error)}</li>
      ))}
    </ul>
  )
}

function formatFieldError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'Invalid value.'
}
