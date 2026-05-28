import { useEffect, useState } from 'react'
import { addSeconds, getTodaySeconds } from './time'

const IDLE_MS = 60_000 // pause after a minute with no interaction
const MAX_DELTA_MS = 2_000 // cap per-tick accrual (absorbs tab-throttle/sleep)
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']

/**
 * Accrues active practice time for the open étude: ~1 s ticks add the elapsed
 * delta only while the tab is visible and there was recent interaction. Returns
 * today's seconds for this étude (live), and resets across local midnight via
 * the time store. Scoped by being used only while an étude screen is mounted.
 */
export function useEtudeTimer(etudeId: string): number {
  const [seconds, setSeconds] = useState(() => getTodaySeconds()[etudeId] ?? 0)

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
        addSeconds(etudeId, Math.min(delta, MAX_DELTA_MS) / 1000)
      }
      setSeconds(getTodaySeconds()[etudeId] ?? 0)
    }, 1000)

    return () => {
      clearInterval(id)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump))
    }
  }, [etudeId])

  return seconds
}
