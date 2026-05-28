import type { Hand, Note, Question, ScaleType } from '../contracts'
import {
  KEYS,
  chordSymbol,
  diatonicTriads,
  fingering,
  minorScale,
  noteToString,
  romanLabel,
  romanToChord,
} from '../theory'
import type { Mode } from '../theory'

const SCALE_TYPES: ScaleType[] = ['natural', 'harmonic', 'melodic']
const HANDS: Hand[] = ['RH', 'LH']

const TYPE_WORD: Record<ScaleType, string> = {
  natural: 'natural minor',
  harmonic: 'harmonic minor',
  melodic: 'melodic minor',
}

const HAND_WORD: Record<Hand, string> = {
  RH: 'right-hand',
  LH: 'left-hand',
}

/** ASCII, space-free, stable id fragment for a tonic, e.g. "Eb", "F#", "Cx". */
function asciiTonicId(note: Note): string {
  let acc = ''
  if (note.accidental > 0) {
    acc = note.accidental === 2 ? 'x' : '#'.repeat(note.accidental)
  } else if (note.accidental < 0) {
    acc = 'b'.repeat(-note.accidental)
  }
  return note.letter + acc
}

/** Render a scale's notes as a single display string, e.g. "C – D – E♭". */
function renderScale(notes: Note[]): string {
  return notes.map(noteToString).join(' – ')
}

/**
 * Build a Question with deterministic choice ordering. Choices are sorted
 * with localeCompare so the answer isn't always first, with zero randomness.
 * `distractors` may contain extras/dupes; they are filtered to be distinct
 * from `correct` and each other, then the first three are used.
 */
function buildQuestion(
  etudeId: string,
  id: string,
  category: string,
  prompt: string,
  correct: string,
  distractors: string[]
): Question {
  const picked: string[] = []
  for (const d of distractors) {
    if (d === correct || picked.includes(d)) continue
    picked.push(d)
    if (picked.length === 3) break
  }
  const choices = [correct, ...picked].sort((a, b) => a.localeCompare(b))
  return {
    id,
    etudeId,
    category,
    prompt,
    choices,
    answerIndex: choices.indexOf(correct),
  }
}

/** 1. Relative-minor recall: one per key. */
function relativeMinorQuestions(): Question[] {
  return KEYS.map((key) => {
    const distractors = KEYS.filter((k) => k !== key).map((k) => k.minorName)
    return buildQuestion(
      'keys',
      `rel-minor:${asciiTonicId(key.majorTonic)}`,
      'Relative minor',
      `What is the relative minor of ${key.majorName}?`,
      key.minorName,
      distractors
    )
  })
}

/** 2. Scale spelling: one per (key, scale type). */
function scaleSpellingQuestions(): Question[] {
  const questions: Question[] = []
  for (const key of KEYS) {
    for (const type of SCALE_TYPES) {
      const correct = renderScale(minorScale(key.minorTonic, type))
      // Strongest distractors: the other two forms of the same tonic.
      const distractors = SCALE_TYPES.filter((t) => t !== type).map((t) =>
        renderScale(minorScale(key.minorTonic, t))
      )
      // Fill any remaining slots with the same type from other keys.
      for (const other of KEYS) {
        if (other === key) continue
        distractors.push(renderScale(minorScale(other.minorTonic, type)))
      }
      questions.push(
        buildQuestion(
          'keys',
          `scale-notes:${asciiTonicId(key.minorTonic)}:${type}`,
          'Scale spelling',
          `What are the notes of the ${noteToString(key.minorTonic)} ${TYPE_WORD[type]} scale?`,
          correct,
          distractors
        )
      )
    }
  }
  return questions
}

/** 3. Piano fingerings: one per (key, hand), skipping null fingerings. */
function fingeringQuestions(): Question[] {
  // Pool of every available fingering string, for distractors.
  const pool: string[] = []
  for (const key of KEYS) {
    for (const hand of HANDS) {
      const f = fingering(key.minorTonic, 'natural', hand)
      if (f) pool.push(f.join(' '))
    }
  }

  const questions: Question[] = []
  for (const key of KEYS) {
    for (const hand of HANDS) {
      const f = fingering(key.minorTonic, 'natural', hand)
      if (!f) continue
      const correct = f.join(' ')
      questions.push(
        buildQuestion(
          'keys',
          `fingering:${asciiTonicId(key.minorTonic)}:${hand}`,
          'Fingering',
          `What is the standard ${HAND_WORD[hand]} fingering for the ${noteToString(
            key.minorTonic
          )} minor scale (one octave, ascending)?`,
          correct,
          pool
        )
      )
    }
  }
  return questions
}

/** (tonic, name) for a key in a given mode. */
function keyForMode(
  key: (typeof KEYS)[number],
  mode: Mode
): { tonic: Note; name: string } {
  return mode === 'major'
    ? { tonic: key.majorTonic, name: key.majorName }
    : { tonic: key.minorTonic, name: key.minorName }
}

/** The trimmed degree set for chord questions: I/i, ii/ii°, IV/iv, V, vi/VI, vii°. */
const CHORD_DEGREES = [0, 1, 3, 4, 5, 6]

/**
 * 4. Diatonic chords by Roman-numeral degree, for both modes of every key.
 * Trimmed triad set plus the V7. Distractors lead with the same degree in
 * other keys of the same mode (forcing key knowledge), then the other
 * diatonic chords of the same key.
 */
function chordDegreeQuestions(): Question[] {
  const modes: Mode[] = ['major', 'minor']
  const questions: Question[] = []
  for (const key of KEYS) {
    for (const mode of modes) {
      const { tonic, name } = keyForMode(key, mode)
      // (degree, seventh) pairs: trimmed triads + V7.
      const specs: Array<{ degree: number; seventh: boolean }> = [
        ...CHORD_DEGREES.map((degree) => ({ degree, seventh: false })),
        { degree: 4, seventh: true },
      ]
      for (const { degree, seventh } of specs) {
        const roman = romanLabel(mode, degree, seventh)
        const correct = chordSymbol(romanToChord(tonic, mode, degree, seventh))

        // Strongest: the same degree in other keys of the same mode.
        const distractors: string[] = []
        for (const other of KEYS) {
          if (other === key) continue
          const ot = keyForMode(other, mode).tonic
          distractors.push(chordSymbol(romanToChord(ot, mode, degree, seventh)))
        }
        // Then the other diatonic chords within this key.
        for (const c of diatonicTriads(tonic, mode)) {
          distractors.push(chordSymbol(c))
        }

        questions.push(
          buildQuestion(
            'chords',
            `chord-deg:${asciiTonicId(tonic)}:${mode}:${degree}${seventh ? ':7' : ''}`,
            'Diatonic chord',
            `In ${name}, what is the ${roman} chord?`,
            correct,
            distractors
          )
        )
      }
    }
  }
  return questions
}

interface Progression {
  slug: string
  mode: Mode
  degrees: number[]
}

/** Curated Roman-numeral progressions. Minor uses only indices 0..6. */
const PROGRESSIONS: Progression[] = [
  // Major
  { slug: 'I-IV-V', mode: 'major', degrees: [0, 3, 4] },
  { slug: 'ii-V-I', mode: 'major', degrees: [1, 4, 0] },
  { slug: 'I-V-vi-IV', mode: 'major', degrees: [0, 4, 5, 3] },
  { slug: 'I-vi-IV-V', mode: 'major', degrees: [0, 5, 3, 4] },
  { slug: 'vi-IV-I-V', mode: 'major', degrees: [5, 3, 0, 4] },
  { slug: 'I-IV-vi-V', mode: 'major', degrees: [0, 3, 5, 4] },
  // Minor
  { slug: 'i-iv-V', mode: 'minor', degrees: [0, 3, 4] },
  { slug: 'iio-V-i', mode: 'minor', degrees: [1, 4, 0] },
  { slug: 'i-VI-iv-V', mode: 'minor', degrees: [0, 5, 3, 4] },
  { slug: 'VI-iv-i-V', mode: 'minor', degrees: [5, 3, 0, 4] },
  { slug: 'i-iv-V-i', mode: 'minor', degrees: [0, 3, 4, 0] },
]

/** Slugs that also get a seventh-chord form (idiomatic ii–V–I / ii°–V–i). */
const SEVENTH_PROGRESSION_SLUGS = new Set(['ii-V-I', 'iio-V-i'])

/** The Roman-numeral label of a progression, e.g. "ii7–V7–Imaj7". */
function progressionLabel(prog: Progression, seventh: boolean): string {
  return prog.degrees.map((d) => romanLabel(prog.mode, d, seventh)).join('–')
}

/** The concrete chord spelling of a progression, e.g. "Dm – G – C". */
function progressionSpelling(
  tonic: Note,
  prog: Progression,
  seventh: boolean
): string {
  return prog.degrees
    .map((d) => chordSymbol(romanToChord(tonic, prog.mode, d, seventh)))
    .join(' – ')
}

/**
 * 5. Roman-numeral progressions spelled out in concrete chords. Triad form for
 * every progression across every key of its mode; seventh form only for the
 * idiomatic ii–V–I / ii°–V–i. Distractors: the same progression in other keys
 * (strong) plus a one-chord variant within the same key.
 */
function progressionQuestions(): Question[] {
  const questions: Question[] = []
  for (const prog of PROGRESSIONS) {
    const sevenths = SEVENTH_PROGRESSION_SLUGS.has(prog.slug)
      ? [false, true]
      : [false]
    for (const seventh of sevenths) {
      const label = progressionLabel(prog, seventh)
      const modeKeys = KEYS.map((key) => keyForMode(key, prog.mode))
      for (const { tonic, name } of modeKeys) {
        const correct = progressionSpelling(tonic, prog, seventh)

        // Strong distractors: same progression in other keys of this mode.
        const distractors: string[] = []
        for (const other of modeKeys) {
          if (other.tonic === tonic) continue
          distractors.push(progressionSpelling(other.tonic, prog, seventh))
        }
        // One-chord-swapped variant within the same key: swap the first chord
        // for the next diatonic degree (deterministic, distinct from correct).
        const swapped: Progression = {
          ...prog,
          degrees: prog.degrees.map((d, i) =>
            i === 0 ? (d + 1) % 7 : d
          ),
        }
        distractors.push(progressionSpelling(tonic, swapped, seventh))

        questions.push(
          buildQuestion(
            'progressions',
            `prog:${asciiTonicId(tonic)}:${prog.mode}:${prog.slug}${seventh ? ':7' : ':3'}`,
            'Progression',
            `In ${name}, spell the progression ${label}.`,
            correct,
            distractors
          )
        )
      }
    }
  }
  return questions
}

/** All study questions, deterministic across runs. */
export function generateAllQuestions(): Question[] {
  return [
    ...relativeMinorQuestions(),
    ...scaleSpellingQuestions(),
    ...fingeringQuestions(),
    ...chordDegreeQuestions(),
    ...progressionQuestions(),
  ]
}
