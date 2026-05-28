import { beforeEach, describe, expect, it } from 'vitest'
import type { SrsData } from '../contracts'
import { grade, initialState, isDue } from './scheduler'
import {
  exportJson,
  getState,
  importJson,
  load,
  save,
  SCHEMA_VERSION,
  setState,
  STORAGE_KEY,
} from './store'

const NOW = 1_000_000_000_000
const DAY = 86_400_000

// Minimal in-memory localStorage stub (vitest's node env has no localStorage).
function installLocalStorage(): void {
  const map = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => void map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

describe('scheduler', () => {
  it('initialState is due immediately', () => {
    const s = initialState(NOW)
    expect(s).toEqual({ ease: 2.5, intervalDays: 0, reps: 0, dueAt: NOW })
    expect(isDue(s, NOW)).toBe(true)
  })

  it('first correct grade (q=5): interval 1 day, reps 1, not due at now', () => {
    const s = grade(initialState(NOW), 5, NOW)
    expect(s.intervalDays).toBe(1)
    expect(s.reps).toBe(1)
    expect(s.dueAt).toBe(NOW + DAY)
    expect(isDue(s, NOW)).toBe(false)
  })

  it('second correct grade -> 6 days, third -> round(6 * ease)', () => {
    const s1 = grade(initialState(NOW), 5, NOW)
    const s2 = grade(s1, 5, NOW)
    expect(s2.intervalDays).toBe(6)
    expect(s2.reps).toBe(2)

    const s3 = grade(s2, 5, NOW)
    expect(s3.intervalDays).toBe(Math.round(6 * s2.ease))
    expect(s3.reps).toBe(3)
  })

  it('lapse (q=2) resets reps to 0, interval to 1 day, lowers ease >= 1.3', () => {
    const built = grade(grade(grade(initialState(NOW), 5, NOW), 5, NOW), 5, NOW)
    const lapsed = grade(built, 2, NOW)
    expect(lapsed.reps).toBe(0)
    expect(lapsed.intervalDays).toBe(1)
    expect(lapsed.ease).toBeLessThan(built.ease)
    expect(lapsed.ease).toBeGreaterThanOrEqual(1.3)
  })

  it('ease is clamped to a minimum of 1.3 after repeated lapses', () => {
    let s = initialState(NOW)
    for (let i = 0; i < 20; i++) s = grade(s, 0, NOW)
    expect(s.ease).toBe(1.3)
  })

  it('grade() does not mutate the input state', () => {
    const before = initialState(NOW)
    const snapshot = { ...before }
    grade(before, 5, NOW)
    expect(before).toEqual(snapshot)
  })
})

describe('store', () => {
  beforeEach(() => {
    installLocalStorage()
    globalThis.localStorage.clear()
  })

  it('exportJson -> importJson round-trips to an equal object', () => {
    const data = setState(
      { version: SCHEMA_VERSION, items: {} },
      'rel-minor:Eb',
      grade(initialState(NOW), 5, NOW),
    )
    expect(importJson(exportJson(data))).toEqual(data)
  })

  it('exportJson is pretty-printed with 2 spaces', () => {
    const json = exportJson({ version: SCHEMA_VERSION, items: {} })
    expect(json).toContain('\n  "version"')
  })

  it('importJson throws on malformed JSON', () => {
    expect(() => importJson('{ not json')).toThrow()
  })

  it('importJson throws on a wrong-version blob', () => {
    expect(() =>
      importJson(JSON.stringify({ version: 999, items: {} })),
    ).toThrow()
  })

  it('importJson throws on malformed items', () => {
    expect(() =>
      importJson(JSON.stringify({ version: SCHEMA_VERSION, items: { x: { ease: 'no' } } })),
    ).toThrow()
  })

  it('setState returns a new object and does not mutate the original', () => {
    const original: SrsData = { version: SCHEMA_VERSION, items: {} }
    const next = setState(original, 'id1', initialState(NOW))
    expect(next).not.toBe(original)
    expect(original.items).toEqual({})
    expect(getState(next, 'id1')).toEqual(initialState(NOW))
  })

  it('load returns fresh data when storage is empty', () => {
    expect(load()).toEqual({ version: SCHEMA_VERSION, items: {} })
  })

  it('save then load round-trips', () => {
    const data = setState(
      { version: SCHEMA_VERSION, items: {} },
      'id1',
      grade(initialState(NOW), 4, NOW),
    )
    save(data)
    expect(load()).toEqual(data)
  })

  it('load returns fresh data on corrupt or wrong-version storage', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '{ corrupt')
    expect(load()).toEqual({ version: SCHEMA_VERSION, items: {} })
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, items: {} }))
    expect(load()).toEqual({ version: SCHEMA_VERSION, items: {} })
  })
})
