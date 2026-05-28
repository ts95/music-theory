import { describe, it, expect } from 'vitest'
import type { Note } from '../contracts'
import {
  KEYS,
  noteToString,
  majorScale,
  minorScale,
  fingering,
} from './index'

const nat = (letter: Note['letter']): Note => ({ letter, accidental: 0 })
const sharp = (letter: Note['letter']): Note => ({ letter, accidental: 1 })
const flat = (letter: Note['letter']): Note => ({ letter, accidental: -1 })

const spell = (notes: Note[]) => notes.map(noteToString).join(' ')

describe('noteToString', () => {
  it('renders accidentals as unicode glyphs', () => {
    expect(noteToString(nat('C'))).toBe('C')
    expect(noteToString(flat('E'))).toBe('E♭')
    expect(noteToString(sharp('F'))).toBe('F♯')
    expect(noteToString({ letter: 'C', accidental: 2 })).toBe('C\u{1D12A}')
    expect(noteToString({ letter: 'B', accidental: -2 })).toBe('B\u{1D12B}')
  })
})

describe('major scales', () => {
  it('C major', () => {
    expect(spell(majorScale(nat('C')))).toBe('C D E F G A B')
  })
  it('E♭ major', () => {
    expect(spell(majorScale(flat('E')))).toBe('E♭ F G A♭ B♭ C D')
  })
})

describe('minor scales', () => {
  it('C natural minor', () => {
    expect(spell(minorScale(nat('C'), 'natural'))).toBe('C D E♭ F G A♭ B♭')
  })
  it('C harmonic minor', () => {
    expect(spell(minorScale(nat('C'), 'harmonic'))).toBe('C D E♭ F G A♭ B')
  })
  it('C melodic minor', () => {
    expect(spell(minorScale(nat('C'), 'melodic'))).toBe('C D E♭ F G A B')
  })
  it('E♭ natural minor', () => {
    expect(spell(minorScale(flat('E'), 'natural'))).toBe('E♭ F G♭ A♭ B♭ C♭ D♭')
  })
  it('E♭ harmonic minor (raised 7th D♭→D)', () => {
    expect(spell(minorScale(flat('E'), 'harmonic'))).toBe('E♭ F G♭ A♭ B♭ C♭ D')
  })
  it('D♯ harmonic minor (double-sharp 7th)', () => {
    expect(spell(minorScale(sharp('D'), 'harmonic'))).toBe(
      'D♯ E♯ F♯ G♯ A♯ B C\u{1D12A}'
    )
  })
  it('G♯ harmonic minor', () => {
    expect(spell(minorScale(sharp('G'), 'harmonic'))).toBe(
      'G♯ A♯ B C♯ D♯ E F\u{1D12A}'
    )
  })
  it('C♯ natural minor', () => {
    expect(spell(minorScale(sharp('C'), 'natural'))).toBe('C♯ D♯ E F♯ G♯ A B')
  })
})

describe('KEYS', () => {
  it('has 12 keys in circle-of-fifths order', () => {
    expect(KEYS).toHaveLength(12)
    expect(KEYS[0].majorName).toBe('C major')
    expect(KEYS[1].majorName).toBe('G major')
  })
  it('relative minors match', () => {
    const eb = KEYS.find((k) => k.majorName === 'E♭ major')!
    expect(eb.minorName).toBe('C minor')
    const a = KEYS.find((k) => k.majorName === 'A major')!
    expect(a.minorName).toBe('F♯ minor')
    const db = KEYS.find((k) => k.majorName === 'D♭ major')!
    expect(db.minorName).toBe('B♭ minor')
  })
})

describe('fingering', () => {
  it('A minor RH/LH', () => {
    expect(fingering(nat('A'), 'natural', 'RH')).toEqual([1, 2, 3, 1, 2, 3, 4, 5])
    expect(fingering(nat('A'), 'natural', 'LH')).toEqual([5, 4, 3, 2, 1, 3, 2, 1])
  })
  it('shares fingering across the three forms', () => {
    expect(fingering(sharp('F'), 'natural', 'RH')).toEqual(
      fingering(sharp('F'), 'harmonic', 'RH')
    )
    expect(fingering(sharp('F'), 'melodic', 'LH')).toEqual(
      fingering(sharp('F'), 'natural', 'LH')
    )
  })
  it('all 12 minor tonics resolve, each 8 numbers', () => {
    for (const k of KEYS) {
      for (const hand of ['RH', 'LH'] as const) {
        const f = fingering(k.minorTonic, 'harmonic', hand)
        expect(f, `${k.minorName} ${hand}`).not.toBeNull()
        expect(f!).toHaveLength(8)
      }
    }
  })
})
