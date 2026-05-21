import { useForm } from '@tanstack/react-form'
import { FolderPlus } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'

const formSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.').max(80, 'Keep the name under 80 characters.'),
})

/**
 * Onboarding step 2 (and Settings → Projects later): a single text field for
 * the project name, prefilled with `default-project` for the first-run flow.
 * Submission is owned by the parent so the same component can be reused from
 * the wizard and from the (future) projects settings card.
 */
export function CreateProjectScreen({
  defaultName = 'default-project',
  description,
  heading = 'Create your first project',
  onSubmit,
  submitLabel = 'Create project',
}: Readonly<{
  defaultName?: string
  description?: string
  heading?: string
  onSubmit: (input: { name: string }) => Promise<void>
  submitLabel?: string
}>) {
  const [error, setError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm({
    defaultValues: { name: defaultName },
    validators: { onChange: formSchema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setIsSubmitting(true)
      try {
        await onSubmit({ name: value.name.trim() })
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not create project.')
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <div className="onboarding-step-content">
      <div className="panel-heading">
        <FolderPlus aria-hidden="true" size={22} />
        <div>
          <h2>{heading}</h2>
          <p>
            {description ??
              'A project is a workspace for one brand or persona. Each project keeps its own channels, drafts, and history.'}
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="name">
          {(field) => (
            <label className="form-field">
              <span className="field-label">Project name</span>
              <input
                autoComplete="off"
                autoFocus
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="default-project"
                required
                value={field.state.value}
              />
              <small className="field-guidance">
                You can rename this later. We will derive a URL-safe slug automatically.
              </small>
              {field.state.meta.errors.length > 0 ? (
                <ul className="field-errors">
                  {field.state.meta.errors.map((fieldError, index) => (
                    <li key={index}>{formatFieldError(fieldError)}</li>
                  ))}
                </ul>
              ) : null}
            </label>
          )}
        </form.Field>

        <div className="button-row">
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Creating…' : submitLabel}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
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
