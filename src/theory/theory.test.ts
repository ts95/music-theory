import { describe, it, expect } from 'vitest'
import type { Note } from '../contracts'
import {
  KEYS,
  noteToString,
  majorScale,
  minorScale,
  fingering,
  chordFingering,
  pitchClass,
  recChordTones,
  recChordSymbol,
  withInversion,
  isCleanNinth,
  keySignatureSpec,
  realizeEar,
  solfege,
  voicedMidi,
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
  it('A minor RH/LH (two octaves)', () => {
    expect(fingering(nat('A'), 'natural', 'RH')).toEqual(
      [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
    )
    expect(fingering(nat('A'), 'natural', 'LH')).toEqual(
      [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
    )
  })
  it('root-position block-chord fingerings (triad & seventh)', () => {
    expect(chordFingering(3, 'RH')).toEqual([1, 3, 5])
    expect(chordFingering(3, 'LH')).toEqual([5, 3, 1])
    expect(chordFingering(4, 'RH')).toEqual([1, 2, 3, 5])
    expect(chordFingering(4, 'LH')).toEqual([5, 3, 2, 1])
  })
  it('shares fingering across the three forms', () => {
    expect(fingering(sharp('F'), 'natural', 'RH')).toEqual(
      fingering(sharp('F'), 'harmonic', 'RH')
    )
    expect(fingering(sharp('F'), 'melodic', 'LH')).toEqual(
      fingering(sharp('F'), 'natural', 'LH')
    )
  })
  it('all 12 minor tonics resolve, each 15 numbers (two octaves)', () => {
    const BLACK = new Set([1, 3, 6, 8, 10]) // black-key pitch classes
    for (const k of KEYS) {
      // The two-octave note line each fingering is assigned against.
      const nat = minorScale(k.minorTonic, 'natural')
      const notes = [...nat, ...nat, nat[0]]
      for (const hand of ['RH', 'LH'] as const) {
        const f = fingering(k.minorTonic, 'harmonic', hand)
        expect(f, `${k.minorName} ${hand}`).not.toBeNull()
        expect(f!, `${k.minorName} ${hand}`).toHaveLength(15)
        // The cardinal rule: the thumb (1) never lands on a black key.
        f!.forEach((finger, i) => {
          if (finger === 1) {
            expect(
              BLACK.has(pitchClass(notes[i])),
              `${k.minorName} ${hand}: thumb on ${noteToString(notes[i])}`
            ).toBe(false)
          }
        })
      }
    }
  })
})

describe('chord recognition theory', () => {
  it('names diatonic triads, sevenths, and clean ninths', () => {
    // C major: I triad, V9 (dominant + major 9th), IVmaj7.
    expect(recChordSymbol(recChordTones(nat('C'), 'major', 0, 'triad'))).toBe('C')
    expect(recChordSymbol(recChordTones(nat('C'), 'major', 4, 'ninth'))).toBe('G9')
    expect(recChordSymbol(recChordTones(nat('C'), 'major', 3, 'seventh'))).toBe(
      'Fmaj7'
    )
  })
  it('III is augmented as a triad (harmonic minor)', () => {
    // A minor: III+ = C E G♯.
    const tones = recChordTones(nat('A'), 'minor', 2, 'triad')
    expect(tones.map(noteToString)).toEqual(['C', 'E', 'G♯'])
    expect(recChordSymbol(tones)).toBe('C+')
  })
  it('every diatonic chord across all keys names without throwing', () => {
    const sizes = ['triad', 'seventh', 'ninth'] as const
    for (const k of KEYS) {
      for (const [tonic, mode] of [
        [k.majorTonic, 'major'],
        [k.minorTonic, 'minor'],
      ] as const) {
        for (let d = 0; d < 7; d++) {
          for (const size of sizes) {
            const tones = recChordTones(tonic, mode, d, size)
            expect(() => recChordSymbol(tones)).not.toThrow()
          }
        }
      }
    }
  })
  it('appends slash notation for inversions', () => {
    const tones = recChordTones(nat('C'), 'major', 0, 'triad') // C E G
    expect(withInversion('C', tones, 0)).toBe('C')
    expect(withInversion('C', tones, 1)).toBe('C/E')
    expect(withInversion('C', tones, 2)).toBe('C/G')
  })
  it('clean-ninth detection: V9 yes, a half-diminished ninth no', () => {
    expect(isCleanNinth(recChordTones(nat('C'), 'major', 4, 'ninth'))).toBe(true)
    // vii in C major is the half-diminished chord — its ninth is not clean.
    expect(isCleanNinth(recChordTones(nat('C'), 'major', 6, 'ninth'))).toBe(false)
  })
  it('maps keys to VexFlow key-signature specs', () => {
    expect(keySignatureSpec(flat('E'), 'major')).toBe('Eb')
    expect(keySignatureSpec(sharp('F'), 'minor')).toBe('F#m')
    expect(keySignatureSpec(nat('C'), 'minor')).toBe('Cm')
  })
})

describe('melodic dictation theory', () => {
  it('do-based solfège per mode', () => {
    expect([0, 1, 2, 7].map((d) => solfege('major', d))).toEqual([
      'do', 're', 'mi', 'do',
    ])
    // Natural minor lowers 3, 6, 7 → me, le, te.
    expect([2, 5, 6].map((d) => solfege('minor', d))).toEqual(['me', 'le', 'te'])
  })

  it('realizes a melody from a tonic: I-chord anchor + the degree pitches', () => {
    const root = { note: nat('C'), octave: 4 }
    const r = realizeEar({ kind: 'melody', mode: 'major', degrees: [0, 2, 4, 0] }, root)
    expect(r.style).toBe('melodic')
    // do mi sol do over C: C4 E4 G4 C4.
    expect(r.target.map((ev) => ev.map(voicedMidi))).toEqual([[60], [64], [67], [60]])
    // Reference is the tonic triad (C E G).
    expect(r.reference[0].map(voicedMidi)).toEqual([60, 64, 67])
  })
})
