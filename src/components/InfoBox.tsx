import { useState, type ReactNode } from 'react'
import { getBoolPref, setBoolPref } from '../prefs'

/**
 * A reusable, collapsible reference/context box for an étude screen. Generic —
 * any étude can render one with its own title and body (see references.tsx).
 * Styled with the Engraved tokens; expanded by default, collapsible to a header.
 * Pass `storageKey` to remember the open/closed state across visits.
 */
interface InfoBoxProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  storageKey?: string
}

export default function InfoBox({
  title,
  children,
  defaultOpen = true,
  storageKey,
}: InfoBoxProps) {
  const [open, setOpen] = useState(() =>
    storageKey ? getBoolPref(storageKey, defaultOpen) : defaultOpen,
  )
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (storageKey) setBoolPref(storageKey, next)
  }
  return (
    <div className="rounded-2xl border border-rule bg-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="marking flex w-full items-center gap-2 px-5 py-3 text-left text-ink-2 transition-colors hover:text-ink"
      >
        <span
          aria-hidden
          className={`text-accent transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        {title}
      </button>
      {open && (
        <div className="border-t border-rule px-5 py-4 text-sm text-ink-2">
          {children}
        </div>
      )}
    </div>
  )
}
