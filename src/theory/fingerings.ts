import type { Note, ScaleType, Hand } from '../contracts'
import { noteToString } from './notes'

/**
 * Standard one-octave ascending piano fingerings for the 12 minor keys
 * (tonic .. octave tonic = 8 finger numbers), keyed by minor tonic + hand.
 *
 * Natural, harmonic, and melodic forms conventionally share the same
 * fingering for a given key (the raised 6th/7th fall on the same keys for
 * fingering purposes), so the three `ScaleType` values reuse one table.
 *
 * Sources (verified May 2026):
 *  - UVU Piano "Harmonic minor Scale Fingerings" chart (A, E, B, F#, C#, G#/Ab, D, G, C)
 *    https://www.uvu.edu/music/docs/uvu_harmonic_minor_scale_fingerings.pdf
 *  - pianoscales.org natural & harmonic minor charts (all keys)
 *    https://www.pianoscales.org/minor.html , https://www.pianoscales.org/minor-harmonic.html
 *  - piano-keyboard-guide.com (F# minor, Bb minor cross-checks)
 */
const TABLE: Record<string, Record<Hand, number[]>> = {
  // A minor (relative minor of C major)
  A: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  // E minor (G major)
  E: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  // B minor (D major)
  B: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [4, 3, 2, 1, 4, 3, 2, 1] },
  // F# minor (A major)
  'F♯': { RH: [3, 4, 1, 2, 3, 1, 2, 3], LH: [4, 3, 2, 1, 3, 2, 1, 4] },
  // C# minor (E major)
  'C♯': { RH: [3, 4, 1, 2, 3, 1, 2, 3], LH: [3, 2, 1, 4, 3, 2, 1, 3] },
  // G# minor (B major)
  'G♯': { RH: [3, 4, 1, 2, 3, 1, 2, 3], LH: [3, 2, 1, 4, 3, 2, 1, 3] },
  // D# minor (F# major)
  'D♯': { RH: [3, 1, 2, 3, 4, 1, 2, 3], LH: [2, 1, 4, 3, 2, 1, 3, 2] },
  // D minor (F major)
  D: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  // G minor (Bb major)
  G: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  // C minor (Eb major)
  C: { RH: [1, 2, 3, 1, 2, 3, 4, 5], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  // F minor (Ab major)
  F: { RH: [1, 2, 3, 4, 1, 2, 3, 4], LH: [5, 4, 3, 2, 1, 3, 2, 1] },
  // Bb minor (Db major)
  'B♭': { RH: [2, 1, 2, 3, 1, 2, 3, 4], LH: [2, 1, 3, 2, 1, 4, 3, 2] },
}

/**
 * Conventional 8-number one-octave ascending fingering for a minor scale,
 * looked up by tonic + hand. Returns null for a tonic with no verified entry.
 * `type` is accepted for API completeness; the three forms share a fingering.
 */
export function fingering(
  tonic: Note,
  _type: ScaleType,
  hand: Hand
): number[] | null {
  const entry = TABLE[noteToString(tonic)]
  return entry ? entry[hand] : null
}
