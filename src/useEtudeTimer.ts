import { useEffect, useRef, useState } from 'react'
import { addSeconds, getTodaySeconds, resetEtudeSeconds } from './time'

const IDLE_MS = 60_000 // pause after a minute with no interaction
const MAX_DELTA_MS = 2_000 // cap per-tick accrual (absorbs tab-throttle/sleep)
const PER_EXERCISE_CAP_MS = 15_000 // count at most 15 s on any one exercise
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']

/**
 * Accrues active practice time for the open étude: ~1 s ticks add the elapsed
 * delta only while the tab is visible and there was recent interaction. To guard
 * against idling on the étude screen, no more than 15 s is counted per exercise
 * — pass the current question id as `exerciseKey`; its budget resets each time
 * the key changes. Returns today's live seconds for this étude plus a `reset`
 * that clears them; resets across local midnight via the time store. Scoped by
 * being used only while an étude screen is mounted.
 */
export function useEtudeTimer(
  etudeId: string,
  exerciseKey?: string | null
): { seconds: number; reset: () => void } {
  const [seconds, setSeconds] = useState(() => getTodaySeconds()[etudeId] ?? 0)

  // Per-exercise counted budget, reset (during render) whenever the key changes.
  const accruedMs = useRef(0)
  const lastKey = useRef<string | null | undefined>(exerciseKey)
  if (lastKey.current !== exerciseKey) {
    lastKey.current = exerciseKey
    accruedMs.current = 0
  }
  // Keep the interval stable across question changes; read latest id via a ref.
  const etudeRef = useRef(etudeId)
  etudeRef.current = etudeId
  const capped = exerciseKey !== undefined

  useEffect(() => {
    let lastActivity = Date.now()
    let lastTick = Date.now()
    const bump = () => {
      lastActivity = Date.now()
    }
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, bump, { passive: true })
    )

    const id = setInterval(() => {
      const now = Date.now()
      const delta = now - lastTick
      lastTick = now
      const active =
        document.visibilityState === 'visible' && now - lastActivity < IDLE_MS
      if (active) {
        let allowed = Math.min(delta, MAX_DELTA_MS)
        if (capped) allowed = Math.min(allowed, PER_EXERCISE_CAP_MS - accruedMs.current)
        if (allowed > 0) {
          addSeconds(etudeRef.current, allowed / 1000)
          accruedMs.current += allowed
        }
      }
      setSeconds(getTodaySeconds()[etudeRef.current] ?? 0)
    }, 1000)

    return () => {
      clearInterval(id)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump))
    }
  }, [etudeId, capped])

  const reset = () => {
    resetEtudeSeconds(etudeRef.current)
    accruedMs.current = 0
    setSeconds(0)
  }

  return { seconds, reset }
}
