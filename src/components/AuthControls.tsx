import { useLayoutEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Button from './Button'
import { SUPABASE_ENABLED, authRedirectTo, supabase } from '../supabase/client'

/**
 * Sign-in / sign-out control for cross-device sync. Enter an email, get a
 * sign-in email. In a browser that's a magic link (click it). When running as an
 * installed PWA (iOS home-screen app), the magic link would open in Safari —
 * a *separate* storage container — so the installed app would stay signed out;
 * there we use the 6-digit code from the same email instead (verifyOtp), which
 * signs you in right inside the app. Renders nothing when sync isn't configured.
 */

/** Length of the email OTP — must match Supabase auth `mailer_otp_length`. */
const OTP_LENGTH = 8

/** True when running as an installed/standalone PWA (incl. iOS home-screen). */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

export default function AuthControls({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'sending' | 'sent' | 'error' | 'verifying' | 'badcode'
  >('idle')
  // Use the code flow only in an installed PWA (see the note above).
  const [pwa] = useState(isStandalone)
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

  async function handleVerify() {
    setStatus('verifying')
    const { error } = await supabase!.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })
    // On success the auth state change flips this component to "Sign out".
    if (error) setStatus('badcode')
  }

  // The email has been sent; the next step depends on browser vs installed PWA.
  const sent =
    status === 'sent' || status === 'verifying' || status === 'badcode'

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
          {!sent ? (
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
                {status === 'sending'
                  ? 'Sending…'
                  : pwa
                    ? 'Email me a code'
                    : 'Email me a link'}
              </Button>
              {status === 'error' && (
                <p className="mt-2 text-sm text-wrong">Couldn’t send — try again.</p>
              )}
            </form>
          ) : pwa ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleVerify()
              }}
            >
              <p className="mt-2 text-sm text-ink-2">
                Enter the 8-digit code we emailed to{' '}
                <span className="text-ink">{email}</span>.
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={OTP_LENGTH}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="12345678"
                className="mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-center font-mono text-lg tracking-[0.25em] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <Button
                type="submit"
                className="mt-2 w-full"
                disabled={status === 'verifying' || code.length < OTP_LENGTH}
              >
                {status === 'verifying' ? 'Verifying…' : 'Verify code'}
              </Button>
              {status === 'badcode' && (
                <p className="mt-2 text-sm text-wrong">
                  Incorrect or expired code — check the email or resend.
                </p>
              )}
            </form>
          ) : (
            <p className="mt-2 text-sm text-correct">
              Check your inbox for a sign-in link.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
