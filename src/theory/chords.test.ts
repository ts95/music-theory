import { describe, it, expect } from 'vitest'
import type { Note } from '../contracts'
import { KEYS } from './keys'
import {
  chordSymbol,
  diatonicTriads,
  diatonicSevenths,
  romanToChord,
  type Quality,
} from './chords'

const nat = (letter: Note['letter']): Note => ({ letter, accidental: 0 })
const flat = (letter: Note['letter']): Note => ({ letter, accidental: -1 })

const symbols = (chords: { root: Note; quality: Quality }[]) =>
  chords.map(chordSymbol)

const VALID_QUALITIES: Quality[] = [
  'maj',
  'min',
  'dim',
  'aug',
  'maj7',
  'dom7',
  'min7',
  'm7b5',
  'dim7',
  'mMaj7',
]

describe('diatonicTriads — major', () => {
  it('C major', () => {
    expect(symbols(diatonicTriads(nat('C'), 'major'))).toEqual([
      'C',
      'Dm',
      'Em',
      'F',
      'G',
      'Am',
      'B°',
    ])
  })

  it('G major', () => {
    expect(symbols(diatonicTriads(nat('G'), 'major'))).toEqual([
      'G',
      'Am',
      'Bm',
      'C',
      'D',
      'Em',
      'F♯°',
    ])
  })

  it('E♭ major', () => {
    expect(symbols(diatonicTriads(flat('E'), 'major'))).toEqual([
      'E♭',
      'Fm',
      'Gm',
      'A♭',
      'B♭',
      'Cm',
      'D°',
    ])
  })
})

describe('diatonicSevenths — major', () => {
  it('C major', () => {
    expect(symbols(diatonicSevenths(nat('C'), 'major'))).toEqual([
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
      'Am7',
      'Bø7',
    ])
  })
})

describe('diatonicTriads — minor', () => {
  it('A minor', () => {
    expect(symbols(diatonicTriads(nat('A'), 'minor'))).toEqual([
      'Am',
      'B°',
      'C',
      'Dm',
      'E',
      'F',
      'G♯°',
    ])
  })

  it('C minor', () => {
    expect(symbols(diatonicTriads(nat('C'), 'minor'))).toEqual([
      'Cm',
      'D°',
      'E♭',
      'Fm',
      'G',
      'A♭',
      'B°',
    ])
  })

  it('D minor', () => {
    expect(symbols(diatonicTriads(nat('D'), 'minor'))).toEqual([
      'Dm',
      'E°',
      'F',
      'Gm',
      'A',
      'B♭',
      'C♯°',
    ])
  })
})

describe('diatonicSevenths — minor', () => {
  it('A minor', () => {
    expect(symbols(diatonicSevenths(nat('A'), 'minor'))).toEqual([
      'Am7',
      'Bø7',
      'Cmaj7',
      'Dm7',
      'E7',
      'Fmaj7',
      'G♯°7',
    ])
  })
})

describe('romanToChord', () => {
  it('spot checks', () => {
    expect(chordSymbol(romanToChord(nat('C'), 'major', 4, false))).toBe('G')
    expect(chordSymbol(romanToChord(nat('C'), 'major', 4, true))).toBe('G7')
    expect(chordSymbol(romanToChord(nat('A'), 'minor', 1, true))).toBe('Bø7')
    expect(chordSymbol(romanToChord(nat('A'), 'minor', 6, true))).toBe('G♯°7')
  })
})

describe('all 12 major + 12 minor keys build cleanly', () => {
  it('every diatonic chord is valid and never throws', () => {
    for (const key of KEYS) {
      for (const [tonic, mode] of [
        [key.majorTonic, 'major'],
        [key.minorTonic, 'minor'],
      ] as const) {
        for (const builder of [diatonicTriads, diatonicSevenths]) {
          const chords = builder(tonic, mode)
          expect(chords).toHaveLength(7)
          for (const c of chords) {
            expect(VALID_QUALITIES).toContain(c.quality)
          }
        }
      }
    }
  })
})
