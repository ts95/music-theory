import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary'

const VARIANTS: Record<Variant, string> = {
  // Solid ink — the classic engraved-plate look.
  primary:
    'bg-ink text-paper hover:bg-[#34291c] active:translate-y-px shadow-[0_1px_0_rgba(0,0,0,0.25)]',
  // Hairline ghost on paper.
  secondary:
    'bg-transparent text-ink-2 ring-1 ring-inset ring-rule hover:ring-ink hover:text-ink hover:bg-card active:translate-y-px',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export default function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`marking rounded-full px-5 py-2.5 leading-none transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
