import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'ghost' | 'danger'
}

const tones: Record<NonNullable<Props['tone']>, string> = {
  primary: 'bg-accent text-white hover:bg-[#0c4e4c] disabled:bg-accent/50',
  ghost: 'border border-line bg-card text-ink hover:border-accent disabled:opacity-50',
  danger: 'border border-danger text-danger hover:bg-danger hover:text-white disabled:opacity-50',
}

export function Button({ tone = 'primary', className = '', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${tones[tone]} ${className}`}
      {...props}
    />
  )
}

export const controlClass = 'w-full border border-line bg-card px-3 py-2 text-ink outline-none transition-colors focus:border-accent'
