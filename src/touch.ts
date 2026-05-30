import { useEffect, useState } from 'react'

/**
 * Touch helpers. The app is mouse-first (hover to preview, click to act); on a
 * touch screen there's no hover and a tap shouldn't immediately commit. These
 * let any handler adapt *per interaction* (so hybrid mouse+touch devices work)
 * without sniffing the device.
 */

// The pointer type of the most recent interaction, updated before any click
// fires (pointerdown precedes click). Defaults to mouse so keyboard-only and
// SSR paths behave like desktop.
let lastPointerType: string = 'mouse'
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPointerType = e.pointerType || 'mouse'
    },
    { capture: true, passive: true }
  )
}

/** True when the last pointer interaction came from touch (or a pen). */
export function wasTouch(): boolean {
  return lastPointerType === 'touch' || lastPointerType === 'pen'
}

const ARMED_TIMEOUT_MS = 3000

/**
 * Make a definite/destructive action safe on touch: mouse clicks fire it at
 * once, but a touch taps once to *arm* (caller shows a "tap to confirm" cue)
 * and again to confirm. Arming auto-clears after a few seconds.
 */
export function useConfirmTap(onConfirm: () => void): {
  armed: boolean
  onClick: () => void
} {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), ARMED_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [armed])

  const onClick = () => {
    if (!wasTouch()) {
      onConfirm()
      return
    }
    if (armed) {
      setArmed(false)
      onConfirm()
    } else {
      setArmed(true)
    }
  }

  return { armed, onClick }
}

/** True on touch-only devices (no hover) — for static hint copy, not behaviour. */
export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(hover: none)')
    const update = () => setTouch(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return touch
}
