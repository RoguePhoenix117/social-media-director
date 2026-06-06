import { useForm } from '@tanstack/react-form'
import { useEffect, useState } from 'react'
import type { z } from 'zod'
import {
  accountStepFormSchema,
  accountStepInputSchema,
  loginInputSchema,
} from '../../lib/dashboard-schemas'
import { PASSWORD_MIN_LENGTH } from '../../lib/password-schema'
import { DebouncedFieldErrors } from '../debounced-field-errors'
import { PasswordInput } from '../password-input'

export type AuthTab = 'login' | 'signup'

type LoginInput = z.infer<typeof loginInputSchema>
type SignUpInput = z.infer<typeof accountStepInputSchema>

export function OperatorAuthScreen({
  defaultTab,
  hasOperator,
  redirectAfterAuth,
  onLogin,
  onSignUp,
}: Readonly<{
  defaultTab: AuthTab
  hasOperator: boolean
  /** Path to navigate after successful sign-in (e.g. `/post`). */
  redirectAfterAuth?: string
  onLogin: (data: LoginInput) => Promise<void>
  onSignUp: (data: SignUpInput) => Promise<void>
}>) {
  const [activeTab, setActiveTab] = useState<AuthTab>(
    hasOperator ? defaultTab : 'signup',
  )

  useEffect(() => {
    if (!hasOperator) setActiveTab('signup')
  }, [hasOperator])

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-panel--tabs">
        <p className="eyebrow">Operator access</p>
        <h1>Social Media Director</h1>
        <p className="setup-copy">
          {redirectAfterAuth
            ? 'Sign in to continue to the page you requested.'
            : 'Sign in or create your operator account for this instance.'}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            aria-selected={activeTab === 'login'}
            className={activeTab === 'login' ? 'active' : undefined}
            disabled={!hasOperator}
            onClick={() => setActiveTab('login')}
            role="tab"
            type="button"
          >
            Sign in
          </button>
          <button
            aria-selected={activeTab === 'signup'}
            className={activeTab === 'signup' ? 'active' : undefined}
            onClick={() => setActiveTab('signup')}
            role="tab"
            type="button"
          >
            Sign up
          </button>
        </div>

        {activeTab === 'login' ? (
          hasOperator ? (
            <LoginTab onSubmit={onLogin} />
          ) : (
            <p className="setup-copy">
              No operator account exists yet. Use the <strong>Sign up</strong> tab to create the
              first account for this instance.
            </p>
          )
        ) : hasOperator ? (
          <p className="setup-copy">
            An operator account already exists on this instance. Use <strong>Sign in</strong> with
            your email and password.
          </p>
        ) : (
          <SignUpTab onSubmit={onSignUp} />
        )}
      </section>
    </main>
  )
}

function LoginTab({ onSubmit }: Readonly<{ onSubmit: (data: LoginInput) => Promise<void> }>) {
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onChange: loginInputSchema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        await onSubmit(value)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Login failed.')
      }
    },
  })

  return (
    <form
      className="auth-tab-form"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="email">
        {(field) => (
          <label>
            Email
            <input
              autoComplete="username"
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              type="email"
              value={field.state.value}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <label>
            Password
            <input
              autoComplete="current-password"
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              type="password"
              value={field.state.value}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <button type="submit">Sign in</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  )
}

function SignUpTab({ onSubmit }: Readonly<{ onSubmit: (data: SignUpInput) => Promise<void> }>) {
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
        await onSubmit(accountData)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Sign up failed.')
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <form
      className="auth-tab-form"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="email">
        {(field) => (
          <label>
            Email
            <input
              autoComplete="username"
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              type="email"
              value={field.state.value}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <form.Field name="firstName">
        {(field) => (
          <label>
            First name <span className="optional-label">(optional)</span>
            <input
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <label>
            Password
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
            <small className="field-guidance">
              Use {PASSWORD_MIN_LENGTH}+ characters with a letter, number, and symbol.
            </small>
            <DebouncedFieldErrors
              errors={field.state.meta.errors}
              showImmediately={showPasswordFieldErrors}
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="confirmPassword">
        {(field) => (
          <label>
            Confirm password
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
            <DebouncedFieldErrors
              errors={field.state.meta.errors}
              showImmediately={showConfirmPasswordErrors}
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>
      {error ? <p className="error">{error}</p> : null}
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
