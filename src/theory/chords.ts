import type { Note } from '../contracts'
import { pitchClass, noteToString } from './notes'
import { majorScale, minorScale } from './scales'

export type Mode = 'major' | 'minor'

export type Quality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'maj7'
  | 'dom7'
  | 'min7'
  | 'm7b5'
  | 'dim7'
  | 'mMaj7'

export interface Chord {
  root: Note
  quality: Quality
}

/** Semitones above the root for each quality's chord tones. */
export const QUALITY_INTERVALS: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  mMaj7: [0, 3, 7, 11],
}

const QUALITY_SUFFIX: Record<Quality, string> = {
  maj: '',
  min: 'm',
  dim: '°',
  aug: '+',
  maj7: 'maj7',
  dom7: '7',
  min7: 'm7',
  m7b5: 'ø7',
  dim7: '°7',
  mMaj7: 'm(maj7)',
}

/** Chord symbol, e.g. {G,dom7} → "G7", {B,m7b5} → "Bø7". */
export function chordSymbol(c: Chord): string {
  return noteToString(c.root) + QUALITY_SUFFIX[c.quality]
}

const ALTERNATE_QUALITY: Record<Quality, Quality> = {
  maj: 'min',
  min: 'maj',
  dim: 'min',
  aug: 'maj',
  maj7: 'dom7',
  dom7: 'maj7',
  min7: 'm7b5',
  m7b5: 'min7',
  dim7: 'm7b5',
  mMaj7: 'min7',
}

/**
 * A plausible same-root confusion quality — used to build a distractor that
 * shares the answer's root but differs in quality (e.g. C → Cm), so the root
 * alone never reveals the answer.
 */
export function alternateQuality(q: Quality): Quality {
  return ALTERNATE_QUALITY[q]
}

/** Interval (semitones above root, mod 12) from a chord tone. */
function interval(root: Note, tone: Note): number {
  return (((pitchClass(tone) - pitchClass(root)) % 12) + 12) % 12
}

/**
 * Map a set of intervals above the root to a Quality.
 * Triads use [third, fifth]; sevenths add [seventh].
 * Throws on any unrecognized interval set so bugs surface loudly.
 */
export function qualityFromIntervals(intervals: number[]): Quality {
  const key = intervals.join(',')
  const TRIADS: Record<string, Quality> = {
    '4,7': 'maj',
    '3,7': 'min',
    '3,6': 'dim',
    '4,8': 'aug',
  }
  const SEVENTHS: Record<string, Quality> = {
    '4,7,11': 'maj7',
    '4,7,10': 'dom7',
    '3,7,10': 'min7',
    '3,7,11': 'mMaj7',
    '3,6,10': 'm7b5',
    '3,6,9': 'dim7',
  }
  const table = intervals.length === 2 ? TRIADS : SEVENTHS
  const quality = table[key]
  if (quality === undefined) {
    throw new Error(`Unrecognized chord intervals: [${key}]`)
  }
  return quality
}

/** Build a chord by stacking diatonic thirds on a 7-note scale at degree d. */
function chordOnDegree(scale: Note[], degree: number, seventh: boolean): Chord {
  const root = scale[degree]
  const third = scale[(degree + 2) % 7]
  const fifth = scale[(degree + 4) % 7]
  const intervals = [interval(root, third), interval(root, fifth)]
  if (seventh) {
    const sev = scale[(degree + 6) % 7]
    intervals.push(interval(root, sev))
  }
  return { root, quality: qualityFromIntervals(intervals) }
}

/**
 * For a minor degree, pick the scale form. Degrees 4 (V) and 6 (vii°) use the
 * harmonic minor's raised leading tone; the rest use natural minor.
 */
function minorScaleForDegree(tonic: Note, degree: number): Note[] {
  const type = degree === 4 || degree === 6 ? 'harmonic' : 'natural'
  return minorScale(tonic, type)
}

function diatonicChords(tonic: Note, mode: Mode, seventh: boolean): Chord[] {
  const chords: Chord[] = []
  for (let degree = 0; degree < 7; degree++) {
    const scale =
      mode === 'major'
        ? majorScale(tonic)
        : minorScaleForDegree(tonic, degree)
    chords.push(chordOnDegree(scale, degree, seventh))
  }
  return chords
}

/** The 7 diatonic triads (degree 0..6) for a key. */
export function diatonicTriads(tonic: Note, mode: Mode): Chord[] {
  return diatonicChords(tonic, mode, false)
}

/** The 7 diatonic seventh chords (degree 0..6) for a key. */
export function diatonicSevenths(tonic: Note, mode: Mode): Chord[] {
  return diatonicChords(tonic, mode, true)
}

const MAJOR_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/**
 * Roman-numeral label reflecting chord quality via case and symbols.
 * Uppercase for major/augmented, lowercase for minor/diminished. "°" for
 * diminished triads/dim7, "ø" for half-diminished sevenths. Sevenths append
 * "7" (or "maj7" for major-quality sevenths).
 */
export function romanLabel(
  mode: Mode,
  degree: number,
  seventh: boolean
): string {
  const chord = (seventh ? diatonicSevenths : diatonicTriads)(
    // Tonic spelling is irrelevant to quality/case; use a C reference.
    { letter: 'C', accidental: 0 },
    mode
  )[degree]
  const numeral = MAJOR_NUMERALS[degree]
  const upper = numeral
  const lower = numeral.toLowerCase()

  switch (chord.quality) {
    case 'maj':
      return upper
    case 'aug':
      return upper + '+'
    case 'min':
      return lower
    case 'dim':
      return lower + '°'
    case 'maj7':
      return upper + 'maj7'
    case 'dom7':
      return upper + '7'
    case 'min7':
      return lower + '7'
    case 'm7b5':
      return lower + 'ø7'
    case 'mMaj7':
      return lower + '(maj7)'
    case 'dim7':
      return lower + '°7'
  }
}

/** The concrete chord for a Roman-numeral degree in a key. */
export function romanToChord(
  tonic: Note,
  mode: Mode,
  degree: number,
  seventh: boolean
): Chord {
  return (seventh ? diatonicSevenths : diatonicTriads)(tonic, mode)[degree]
}
