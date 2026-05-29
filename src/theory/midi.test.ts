import { describe, expect, it } from 'vitest'
import { majorScale, minorScale } from './scales'
import { noteMidi, scaleEvents, chordEvents, progressionEvents } from './midi'
import { diatonicTriads } from './chords'
import type { Note } from '../contracts'

const C: Note = { letter: 'C', accidental: 0 }
const F: Note = { letter: 'F', accidental: 0 }
const G: Note = { letter: 'G', accidental: 0 }
const A: Note = { letter: 'A', accidental: 0 }

describe('noteMidi', () => {
  it('maps C4 to 60 and shifts by accidental', () => {
    expect(noteMidi(C)).toBe(60)
    expect(noteMidi({ letter: 'E', accidental: -1 })).toBe(63) // Eb4
    expect(noteMidi({ letter: 'F', accidental: 1 })).toBe(66) // F#4
    expect(noteMidi(C, 5)).toBe(72)
  })

  it('keeps the octave for boundary accidentals (no pitch-class wrap)', () => {
    expect(noteMidi({ letter: 'C', accidental: -1 })).toBe(59) // Cb4 = B3
    expect(noteMidi({ letter: 'B', accidental: 1 })).toBe(72) // B#4 = C5
  })
})

describe('scaleEvents', () => {
  it('renders an ascending C major scale', () => {
    expect(scaleEvents(majorScale(C))).toEqual([
      [60],
      [62],
      [64],
      [65],
      [67],
      [69],
      [71],
    ])
  })

  it('keeps ascending even when the pitch class wraps', () => {
    // C harmonic minor ends on B (pc 11) then is fine; use a scale starting high.
    const events = scaleEvents(minorScale(A, 'natural')) // A B C D E F G
    const flat = events.map((e) => e[0])
    for (let i = 1; i < flat.length; i++) {
      expect(flat[i]).toBeGreaterThan(flat[i - 1])
    }
    expect(flat[0]).toBe(69) // A4
  })
})

describe('chordEvents', () => {
  it('voices a C major triad as one block event', () => {
    expect(chordEvents(C, 'maj')).toEqual([[60, 64, 67]])
  })
  it('voices an F major triad', () => {
    expect(chordEvents(F, 'maj')).toEqual([[65, 69, 72]])
  })
  it('voices a G dominant seventh', () => {
    expect(chordEvents(G, 'dom7')).toEqual([[67, 71, 74, 77]])
  })
})

describe('progressionEvents', () => {
  it('renders C major I–IV–V as block chords in series', () => {
    const triads = diatonicTriads(C, 'major')
    const prog = [triads[0], triads[3], triads[4]] // I, IV, V
    expect(progressionEvents(prog)).toEqual([
      [60, 64, 67],
      [65, 69, 72],
      [67, 71, 74],
    ])
  })
})
