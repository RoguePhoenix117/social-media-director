import { useEffect, useState } from 'react'

type DebouncedFieldErrorsProps = {
  errors: Array<unknown>
  value: string
  delayMs?: number
  showImmediately?: boolean
}

export function DebouncedFieldErrors({
  errors,
  value,
  delayMs = 500,
  showImmediately = false,
}: DebouncedFieldErrorsProps) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const [isDebouncing, setIsDebouncing] = useState(false)

  useEffect(() => {
    if (showImmediately) {
      setDebouncedValue(value)
      setIsDebouncing(false)
      return
    }

    setIsDebouncing(true)
    const timer = window.setTimeout(() => {
      setDebouncedValue(value)
      setIsDebouncing(false)
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [value, delayMs, showImmediately])

  const showErrors =
    showImmediately || (!isDebouncing && debouncedValue === value && value.length > 0)

  if (!showErrors || !errors.length) return null

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
    const message = error.message
    if (typeof message === 'string') return message
  }
  return 'Invalid value.'
}
