import type { Hand, Note, ScaleType } from '../contracts'
import type { Chord, Mode, Quality } from '../theory'
import { chordSymbol, majorScale, minorScale, noteToString, romanLabel } from '../theory'

/**
 * Memory tips shown when a question is missed: a rule/pattern plus the worked
 * example for that specific question. Pure and deterministic — computed from
 * the same theory the questions are built from.
 */

const spell = (notes: Note[]): string => notes.map(noteToString).join(' – ')

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th']

const QUALITY_WORD: Record<Quality, string> = {
  maj: 'major',
  min: 'minor',
  dim: 'diminished',
  aug: 'augmented',
  maj7: 'major 7th',
  dom7: 'dominant 7th',
  min7: 'minor 7th',
  m7b5: 'half-diminished 7th',
  dim7: 'diminished 7th',
  mMaj7: 'minor-major 7th',
}

const TRIAD_PATTERN: Record<Mode, string> = {
  major:
    'I ii iii IV V vi vii° (major · minor · minor · major · major · minor · diminished)',
  minor:
    'i ii° III iv V VI vii° (minor · diminished · major · minor · major · major · diminished)',
}

/** "What is the relative minor of C major?" */
export function relativeMinorExplanation(
  majorTonic: Note,
  majorName: string,
  minorName: string
): string {
  const upToSixth = majorScale(majorTonic).slice(0, 6).map(noteToString).join('–')
  return `${minorName} is the 6th degree of ${majorName} — a minor 3rd (3 half-steps) below the tonic: ${upToSixth}. Relatives share a key signature; the minor scale just starts on that 6th note.`
}

/** "What are the notes of the E♭ harmonic minor scale?" */
export function scaleExplanation(
  tonic: Note,
  type: ScaleType,
  relativeMajorName: string
): string {
  const T = noteToString(tonic)
  const nat = minorScale(tonic, 'natural')
  if (type === 'natural') {
    return `${T} natural minor borrows the key signature of its relative major, ${relativeMajorName}. From the tonic the step pattern is W–H–W–W–H–W–W: ${spell(nat)}.`
  }
  if (type === 'harmonic') {
    const h = minorScale(tonic, 'harmonic')
    return `Harmonic minor = natural minor with a raised 7th. In ${T}, raise ${noteToString(nat[6])} to ${noteToString(h[6])} (the leading tone): ${spell(h)}.`
  }
  const m = minorScale(tonic, 'melodic')
  return `Melodic minor (ascending) = natural minor with a raised 6th AND 7th. In ${T}, ${noteToString(nat[5])}→${noteToString(m[5])} and ${noteToString(nat[6])}→${noteToString(m[6])}: ${spell(m)}.`
}

/** "What is the standard right-hand fingering for the C minor scale?" */
export function fingeringExplanation(
  tonic: Note,
  hand: Hand,
  fingers: number[]
): string {
  const handWord = hand === 'RH' ? 'right' : 'left'
  const cross =
    hand === 'RH'
      ? 'the thumb tucks under after the 3rd finger'
      : 'the 3rd finger crosses over the thumb'
  return `Standard ${handWord}-hand fingering for ${noteToString(tonic)} minor (one octave): ${fingers.join(' ')}. Key rule: the thumb (1) never plays a black key — that fixes where ${cross}. Drill hands separately until the crossing is automatic.`
}

/** "In C major, what is the IV chord?" */
export function chordExplanation(
  keyName: string,
  mode: Mode,
  degree: number,
  seventh: boolean,
  chord: Chord
): string {
  const roman = romanLabel(mode, degree, seventh)
  const primary =
    mode === 'major' ? ' Tip: the primary chords I, IV, V are the major ones.' : ''
  return `The ${roman} chord is built on the ${ORDINALS[degree]} degree of ${keyName} (root ${noteToString(chord.root)}). A ${mode} key's diatonic chords run ${TRIAD_PATTERN[mode]}, so ${roman} is ${QUALITY_WORD[chord.quality]} → ${chordSymbol(chord)}.${primary}`
}

/** "In G major, spell the progression ii–V–I." */
export function progressionExplanation(
  keyName: string,
  romans: string[],
  symbols: string[],
  slug: string
): string {
  const reads = romans.map((r, i) => `${r}=${symbols[i]}`).join(', ')
  const famous =
    slug === 'ii-V-I'
      ? ' ii–V–I is the backbone cadence of tonal harmony.'
      : slug === 'iio-V-i'
        ? ' This is the minor-key ii°–V–i cadence.'
        : ''
  return `Number the scale degrees of ${keyName}, then read each numeral: ${reads}. Uppercase = major, lowercase = minor, ° = diminished.${famous}`
}
