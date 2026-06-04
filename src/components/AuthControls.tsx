import { useLayoutEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Button from './Button'
import { SUPABASE_ENABLED, authRedirectTo, supabase } from '../supabase/client'

/**
 * Sign-in / sign-out control for cross-device sync. Magic-link only: enter an
 * email, get a sign-in link. Renders nothing when sync isn't configured.
 */
export default function AuthControls({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  // The panel is right-anchored to the button, but the button can wrap to the
  // left of the header on narrow screens — then a right-anchored panel runs off
  // the left edge. After it opens, nudge it horizontally so it stays on screen.
  const panelRef = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)
  const shiftRef = useRef(0)
  useLayoutEffect(() => {
    if (!open) {
      shiftRef.current = 0
      setShift(0)
      return
    }
    const el = panelRef.current
    if (!el) return
    const margin = 12
    const r = el.getBoundingClientRect()
    const left = r.left - shiftRef.current // un-shifted edges
    const right = r.right - shiftRef.current
    let s = 0
    if (left < margin) s = margin - left
    else if (right > window.innerWidth - margin) s = window.innerWidth - margin - right
    shiftRef.current = s
    setShift(s)
  }, [open])

  if (!SUPABASE_ENABLED) return null

  if (session) {
    return (
      <Button
        variant="secondary"
        onClick={() => void supabase!.auth.signOut()}
        title={`Signed in as ${session.user.email ?? 'you'} — synced`}
      >
        Sign out
      </Button>
    )
  }

  async function handleSend() {
    setStatus('sending')
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectTo() },
    })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
        Sign in
      </Button>
      {open && (
        <div
          ref={panelRef}
          // Shift via `right` (not transform — the .ink entrance animates transform).
          style={{ right: `${-shift}px` }}
          className="ink absolute right-0 z-10 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-rule bg-card p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
        >
          <p className="marking text-ink-3">Sync across devices</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSend()
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2 font-sans text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <Button
              type="submit"
              className="mt-2 w-full"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Email me a link'}
            </Button>
          </form>
          {status === 'sent' && (
            <p className="mt-2 text-sm text-correct">
              Check your inbox for a sign-in link.
            </p>
          )}
          {status === 'error' && (
            <p className="mt-2 text-sm text-wrong">Couldn’t send — try again.</p>
          )}
        </div>
      )}
    </div>
  )
}
