import type { Note, ScaleType, Letter } from '../contracts'
import { LETTER_PC, pitchClass } from './notes'

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1]
const NATURAL_MINOR_STEPS = [2, 1, 2, 2, 1, 2, 2]

/** Spell a 7-note scale from a tonic given the ascending semitone steps. */
function spellScale(tonic: Note, steps: number[]): Note[] {
  const tonicLetterIndex = LETTERS.indexOf(tonic.letter)
  const tonicPc = pitchClass(tonic)
  const scale: Note[] = []
  let cumulative = 0
  for (let degree = 0; degree < 7; degree++) {
    const letter = LETTERS[(tonicLetterIndex + degree) % 7]
    const target = (tonicPc + cumulative) % 12
    const accidental = ((target - LETTER_PC[letter] + 6 + 1200) % 12) - 6
    if (accidental < -2 || accidental > 2) {
      throw new Error(
        `Spelling out of range for ${letter}: accidental ${accidental}`
      )
    }
    scale.push({ letter, accidental })
    cumulative += steps[degree]
  }
  return scale
}

/** The 7 ascending notes of a major scale. */
export function majorScale(tonic: Note): Note[] {
  return spellScale(tonic, MAJOR_STEPS)
}

/** The 7 ascending notes of a minor scale (melodic = ascending form). */
export function minorScale(tonic: Note, type: ScaleType): Note[] {
  const scale = spellScale(tonic, NATURAL_MINOR_STEPS)
  if (type === 'harmonic') {
    scale[6] = { ...scale[6], accidental: scale[6].accidental + 1 }
  } else if (type === 'melodic') {
    scale[5] = { ...scale[5], accidental: scale[5].accidental + 1 }
    scale[6] = { ...scale[6], accidental: scale[6].accidental + 1 }
  }
  return scale
}
