import type { Note, Voiced } from '../contracts'
import { majorScale, minorScale } from './scales'
import { chordSymbol, qualityFromIntervals, type Mode, type Quality } from './chords'
import { noteToString, pitchClass } from './notes'
import { voiceScaleAscending } from './eartraining'

/**
 * Chord-recognition étude theory: build a diatonic chord of a key (triad,
 * seventh, or clean ninth), name it (chord symbol, with slash notation for
 * inversions), voice it on the staff, and derive the key signature. Pure.
 *
 * Unlike the common-practice set in chords.ts (natural minor except V/vii°),
 * this étude also raises III to the augmented III+ (harmonic minor), so the
 * augmented quality appears. The key signature stays the natural-minor one, so
 * the raised tones print as accidentals — exactly how minor-key chords notate.
 */

export type ChordSize = 'triad' | 'seventh' | 'ninth'

/**
 * Scale a degree's chord is built from. V and vii° always use harmonic minor
 * (dominant V, diminished vii°). III is the augmented III+ only as a TRIAD —
 * its harmonic-minor seventh (an augmented-major 7th) is outside the common
 * chord vocabulary, so sevenths/ninths on III use natural minor (III maj7/maj9).
 */
function scaleForDegree(
  tonic: Note,
  mode: Mode,
  degree: number,
  size: ChordSize
): Note[] {
  if (mode === 'major') return majorScale(tonic)
  const harmonic =
    degree === 4 || degree === 6 || (degree === 2 && size === 'triad')
  return minorScale(tonic, harmonic ? 'harmonic' : 'natural')
}

/** Root-position chord tones (spelled Notes) for a diatonic chord of `size`. */
export function recChordTones(
  tonic: Note,
  mode: Mode,
  degree: number,
  size: ChordSize
): Note[] {
  const s = scaleForDegree(tonic, mode, degree, size)
  const tones = [s[degree], s[(degree + 2) % 7], s[(degree + 4) % 7]]
  if (size === 'seventh' || size === 'ninth') tones.push(s[(degree + 6) % 7])
  if (size === 'ninth') tones.push(s[(degree + 1) % 7])
  return tones
}

/** Interval in semitones (0–11) from `root` up to `tone`. */
const semis = (root: Note, tone: Note): number =>
  (((pitchClass(tone) - pitchClass(root)) % 12) + 12) % 12

/** Clean ninths are a major 9th stacked on a dom7/maj7/min7 → C9 / Cmaj9 / Cm9. */
const NINTH_SUFFIX: Partial<Record<Quality, string>> = {
  dom7: '9',
  maj7: 'maj9',
  min7: 'm9',
}

/** A 5-tone chord whose ninth names cleanly (C9 / Cmaj9 / Cm9). */
export function isCleanNinth(tones: Note[]): boolean {
  if (tones.length !== 5) return false
  const seventh = qualityFromIntervals(tones.slice(1, 4).map((t) => semis(tones[0], t)))
  return NINTH_SUFFIX[seventh] !== undefined && semis(tones[0], tones[4]) === 2
}

/** The chord symbol (no inversion) for spelled tones: triad, seventh, or ninth. */
export function recChordSymbol(tones: Note[]): string {
  const root = tones[0]
  if (tones.length === 5) {
    const seventh = qualityFromIntervals(tones.slice(1, 4).map((t) => semis(root, t)))
    const suffix = NINTH_SUFFIX[seventh]
    if (suffix) return noteToString(root) + suffix
    return chordSymbol({ root, quality: seventh }) // exotic ninth → name the 7th
  }
  return chordSymbol({
    root,
    quality: qualityFromIntervals(tones.slice(1).map((t) => semis(root, t))),
  })
}

/** Append slash notation for an inversion: `C`, `C/E`, `G7/F`. */
export function withInversion(symbol: string, tones: Note[], inversion: number): string {
  return inversion === 0 ? symbol : `${symbol}/${noteToString(tones[inversion])}`
}

/** Voice a chord in an inversion (bass = tone `inversion`), ascending from `octave`. */
export function voiceInversion(
  tones: Note[],
  inversion: number,
  octave: number
): Voiced[] {
  const ordered = [...tones.slice(inversion), ...tones.slice(0, inversion)]
  return voiceScaleAscending(ordered, octave)
}

/** VexFlow key-signature spec for a key, e.g. "Eb", "F#", "Cm", "F#m". */
export function keySignatureSpec(tonic: Note, mode: Mode): string {
  const acc =
    tonic.accidental > 0
      ? '#'.repeat(tonic.accidental)
      : 'b'.repeat(-tonic.accidental)
  return tonic.letter + acc + (mode === 'minor' ? 'm' : '')
}
