import type { Letter, Note } from '../contracts'

/** Pitch class (0–11) of each natural letter. */
export const LETTER_PC: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/** Pitch class (0–11) of a spelled note. */
export function pitchClass(note: Note): number {
  return (((LETTER_PC[note.letter] + note.accidental) % 12) + 12) % 12
}

const ACCIDENTAL_GLYPH: Record<number, string> = {
  [-2]: '\u{1D12B}', // double-flat 𝄫
  [-1]: '♭', // flat ♭
  0: '',
  1: '♯', // sharp ♯
  2: '\u{1D12A}', // double-sharp 𝄪
}

/** Display a note with unicode accidentals, e.g. {E,-1} → "E♭". */
export function noteToString(note: Note): string {
  const glyph = ACCIDENTAL_GLYPH[note.accidental]
  if (glyph === undefined) {
    throw new Error(`Unsupported accidental: ${note.accidental}`)
  }
  return note.letter + glyph
}
