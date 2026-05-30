import { beforeEach, describe, expect, it } from 'vitest'
import { getBoolPref, setBoolPref } from './prefs'

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

describe('boolean UI prefs', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
  })

  it('returns the fallback until set, then persists per key', () => {
    expect(getBoolPref('infobox:a', true)).toBe(true)
    setBoolPref('infobox:a', false)
    expect(getBoolPref('infobox:a', true)).toBe(false)
    // Independent keys.
    setBoolPref('infobox:b', true)
    expect(getBoolPref('infobox:b', false)).toBe(true)
    expect(getBoolPref('infobox:a', true)).toBe(false)
  })
})
