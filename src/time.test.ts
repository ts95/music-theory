import { afterEach, describe, expect, it } from 'vitest'
import {
  addSeconds,
  getTodaySeconds,
  localDate,
  resetAllSeconds,
  resetEtudeSeconds,
} from './time'

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

afterEach(() => {
  for (const k of Object.keys(store)) delete store[k]
})

const DAY = '2026-05-29'
const NEXT = '2026-05-30'

describe('practice time store', () => {
  it('accumulates seconds per étude for the day', () => {
    addSeconds('keys', 30, DAY)
    addSeconds('keys', 45, DAY)
    addSeconds('chords', 10, DAY)
    expect(getTodaySeconds(DAY)).toEqual({ keys: 75, chords: 10 })
  })

  it('resets at local midnight (a different day reads as empty)', () => {
    addSeconds('keys', 120, DAY)
    expect(getTodaySeconds(NEXT)).toEqual({})
  })

  it('starts fresh on the new day, discarding the old day', () => {
    addSeconds('keys', 120, DAY)
    addSeconds('keys', 20, NEXT) // first write of the new day resets, then adds
    expect(getTodaySeconds(NEXT)).toEqual({ keys: 20 })
  })

  it('ignores non-positive additions', () => {
    addSeconds('keys', 0, DAY)
    addSeconds('keys', -5, DAY)
    expect(getTodaySeconds(DAY)).toEqual({})
  })

  it('localDate formats as YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('resets one étude, leaving the others', () => {
    addSeconds('keys', 60, DAY)
    addSeconds('chords', 30, DAY)
    resetEtudeSeconds('keys', DAY)
    expect(getTodaySeconds(DAY)).toEqual({ chords: 30 })
  })

  it('resets all études for today', () => {
    addSeconds('keys', 60, DAY)
    addSeconds('chords', 30, DAY)
    resetAllSeconds(DAY)
    expect(getTodaySeconds(DAY)).toEqual({})
  })
})
