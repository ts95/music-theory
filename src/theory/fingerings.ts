import type { Note, ScaleType, Hand } from '../contracts'
import { noteToString } from './notes'

/**
 * Standard ascending piano fingerings (1 = thumb … 5 = pinky), keyed by tonic +
 * hand, for one octave (8 notes) and two octaves (15 notes), for both the 12
 * major keys and the 12 minor keys. Minor's natural / harmonic / melodic forms
 * conventionally share one fingering (the raised 6th/7th fall on the same keys
 * for fingering purposes), so the three `ScaleType` values reuse one table.
 *
 * Two-octave rule: the one-octave loop tiles, the mid octave note is taken by
 * the thumb (RH) / pivot (LH), and only the very top note of a "thumb-under"
 * (white-key) scale takes the 5th finger — the "looping" scales (F♯/C♯/G♯/D♯
 * minor; F/B♭/E♭/A♭/D♭/F♯ major) end on their loop finger instead. The thumb
 * never lands on a black key.
 *
 * Sources (cross-verified May 2026):
 *  - pianoscales.org major & minor charts — per-key one-octave RH/LH
 *    https://www.pianoscales.org/major.html , https://www.pianoscales.org/minor.html
 *  - Baylor "Two-octave scales" — the two-octave construction rule
 *    https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-scales/
 *  - per-key references for the looping/flat keys (e.g. D♭, F♯, B major LH)
 *    https://littleredpiano.com/db-major-scale-piano/
 * The two-octave minor table is the original verified data; the one-octave forms
 * and all major forms were added for the interactive "Play the Scale" étude.
 */

type Table = Record<string, Record<Hand, number[]>>

// ── Minor, two octaves (15) ──────────────────────────────────────────────────
const MINOR_2OCT: Table = {
  A: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  E: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  B: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [4, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1] },
  'F♯': { RH: [3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3], LH: [4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4] },
  'C♯': { RH: [3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3], LH: [3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3] },
  'G♯': { RH: [3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3], LH: [3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3] },
  'D♯': { RH: [3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3], LH: [2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2] },
  D: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  G: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  C: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  F: { RH: [1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  'B♭': { RH: [2, 1, 2, 3, 1, 2, 3, 2, 1, 2, 3, 1, 2, 3, 4], LH: [2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2] },
}

// ── Minor, one octave (8) ────────────────────────────────────────────────────
const MINOR_1OCT: Table = {
  A: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  E: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  B: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [4, 3, 2, 1, 4, 3, 2, 1] },
  'F♯': { RH: [2, 3, 1, 2, 3, 1, 2, 3], LH: [4, 3, 2, 1, 3, 2, 1, 4] },
  'C♯': { RH: [3, 4, 1, 2, 3, 1, 2, 3], LH: [3, 2, 1, 4, 3, 2, 1, 3] },
  'G♯': { RH: [3, 4, 1, 2, 3, 1, 2, 3], LH: [3, 2, 1, 3, 2, 1, 4, 3] },
  'D♯': { RH: [3, 1, 2, 3, 4, 1, 2, 3], LH: [2, 1, 4, 3, 2, 1, 3, 2] },
  D: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  G: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  C: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  F: { RH: [1, 2, 3, 4, 1, 2, 3, 4], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  'B♭': { RH: [2, 1, 2, 3, 1, 2, 3, 4], LH: [2, 1, 3, 2, 1, 4, 3, 2] },
}

// ── Major, two octaves (15) ──────────────────────────────────────────────────
const MAJOR_2OCT: Table = {
  C: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  G: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  D: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  A: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  E: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  B: { RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5], LH: [4, 3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
  'F♯': { RH: [2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2], LH: [4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4] },
  'D♭': { RH: [2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2], LH: [3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3] },
  'A♭': { RH: [3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3], LH: [3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3] },
  'E♭': { RH: [3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3], LH: [3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3] },
  'B♭': { RH: [2, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4], LH: [3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3] },
  F: { RH: [1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4], LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1] },
}

// ── Major, one octave (8) ────────────────────────────────────────────────────
const MAJOR_1OCT: Table = {
  C: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  G: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  D: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  A: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  E: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  B: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [4, 3, 2, 1, 4, 3, 2, 1] },
  'F♯': { RH: [2, 3, 4, 1, 2, 3, 1, 2], LH: [4, 3, 2, 1, 3, 2, 1, 4] },
  'D♭': { RH: [2, 3, 1, 2, 3, 4, 1, 2], LH: [3, 2, 1, 4, 3, 2, 1, 3] },
  'A♭': { RH: [3, 4, 1, 2, 3, 1, 2, 3], LH: [3, 2, 1, 4, 3, 2, 1, 3] },
  'E♭': { RH: [3, 1, 2, 3, 4, 1, 2, 3], LH: [3, 2, 1, 4, 3, 2, 1, 3] },
  'B♭': { RH: [2, 1, 2, 3, 1, 2, 3, 4], LH: [3, 2, 1, 4, 3, 2, 1, 3] },
  F: { RH: [1, 2, 3, 4, 1, 2, 3, 4], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
}

/**
 * Conventional ascending fingering for a MINOR scale, by tonic + hand + octaves
 * (8 or 15 numbers). Returns null for a tonic with no verified entry. `type` is
 * accepted for API completeness; the three forms share a fingering.
 */
export function fingering(
  tonic: Note,
  _type: ScaleType,
  hand: Hand,
  octaves: 1 | 2 = 2
): number[] | null {
  const entry = (octaves === 1 ? MINOR_1OCT : MINOR_2OCT)[noteToString(tonic)]
  return entry ? entry[hand] : null
}

/** As `fingering`, but for a MAJOR scale (no scale-type variants). */
export function majorFingering(
  tonic: Note,
  hand: Hand,
  octaves: 1 | 2 = 2
): number[] | null {
  const entry = (octaves === 1 ? MAJOR_1OCT : MAJOR_2OCT)[noteToString(tonic)]
  return entry ? entry[hand] : null
}

/**
 * Standard fingering for a root-position block chord (notes ascending), by note
 * count: triads use 1-3-5 (RH) / 5-3-1 (LH); sevenths use 1-2-3-5 (RH) /
 * 5-3-2-1 (LH). These are the close-position chord fingerings taught in method
 * books — and unlike scales, the thumb may fall on a black key in a chord.
 * Sources: piano-play-it.com/7th-chords.html, pianoguidelessons.com/fingering-chords-on-piano
 */
export function chordFingering(noteCount: number, hand: Hand): number[] {
  if (noteCount >= 4) return hand === 'RH' ? [1, 2, 3, 5] : [5, 3, 2, 1]
  return hand === 'RH' ? [1, 3, 5] : [5, 3, 1]
}
