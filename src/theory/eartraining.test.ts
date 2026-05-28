import { describe, expect, it } from 'vitest'
import type { EarSpec, Note } from '../contracts'
import { realizeEar, voicedMidi, type Voiced } from './eartraining'

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
    expect(midi(r.target)).toEqual([
      [69, 72, 76], // Am
      [62, 65, 69], // Dm
      [64, 68, 71], // E major — G♯ (68), not G♮
    ])
  })
})
