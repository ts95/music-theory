/**
 * SM-2-lite spaced-repetition scheduler.
 *
 * Pure functions: `now` (epoch ms) is always passed in; nothing here reads the
 * clock or touches the DOM. `grade` returns a brand-new state and never mutates
 * its input.
 */

import type { SrsState } from '../contracts'

const MS_PER_DAY = 86_400_000
const MIN_EASE = 1.3

/** Fresh state for a never-seen item: due immediately at `now`. */
export function initialState(now: number): SrsState {
  return { ease: 2.5, intervalDays: 0, reps: 0, dueAt: now }
}

/** Grade a review (quality 0–5) and return the next state. Immutable. */
export function grade(state: SrsState, quality: number, now: number): SrsState {
  let intervalDays: number
  let reps: number

  if (quality >= 3) {
    if (state.reps === 0) intervalDays = 1
    else if (state.reps === 1) intervalDays = 6
    else intervalDays = Math.round(state.intervalDays * state.ease)
    reps = state.reps + 1
  } else {
    intervalDays = 1
    reps = 0
  }

  const ease = Math.max(
    MIN_EASE,
    state.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  )

  return { ease, intervalDays, reps, dueAt: now + intervalDays * MS_PER_DAY }
}

/** True when the item is due for review (dueAt at or before `now`). */
export function isDue(state: SrsState, now: number): boolean {
  return state.dueAt <= now
}
