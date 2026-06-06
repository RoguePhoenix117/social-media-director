import { useForm } from '@tanstack/react-form'
import { Sparkles } from 'lucide-react'
import { importFormSchema } from '../../../lib/dashboard-schemas'

type DraftImportFormProps = {
  isLoading: boolean
  disableSubmit?: boolean
  generationStatus?: string
  error?: string
  onSubmit: (values: { url: string; intentPrompt: string }) => Promise<void>
}

export function DraftImportForm({
  isLoading,
  disableSubmit = false,
  generationStatus,
  error,
  onSubmit,
}: Readonly<DraftImportFormProps>) {
  const importForm = useForm({
    defaultValues: { url: '', intentPrompt: '' },
    validators: { onChange: importFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <form
      className="import-panel draft-import-panel"
      onSubmit={(event) => {
        event.preventDefault()
        void importForm.handleSubmit()
      }}
    >
      <div className="panel-heading">
        <Sparkles aria-hidden="true" size={22} />
        <div>
          <h3>Import from URL</h3>
          <p>Paste a blog or article link. AI drafts appear here when ready.</p>
        </div>
      </div>
      <importForm.Field name="url">
        {(field) => (
          <label>
            Source URL
            <input
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="https://github.com/org/repo"
              required
              type="url"
              value={field.state.value}
            />
          </label>
        )}
      </importForm.Field>
      <importForm.Field name="intentPrompt">
        {(field) => (
          <label>
            Optional direction
            <textarea
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Emphasize the launch angle and invite readers to try it."
              rows={3}
              value={field.state.value}
            />
          </label>
        )}
      </importForm.Field>
      <button disabled={isLoading || disableSubmit} type="submit">
        {isLoading ? 'Generating...' : 'Import and generate'}
      </button>
      {generationStatus ? <p className="generation-status">{generationStatus}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  )
}
