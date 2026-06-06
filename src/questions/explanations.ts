import type { Note, RhythmEvent, ScaleKind, TimeSig } from '../contracts'
import type { Chord, Mode, Quality } from '../theory'
import { chordSymbol, majorScale, minorScale, noteToString, pitchClass, romanLabel } from '../theory'

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

/**
 * "What are the notes of the E♭ harmonic minor scale?" — and every other flavour
 * the Scales étude asks about: major, the 3 minor forms, and the modes.
 * `notes` is the already-spelled correct scale (so callers don't recompute it);
 * `relativeMajorName` is only used by the natural-minor tip.
 */
export function scaleExplanation(
  tonic: Note,
  kind: ScaleKind,
  notes: Note[],
  relativeMajorName: string
): string {
  const T = noteToString(tonic)
  if (kind === 'major') {
    return `The major scale is the W–W–H–W–W–W–H pattern from the tonic — every key's reference scale: ${spell(notes)}.`
  }
  const nat = minorScale(tonic, 'natural')
  if (kind === 'natural') {
    return `${T} natural minor borrows the key signature of its relative major, ${relativeMajorName}. From the tonic the step pattern is W–H–W–W–H–W–W: ${spell(nat)}.`
  }
  if (kind === 'harmonic') {
    return `Harmonic minor = natural minor with a raised 7th. In ${T}, raise ${noteToString(nat[6])} to ${noteToString(notes[6])} (the leading tone): ${spell(notes)}.`
  }
  if (kind === 'melodic') {
    return `Melodic minor (ascending) = natural minor with a raised 6th AND 7th. In ${T}, ${noteToString(nat[5])}→${noteToString(notes[5])} and ${noteToString(nat[6])}→${noteToString(notes[6])}: ${spell(notes)}.`
  }
  // Modes — describe each as an alteration of the parallel major or natural minor.
  const MODE_RULE: Record<'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian', string> = {
    dorian: 'Dorian = natural minor with a raised 6th',
    phrygian: 'Phrygian = natural minor with a flat 2nd',
    lydian: 'Lydian = major with a raised 4th',
    mixolydian: 'Mixolydian = major with a flat 7th',
    locrian: 'Locrian = natural minor with a flat 2nd and flat 5th',
  }
  return `${MODE_RULE[kind]}. In ${T}: ${spell(notes)}.`
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

/** "Name the chord shown" (chord-recognition étude). */
export function chordRecognitionExplanation(
  symbol: string,
  keyName: string,
  roman: string,
  inversionName: string,
  tones: Note[]
): string {
  const spelled = tones.map(noteToString).join('–')
  return `Re-stack the notes in thirds to find the root, read the 3rd and 5th (plus any 7th/9th) for the quality, and take the lowest note for the inversion. Here it's ${symbol} — the ${roman} of ${keyName}, in ${inversionName}: ${spelled}.`
}

/** Semitones (0–11) from a chord tone up to another. */
const semisAbove = (root: Note, tone: Note): number =>
  (((pitchClass(tone) - pitchClass(root)) % 12) + 12) % 12

/** Interval of each chord tone above the root, named for the explanation. */
const CHORD_INTERVAL_NAME: Record<number, string> = {
  2: 'a major 9th',
  3: 'a minor 3rd',
  4: 'a major 3rd',
  6: 'a diminished 5th',
  7: 'a perfect 5th',
  8: 'an augmented 5th',
  9: 'a diminished 7th',
  10: 'a minor 7th',
  11: 'a major 7th',
}

/** "Spell the chord Cm7" (chord-spelling étude). */
export function chordSpellingExplanation(symbol: string, tones: Note[]): string {
  const root = tones[0]
  const intervals = tones
    .slice(1)
    .map((t) => CHORD_INTERVAL_NAME[semisAbove(root, t)])
    .join(', ')
  return `Read the root (${noteToString(root)}) from the letter, then the suffix for the quality. Stack ${intervals} above it, one letter per tone: ${symbol} = ${spell(tones)}.`
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

/** Simple-interval name for the part of a compound interval above the octave. */
const SIMPLE_PART: Record<number, string> = {
  1: 'minor 2nd', 2: 'major 2nd', 3: 'minor 3rd', 4: 'major 3rd',
  5: 'perfect 4th', 7: 'perfect 5th', 9: 'major 6th',
}

/** Ear-training: identify an interval by sound. */
export function intervalEarExplanation(name: string, semitones: number): string {
  if (semitones > 12) {
    const part = SIMPLE_PART[semitones - 12] ?? 'simple interval'
    return `${name} = ${semitones} semitones — a compound interval: an octave plus a ${part}. Hear the octave first, then the extra ${part} stacked on top.`
  }
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

/** Ear-training: identify a short melody by sound (solfège). */
export function melodicDictationExplanation(
  mode: Mode,
  degrees: number[],
  solfegeStr: string
): string {
  const numbers = degrees.map((d) => (d % 7) + 1).join('–')
  const ladder = mode === 'major' ? 'do re mi fa sol la ti' : 'do re me fa sol le te'
  return `Solfège is movable — it names the scale degree, not a fixed letter: ${ladder} = degrees 1–7 up from the tonic (do). ${solfegeStr} = degrees ${numbers} in ${mode}; the tonic chord at the start anchors "do".`
}

const REST_NAME: Record<RhythmEvent['dur'], string> = {
  w: 'whole rest',
  h: 'half rest',
  q: 'quarter rest',
  '8': 'eighth rest',
  '16': 'sixteenth rest',
  '32': 'thirty-second rest',
}
const NOTE_NAME: Record<RhythmEvent['dur'], string> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': 'sixteenth',
  '32': 'thirty-second',
}

/** Ear-training: identify a one-bar rhythm by sound. */
export function rhythmDictationExplanation(
  pattern: RhythmEvent[],
  meter: TimeSig
): string {
  const words: string[] = []
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    if (e.triplet) {
      words.push('eighth-note triplet')
      i += 2 // collapse the run of three
      continue
    }
    const dotted = e.dots ? 'dotted ' : ''
    words.push(e.rest ? REST_NAME[e.dur] : `${dotted}${NOTE_NAME[e.dur]}`)
  }
  const feel =
    meter === '6/8' ? 'two dotted-quarter beats' : `${meter.split('/')[0]} beats`
  const tied = pattern.some((e) => e.tie)
    ? ' A tie holds a note across — its second notehead isn’t re-struck.'
    : ''
  return `In ${meter} (${feel}), group by the beat. The bar is: ${words.join(', ')}.${tied} Tap the pulse and slot each onset against it.`
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
