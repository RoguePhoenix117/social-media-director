import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import type { z } from 'zod'
import { loginInputSchema } from '../../lib/dashboard-schemas'

/**
 * Standalone login screen shown when the operator already exists but no
 * active session cookie is present.
 */
export function LoginScreen({
  onSubmit,
}: Readonly<{
  onSubmit: (data: z.infer<typeof loginInputSchema>) => Promise<void>
}>) {
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
    <main className="auth-shell">
      <form
        className="auth-panel"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <p className="eyebrow">Operator login</p>
        <h1>Social Media Director</h1>
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
              <small className="field-guidance">
                Use the email you registered for this self-hosted dashboard.
              </small>
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
        <button type="submit">Log in</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </main>
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
