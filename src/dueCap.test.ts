import { beforeEach, describe, expect, it } from 'vitest'
import { remainingDue, recordDue, windowResetAt, DUE_CAP } from './dueCap'

// Minimal in-memory localStorage stub (vitest runs in node).
const store: Record<string, string> = {}
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v
  },
  removeItem: (k: string) => {
    delete store[k]
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k]
  },
  key: () => null,
  length: 0,
} as Storage

const T0 = 1_000_000
const FIVE_H = 5 * 60 * 60 * 1000

describe('due-batch cap', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
  })

  it('starts at the cap and decrements per recorded answer', () => {
    expect(remainingDue('keys', T0)).toBe(DUE_CAP)
    recordDue('keys', T0)
    recordDue('keys', T0 + 1)
    recordDue('keys', T0 + 2)
    expect(remainingDue('keys', T0 + 100)).toBe(DUE_CAP - 3)
  })

  it('never goes below 0', () => {
    for (let i = 0; i < DUE_CAP + 5; i++) recordDue('keys', T0)
    expect(remainingDue('keys', T0)).toBe(0)
  })

  it('resets after the 5-hour window', () => {
    for (let i = 0; i < DUE_CAP; i++) recordDue('keys', T0)
    expect(remainingDue('keys', T0 + 1000)).toBe(0)
    expect(windowResetAt('keys', T0 + 1000)).toBe(T0 + FIVE_H)
    // Window elapsed → full allowance again, no active reset time.
    expect(remainingDue('keys', T0 + FIVE_H)).toBe(DUE_CAP)
    expect(windowResetAt('keys', T0 + FIVE_H)).toBeNull()
  })

  it('is tracked independently per étude', () => {
    recordDue('a', T0)
    recordDue('a', T0)
    expect(remainingDue('a', T0)).toBe(DUE_CAP - 2)
    expect(remainingDue('b', T0)).toBe(DUE_CAP)
  })
})
