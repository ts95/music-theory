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

const INTERVAL_MNEMONIC: Record<string, string> = {
  'Minor 2nd': 'the two-note "Jaws" theme',
  'Major 2nd': 'the first two notes of "Happy Birthday"',
  'Minor 3rd': 'the opening of "Greensleeves"',
  'Major 3rd': '"When the Saints Go Marching In"',
  'Perfect 4th': '"Here Comes the Bride" / "Amazing Grace"',
  Tritone: '"Maria" from West Side Story (or The Simpsons)',
  'Perfect 5th': '"Twinkle, Twinkle" / the Star Wars theme',
  'Minor 6th': 'the theme from "Love Story"',
  'Major 6th': '"My Bonnie Lies Over the Ocean"',
  'Minor 7th': 'the Star Trek theme',
  'Major 7th': 'the big leap in the chorus of "Take On Me"',
  Octave: '"Somewhere" Over the Rainbow',
}

/** Ear-training: identify an interval by sound. */
export function intervalEarExplanation(name: string, semitones: number): string {
  const hook = INTERVAL_MNEMONIC[name] ?? 'a familiar tune'
  return `${name} = ${semitones} semitone${semitones === 1 ? '' : 's'}. To anchor it, hum ${hook} — that ascending leap is a ${name}.`
}

const PROGRESSION_FEEL: Record<string, string> = {
  'I-IV-V': 'the three primary chords — the basis of blues and countless folk/rock tunes',
  'ii-V-I': 'the backbone cadence of jazz; feel the smooth pull home to I',
  'I-V-vi-IV': 'the "four-chord" pop progression (the Axis of Awesome songs)',
  'I-vi-IV-V': 'the 1950s doo-wop progression',
  'vi-IV-I-V': 'a pop progression that opens on the relative minor',
  'I-IV-vi-V': 'a bright pop turnaround',
  'i-iv-V': 'the minor cadence; the major V (raised leading tone) pulls hard to i',
  'iio-V-i': 'the minor ii°–V–i cadence',
  'i-VI-iv-V': 'a dramatic minor progression',
  'VI-iv-i-V': 'a minor progression opening on VI',
  'i-iv-V-i': 'a full minor cadential loop',
}

/** Ear-training: identify a progression by sound. */
export function progressionEarExplanation(slug: string, label: string): string {
  const feel = PROGRESSION_FEEL[slug] ?? 'a common progression'
  return `That was ${label} — ${feel}. Always hear each chord relative to the tonic played first.`
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
