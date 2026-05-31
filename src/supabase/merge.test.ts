import { describe, expect, it } from 'vitest'
import type { SrsData, SrsState } from '../contracts'
import { mergeSrs } from './merge'

const DAY = 86_400_000
const T = 1_000_000_000_000

function state(over: Partial<SrsState>): SrsState {
  return { ease: 2.5, intervalDays: 1, reps: 1, dueAt: T + DAY, updatedAt: T, ...over }
}

function data(items: Record<string, SrsState>): SrsData {
  return { version: 2, items }
}

describe('mergeSrs', () => {
  it('keeps the more-recently-reviewed state for a shared item', () => {
    const local = data({ a: state({ reps: 5, updatedAt: T + 2 * DAY }) })
    const remote = data({ a: state({ reps: 2, updatedAt: T }) })
    expect(mergeSrs(local, remote).items.a.reps).toBe(5) // local is newer
  })

  it('a fresh lapse on one device is not overwritten by a stale "knew it"', () => {
    // Local: just lapsed (reps 0), reviewed most recently. Remote: stale mastery.
    const local = data({ a: state({ reps: 0, intervalDays: 1, updatedAt: T + 3 * DAY }) })
    const remote = data({ a: state({ reps: 8, intervalDays: 40, updatedAt: T }) })
    expect(mergeSrs(local, remote).items.a.reps).toBe(0)
  })

  it('unions items unique to either side', () => {
    const local = data({ a: state({}) })
    const remote = data({ b: state({}) })
    const merged = mergeSrs(local, remote)
    expect(Object.keys(merged.items).sort()).toEqual(['a', 'b'])
  })
})
