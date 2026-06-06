import { beforeEach, describe, expect, it } from 'vitest'
import {
  getSavedMeters,
  mergeRhythmMeters,
  saveMeters,
  type RhythmMetersStore,
} from './rhythmMeters'

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

describe('rhythm-meter selection storage', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
  })

  it('returns null until a selection is saved, then persists per (étude, level)', () => {
    expect(getSavedMeters('rhythm-dictation', 1)).toBeNull()
    saveMeters('rhythm-dictation', 1, ['4/4', '3/4'])
    expect(getSavedMeters('rhythm-dictation', 1)).toEqual(['4/4', '3/4'])
    // Independent per level and per étude.
    expect(getSavedMeters('rhythm-dictation', 2)).toBeNull()
    expect(getSavedMeters('rhythm-tap', 1)).toBeNull()
    saveMeters('rhythm-dictation', 2, ['6/8'])
    expect(getSavedMeters('rhythm-dictation', 1)).toEqual(['4/4', '3/4'])
    expect(getSavedMeters('rhythm-dictation', 2)).toEqual(['6/8'])
  })
})

describe('mergeRhythmMeters', () => {
  it('keeps the more-recently-updated selection per key (last-write-wins)', () => {
    const local: RhythmMetersStore = {
      'rhythm-dictation\t1': { meters: ['4/4'], updatedAt: 100 },
      'rhythm-tap\t1': { meters: ['3/4'], updatedAt: 50 },
    }
    const remote: RhythmMetersStore = {
      'rhythm-dictation\t1': { meters: ['4/4', '3/4'], updatedAt: 200 }, // newer → wins
      'rhythm-tap\t1': { meters: ['2/4'], updatedAt: 10 }, // older → loses
      'rhythm-dictation\t2': { meters: ['6/8'], updatedAt: 5 }, // only on remote → adopted
    }
    expect(mergeRhythmMeters(local, remote)).toEqual({
      'rhythm-dictation\t1': { meters: ['4/4', '3/4'], updatedAt: 200 },
      'rhythm-tap\t1': { meters: ['3/4'], updatedAt: 50 },
      'rhythm-dictation\t2': { meters: ['6/8'], updatedAt: 5 },
    })
  })

  it('is a no-op union when one side is empty', () => {
    const local: RhythmMetersStore = {
      'rhythm-dictation\t1': { meters: ['4/4'], updatedAt: 1 },
    }
    expect(mergeRhythmMeters(local, {})).toEqual(local)
    expect(mergeRhythmMeters({}, local)).toEqual(local)
  })
})
