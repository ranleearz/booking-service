import type { InputHTMLAttributes } from 'react'
import { controlClass } from './Button'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export function Field({ label, error, id, ...props }: Props) {
  const fieldId = id ?? props.name
  return (
    <label className="block" htmlFor={fieldId}>
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <input id={fieldId} className={controlClass} {...props} />
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </label>
  )
}
