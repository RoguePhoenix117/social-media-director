import { useForm } from '@tanstack/react-form'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { z } from 'zod'
import { accountStepFormSchema, accountStepInputSchema } from '../../lib/dashboard-schemas'
import { PASSWORD_MIN_LENGTH } from '../../lib/password-schema'
import { DebouncedFieldErrors } from '../debounced-field-errors'
import { PasswordInput } from '../password-input'

export type AccountStepInput = z.infer<typeof accountStepInputSchema>

/**
 * Step 1 — sign up the first operator. Form-only component; the parent
 * onboarding wizard owns the server mutation and step advancement.
 */
export function AccountStep({
  onSave,
}: Readonly<{
  onSave: (data: AccountStepInput) => Promise<void>
}>) {
  const [error, setError] = useState<string>()
  const [showPasswordFieldErrors, setShowPasswordFieldErrors] = useState(false)
  const [showConfirmPasswordErrors, setShowConfirmPasswordErrors] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
    },
    validators: { onChange: accountStepFormSchema },
    onSubmitInvalid: () => {
      setShowPasswordFieldErrors(true)
      setShowConfirmPasswordErrors(true)
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setIsSubmitting(true)
      try {
        const { confirmPassword: _confirmPassword, ...accountData } = value
        await onSave(accountData)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Account setup failed.')
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <div className="onboarding-step-content">
      <div className="panel-heading">
        <UserPlus aria-hidden="true" size={22} />
        <div>
          <h2>Create your operator account</h2>
          <p>
            This is your local login for the self-hosted dashboard. It is separate from
            OpenAI, X, and LinkedIn.
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <div className="form-grid form-grid--account">
          <form.Field name="email">
            {(field) => (
              <label className="form-field">
                <span className="field-label">Operator email</span>
                <input
                  autoComplete="username"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={field.state.value}
                />
                <div className="field-messages">
                  <small className="field-guidance">
                    Use the email you want for dashboard login and recovery context.
                  </small>
                  <FieldErrors errors={field.state.meta.errors} />
                </div>
              </label>
            )}
          </form.Field>
          <form.Field name="firstName">
            {(field) => (
              <label className="form-field">
                <span className="field-label">
                  First name <span className="optional-label">Optional</span>
                </span>
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <div className="field-messages">
                  <FieldErrors errors={field.state.meta.errors} />
                </div>
              </label>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <label className="form-field">
                <span className="field-label">Password</span>
                <PasswordInput
                  autoComplete="new-password"
                  name={field.name}
                  onBlur={() => {
                    field.handleBlur()
                    setShowPasswordFieldErrors(true)
                  }}
                  onChange={(event) => {
                    setShowPasswordFieldErrors(false)
                    field.handleChange(event.target.value)
                  }}
                  required
                  value={field.state.value}
                />
                <div className="field-messages field-messages--requirements">
                  <small className="field-guidance">
                    Use {PASSWORD_MIN_LENGTH}+ characters with a letter, number, and symbol.
                  </small>
                  <DebouncedFieldErrors
                    errors={field.state.meta.errors}
                    showImmediately={showPasswordFieldErrors}
                    value={field.state.value}
                  />
                </div>
              </label>
            )}
          </form.Field>
          <form.Field name="confirmPassword">
            {(field) => (
              <label className="form-field">
                <span className="field-label">Confirm password</span>
                <PasswordInput
                  autoComplete="new-password"
                  name={field.name}
                  onBlur={() => {
                    field.handleBlur()
                    setShowConfirmPasswordErrors(true)
                  }}
                  onChange={(event) => {
                    setShowConfirmPasswordErrors(false)
                    field.handleChange(event.target.value)
                  }}
                  required
                  value={field.state.value}
                />
                <div className="field-messages">
                  <small className="field-guidance">Re-enter the same password to confirm.</small>
                  <DebouncedFieldErrors
                    errors={field.state.meta.errors}
                    showImmediately={showConfirmPasswordErrors}
                    value={field.state.value}
                  />
                </div>
              </label>
            )}
          </form.Field>
        </div>
        <div className="button-row">
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Creating…' : 'Save account'}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
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
