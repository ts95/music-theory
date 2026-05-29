import type { Note, ScaleType, Hand } from '../contracts'
import { noteToString } from './notes'

/**
 * Standard TWO-octave ascending piano fingerings for the 12 minor keys
 * (tonic .. tonic two octaves up = 15 finger numbers), keyed by minor tonic +
 * hand.
 *
 * Natural, harmonic, and melodic forms conventionally share the same
 * fingering for a given key (the raised 6th/7th fall on the same keys for
 * fingering purposes), so the three `ScaleType` values reuse one table.
 *
 * Each two-octave fingering is the conventional extension of the one-octave
 * fingering: the inner pattern tiles, the octave note is taken by the thumb
 * (RH) / loop pivot (LH), and only the very top note of a "thumb-under" scale
 * (the white-key group) takes the 5th finger — the "looping" scales (F♯/C♯/G♯/
 * D♯, and F/B♭ in the RH) end on their loop finger instead. The thumb never
 * lands on a black key.
 *
 * Sources (verified May 2026):
 *  - pianoscales.org natural & harmonic minor charts — one-octave RH/LH per key
 *    https://www.pianoscales.org/minor.html , https://www.pianoscales.org/minor-harmonic.html
 *  - Baylor "Two-octave scales" — the two-octave construction rule (octave note
 *    = thumb, top note = 5, inner pattern tiles)
 *    https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-scales/
 *  - piano.org per-key minor scale pages — confirm the looping scales end on
 *    their loop finger (e.g. F♯ minor RH ends on 3, LH on 4)
 *    https://piano.org/scales/minor/f-sharp/ , https://piano.org/scales/minor/d-sharp/
 */
const TABLE: Record<string, Record<Hand, number[]>> = {
  // A minor (relative minor of C major) — white-key thumb-under form
  A: {
    RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
    LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
  },
  // E minor (G major)
  E: {
    RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
    LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
  },
  // B minor (D major)
  B: {
    RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
    LH: [4, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1],
  },
  // F# minor (A major) — "looping" scale: ends on 3 (RH) / 4 (LH), not 5
  'F♯': {
    RH: [3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3],
    LH: [4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4],
  },
  // C# minor (E major)
  'C♯': {
    RH: [3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3],
    LH: [3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3],
  },
  // G# minor (B major)
  'G♯': {
    RH: [3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3],
    LH: [3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3],
  },
  // D# minor (F# major) — usually notated E♭ minor; fingering is identical
  'D♯': {
    RH: [3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3],
    LH: [2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2],
  },
  // D minor (F major)
  D: {
    RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
    LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
  },
  // G minor (Bb major)
  G: {
    RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
    LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
  },
  // C minor (Eb major)
  C: {
    RH: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
    LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
  },
  // F minor (Ab major) — RH loops on the 3-4 group, ends on 4 not 5
  F: {
    RH: [1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4],
    LH: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
  },
  // Bb minor (Db major) — thumb only on C/F (the white keys), ends on 4
  'B♭': {
    RH: [2, 1, 2, 3, 1, 2, 3, 2, 1, 2, 3, 1, 2, 3, 4],
    LH: [2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2],
  },
}

/**
 * Conventional 15-number two-octave ascending fingering for a minor scale,
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
