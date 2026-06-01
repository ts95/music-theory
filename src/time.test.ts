import { afterEach, describe, expect, it } from 'vitest'
import {
  addAnswer,
  addSeconds,
  getTodayAnswersByLevel,
  getTodaySeconds,
  getTodaySecondsByLevel,
  localDate,
  resetAllAnswers,
  resetAllSeconds,
  resetEtudeAnswers,
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
  it('accumulates seconds per étude for the day (summed across levels)', () => {
    addSeconds('keys', 30, 1, 1, DAY)
    addSeconds('keys', 45, 1, 1, DAY)
    addSeconds('keys', 10, 2, 1, DAY) // a different level still rolls into the étude total
    addSeconds('chords', 10, 0, 1, DAY)
    expect(getTodaySeconds(DAY)).toEqual({ keys: 85, chords: 10 })
  })

  it('breaks seconds out by (étude, level, version) for sync', () => {
    addSeconds('keys', 30, 1, 1, DAY)
    addSeconds('keys', 12, 2, 1, DAY)
    expect(getTodaySecondsByLevel(DAY).sort((a, b) => a.level - b.level)).toEqual([
      { etudeId: 'keys', level: 1, version: 1, seconds: 30 },
      { etudeId: 'keys', level: 2, version: 1, seconds: 12 },
    ])
  })

  it('resets at local midnight (a different day reads as empty)', () => {
    addSeconds('keys', 120, 1, 1, DAY)
    expect(getTodaySeconds(NEXT)).toEqual({})
  })

  it('ignores non-positive additions', () => {
    addSeconds('keys', 0, 1, 1, DAY)
    addSeconds('keys', -5, 1, 1, DAY)
    expect(getTodaySeconds(DAY)).toEqual({})
  })

  it('localDate formats as YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('resets one étude (all its levels), leaving the others', () => {
    addSeconds('keys', 60, 1, 1, DAY)
    addSeconds('keys', 20, 2, 1, DAY)
    addSeconds('chords', 30, 1, 1, DAY)
    resetEtudeSeconds('keys', DAY)
    expect(getTodaySeconds(DAY)).toEqual({ chords: 30 })
  })

  it('resets all études for today', () => {
    addSeconds('keys', 60, 1, 1, DAY)
    resetAllSeconds(DAY)
    expect(getTodaySeconds(DAY)).toEqual({})
  })
})

describe('answer tally store', () => {
  it('accumulates answered/correct by (étude, level, version)', () => {
    addAnswer('keys', true, 1, 1, DAY)
    addAnswer('keys', false, 1, 1, DAY)
    addAnswer('keys', true, 2, 1, DAY) // different level → separate entry
    addAnswer('chords', false, 0, 1, DAY)
    expect(getTodayAnswersByLevel(DAY).sort((a, b) => a.etudeId.localeCompare(b.etudeId) || a.level - b.level)).toEqual([
      { etudeId: 'chords', level: 0, version: 1, answered: 1, correct: 0 },
      { etudeId: 'keys', level: 1, version: 1, answered: 2, correct: 1 },
      { etudeId: 'keys', level: 2, version: 1, answered: 1, correct: 1 },
    ])
  })

  it('resets at local midnight (a different day reads as empty)', () => {
    addAnswer('keys', true, 1, 1, DAY)
    expect(getTodayAnswersByLevel(NEXT)).toEqual([])
  })

  it('resets one étude (all its levels), leaving the others', () => {
    addAnswer('keys', true, 1, 1, DAY)
    addAnswer('chords', true, 1, 1, DAY)
    resetEtudeAnswers('keys', DAY)
    expect(getTodayAnswersByLevel(DAY)).toEqual([
      { etudeId: 'chords', level: 1, version: 1, answered: 1, correct: 1 },
    ])
  })

  it('resets all études for today', () => {
    addAnswer('keys', true, 1, 1, DAY)
    resetAllAnswers(DAY)
    expect(getTodayAnswersByLevel(DAY)).toEqual([])
  })
})
