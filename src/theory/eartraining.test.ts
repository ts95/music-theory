import { describe, expect, it } from 'vitest'
import type { EarSpec, Note } from '../contracts'
import {
  realizeEar,
  voicedMidi,
  voiceScaleAscending,
  voiceChordRootPosition,
  type Voiced,
} from './eartraining'
import { majorScale, minorScale } from './scales'
import { romanToChord } from './chords'

const root = (letter: Note['letter'], accidental = 0, octave = 4): Voiced => ({
  note: { letter, accidental },
  octave,
})
const midi = (events: Voiced[][]) => events.map((ev) => ev.map(voicedMidi))
const interval = (semitones: number, letterSteps: number): EarSpec => ({
  kind: 'interval',
  semitones,
  letterSteps,
})

describe('realizeEar — intervals', () => {
  it('major 3rd from C4 → C4, E4', () => {
    const r = realizeEar(interval(4, 2), root('C'))
    expect(midi(r.target)).toEqual([[60], [64]])
    expect(r.style).toBe('melodic')
  })
  it('perfect 5th from C4 → C4, G4', () => {
    expect(midi(realizeEar(interval(7, 4), root('C')).target)).toEqual([[60], [67]])
  })
  it('octave from C4 → C4, C5', () => {
    expect(midi(realizeEar(interval(12, 7), root('C')).target)).toEqual([[60], [72]])
  })
  it('minor 2nd from C4 spells D♭4 (not C♯)', () => {
    const upper = realizeEar(interval(1, 1), root('C')).target[1][0]
    expect(upper.note).toEqual({ letter: 'D', accidental: -1 })
    expect(voicedMidi(upper)).toBe(61)
  })
  it('perfect 5th from E♭4 spells B♭4', () => {
    const upper = realizeEar(interval(7, 4), root('E', -1)).target[1][0]
    expect(upper.note).toEqual({ letter: 'B', accidental: -1 })
  })
})

describe('realizeEar — progressions', () => {
  const prog = (mode: 'major' | 'minor', degrees: number[]): EarSpec => ({
    kind: 'progression',
    mode,
    degrees,
  })

  it('C major I–IV–V → tonic reference + C/F/G triads', () => {
    const r = realizeEar(prog('major', [0, 3, 4]), root('C'))
    expect(midi(r.reference)).toEqual([[60, 64, 67]]) // C major tonic
    expect(midi(r.target)).toEqual([
      [60, 64, 67], // C
      [65, 69, 72], // F
      [67, 71, 74], // G
    ])
    expect(r.style).toBe('block')
  })

  it('A minor i–iv–V uses a major V (raised leading tone G♯)', () => {
    const r = realizeEar(prog('minor', [0, 3, 4]), root('A'))
    // Chord roots sit in the one-octave band at/above the A4 tonic, so iv (D)
    // and V (E) ride up an octave rather than dropping below it.
    expect(midi(r.target)).toEqual([
      [69, 72, 76], // Am
      [74, 77, 81], // Dm (D5, up an octave to stay above the tonic)
      [76, 80, 83], // E major — G♯ (80), not G♮
    ])
  })

  it('keeps every chord root within one octave above the tonic', () => {
    const r = realizeEar(prog('major', [0, 4, 5, 3]), root('F')) // F: I–V–vi–IV
    const tonicMidi = voicedMidi(root('F'))
    for (const chord of r.target) {
      const rootMidi = voicedMidi(chord[0])
      expect(rootMidi).toBeGreaterThanOrEqual(tonicMidi)
      expect(rootMidi).toBeLessThan(tonicMidi + 12)
    }
  })
})

const C: Note = { letter: 'C', accidental: 0 }
const A: Note = { letter: 'A', accidental: 0 }

describe('voiceScaleAscending', () => {
  it('keeps C major within one octave (C4..B4)', () => {
    const v = voiceScaleAscending(majorScale(C))
    expect(v.map((x) => x.octave)).toEqual([4, 4, 4, 4, 4, 4, 4])
    expect(v.map(voicedMidi)).toEqual([60, 62, 64, 65, 67, 69, 71])
  })

  it('bumps the octave when the pitch class wraps (A natural minor)', () => {
    const v = voiceScaleAscending(minorScale(A, 'natural')) // A B C D E F G
    const midi = v.map(voicedMidi)
    for (let i = 1; i < midi.length; i++) expect(midi[i]).toBeGreaterThan(midi[i - 1])
    expect(v[2].note.letter).toBe('C')
    expect(v[2].octave).toBe(5) // C rises above B4 into the next octave
  })
})

describe('voiceChordRootPosition', () => {
  it('voices a triad root-position from octave 4', () => {
    const v = voiceChordRootPosition(romanToChord(C, 'major', 0, false)) // C major
    expect(v.map((x) => x.note.letter)).toEqual(['C', 'E', 'G'])
    expect(v.map(voicedMidi)).toEqual([60, 64, 67])
  })
})
