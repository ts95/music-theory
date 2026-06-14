import type { Letter, Voiced } from '../contracts'
import { noteMidi } from './midi'

/**
 * Interval shorthand (quality + number) between two voiced notes — P5, m3, M3,
 * A4, d5, M10, … — spelled from the notes' letters and accidentals, so it stays
 * correct where equal semitone counts disagree: C–E♭ is m3 but C–D♯ is A2, and
 * F–B is A4 while B–F is d5. Direction is ignored (the magnitude only); callers
 * that want melodic contour add their own ↑/↓.
 */

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

// Semitone span of each simple diatonic interval in its perfect/major form,
// indexed by simple letter-steps 0–6 (unison, 2nd, 3rd … 7th).
const REF_SEMITONES = [0, 2, 4, 5, 7, 9, 11]
// Letter-steps whose intervals are of the perfect family (unison, 4th, 5th, and
// the octave, which reduces to a unison); the rest are major/minor.
const PERFECT = new Set([0, 3, 4])

/** Diatonic-letter position: 7·octave + letter index (C=0 … B=6). */
const letterPos = (v: Voiced): number => LETTERS.indexOf(v.note.letter) + 7 * v.octave

/** Quality letter(s) from how far the actual span deviates (in semitones) from
 *  the interval's perfect/major reference: 0 = P or M, −1 = m, + = augmented,
 *  − = diminished (one past minor, for the major/minor family). */
function quality(simpleSteps: number, deviation: number): string {
  if (PERFECT.has(simpleSteps)) {
    if (deviation === 0) return 'P'
    return deviation > 0 ? 'A'.repeat(deviation) : 'd'.repeat(-deviation)
  }
  if (deviation === 0) return 'M'
  if (deviation === -1) return 'm'
  return deviation > 0 ? 'A'.repeat(deviation) : 'd'.repeat(-deviation - 1)
}

export function intervalShorthand(a: Voiced, b: Voiced): string {
  const letterSteps = Math.abs(letterPos(b) - letterPos(a))
  const semitones = Math.abs(noteMidi(b.note, b.octave) - noteMidi(a.note, a.octave))
  const simpleSteps = letterSteps % 7
  const octaves = Math.floor(letterSteps / 7)
  const deviation = semitones - (REF_SEMITONES[simpleSteps] + 12 * octaves)
  return `${quality(simpleSteps, deviation)}${letterSteps + 1}`
}
