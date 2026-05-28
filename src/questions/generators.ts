import type { Hand, Note, Question, ScaleType } from '../contracts'
import { KEYS, fingering, minorScale, noteToString } from '../theory'

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

/** All study questions, deterministic across runs. */
export function generateAllQuestions(): Question[] {
  return [
    ...relativeMinorQuestions(),
    ...scaleSpellingQuestions(),
    ...fingeringQuestions(),
  ]
}
