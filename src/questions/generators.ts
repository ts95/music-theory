import type { Hand, Note, Playable, Question, ScaleType } from '../contracts'
import {
  KEYS,
  alternateQuality,
  chordEvents,
  chordSymbol,
  dorianScale,
  fingering,
  majorScale,
  minorScale,
  noteToString,
  phrygianScale,
  progressionEvents,
  romanLabel,
  romanToChord,
  scaleEvents,
  voiceChordRootPosition,
  voiceScaleAscending,
} from '../theory'
import type { Chord, Mode } from '../theory'
import {
  chordExplanation,
  fingeringExplanation,
  intervalEarExplanation,
  progressionEarExplanation,
  progressionExplanation,
  relativeMinorExplanation,
  scaleExplanation,
} from './explanations'

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
  distractors: string[],
  audio?: Record<string, Playable>,
  explanation?: string
): Question {
  const picked: string[] = []
  for (const d of distractors) {
    if (d === correct || picked.includes(d)) continue
    picked.push(d)
    if (picked.length === 3) break
  }
  const choices = [correct, ...picked].sort((a, b) => a.localeCompare(b))
  const question: Question = {
    id,
    etudeId,
    category,
    prompt,
    choices,
    answerIndex: choices.indexOf(correct),
  }
  if (audio) {
    // Keep only the playback entries for the choices we actually rendered.
    const kept: Record<string, Playable> = {}
    for (const c of choices) {
      if (audio[c]) kept[c] = audio[c]
    }
    if (Object.keys(kept).length > 0) question.audio = kept
  }
  if (explanation) question.explanation = explanation
  return question
}

/** 1. Relative-minor recall: one per key. Each key name plays its tonic minor triad. */
function relativeMinorQuestions(): Question[] {
  // Every key name → its tonic minor triad (buildQuestion keeps the rendered ones).
  const audio: Record<string, Playable> = {}
  for (const k of KEYS) {
    audio[k.minorName] = { kind: 'chord', events: chordEvents(k.minorTonic, 'min') }
  }
  return KEYS.map((key) => {
    const distractors = KEYS.filter((k) => k !== key).map((k) => k.minorName)
    const q = buildQuestion(
      'keys',
      `rel-minor:${asciiTonicId(key.majorTonic)}`,
      'Relative minor',
      `What is the relative minor of ${key.majorName}?`,
      key.minorName,
      distractors,
      audio,
      relativeMinorExplanation(key.majorTonic, key.majorName, key.minorName)
    )
    // Reveal places the pair on the circle of fifths rather than on a staff.
    q.circle = { major: key.majorName }
    return q
  })
}

/**
 * 2. Scale spelling: one per (key, scale type). All four options start on the
 * SAME tonic so the first note never gives the answer away. Distractors are
 * other named scales on that tonic — the sibling minor forms plus the parallel
 * major, Dorian, and Phrygian — with the mix varied per question.
 */
function scaleSpellingQuestions(): Question[] {
  const questions: Question[] = []
  KEYS.forEach((key, keyIndex) => {
    SCALE_TYPES.forEach((type, typeIndex) => {
      const tonic = key.minorTonic
      const audio: Record<string, Playable> = {}
      // Render a scale to its string AND register its ascending playback.
      const reg = (notes: Note[]): string => {
        const s = renderScale(notes)
        audio[s] = { kind: 'scale', events: scaleEvents(notes) }
        return s
      }
      const correctNotes = minorScale(tonic, type)
      const correct = reg(correctNotes)

      // Same-tonic candidates: the two sibling minor forms, and three
      // distinct scale types (all start on `tonic`, all spelled differently).
      const siblings = SCALE_TYPES.filter((t) => t !== type).map((t) =>
        minorScale(tonic, t)
      )
      const others = [majorScale(tonic), dorianScale(tonic), phrygianScale(tonic)]

      // Vary the mix deterministically (no RNG, so ids/output stay stable):
      // alternate between "2 siblings + 1 other" and "1 sibling + 2 others",
      // rotating which sibling/others appear.
      const rot = keyIndex + typeIndex
      const pickOthers = (n: number) =>
        Array.from({ length: n }, (_, i) => others[(rot + i) % others.length])
      const distractorNotes =
        rot % 2 === 0
          ? [...siblings, pickOthers(1)[0]]
          : [siblings[rot % siblings.length], ...pickOthers(2)]

      const q = buildQuestion(
        'keys',
        `scale-notes:${asciiTonicId(tonic)}:${type}`,
        'Scale spelling',
        `What are the notes of the ${noteToString(tonic)} ${TYPE_WORD[type]} scale?`,
        correct,
        distractorNotes.map(reg),
        audio,
        scaleExplanation(tonic, type, key.majorName)
      )
      // Reveal shows the answer scale, one note per stave note.
      q.staff = { groups: voiceScaleAscending(correctNotes).map((v) => [v]) }
      questions.push(q)
    })
  })
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
      const q = buildQuestion(
        'keys',
        `fingering:${asciiTonicId(key.minorTonic)}:${hand}`,
        'Fingering',
        `What is the standard ${HAND_WORD[hand]} fingering for the ${noteToString(
          key.minorTonic
        )} minor scale (one octave, ascending)?`,
        correct,
        pool,
        undefined,
        fingeringExplanation(key.minorTonic, hand, f)
      )
      // Reveal shows the natural-minor scale across the octave (tonic..tonic),
      // with the finger numbers labelled under each note.
      const natural = minorScale(key.minorTonic, 'natural')
      const octaveScale = [...natural, natural[0]]
      q.staff = {
        groups: voiceScaleAscending(octaveScale).map((v) => [v]),
        labels: f.map(String),
      }
      questions.push(q)
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
        const audio: Record<string, Playable> = {}
        // Render a chord to its symbol AND register its block playback.
        const reg = (c: Chord): string => {
          const s = chordSymbol(c)
          audio[s] = { kind: 'chord', events: chordEvents(c.root, c.quality) }
          return s
        }
        const correctChord = romanToChord(tonic, mode, degree, seventh)
        const correct = reg(correctChord)

        const distractors: string[] = []
        // Same root, different quality (so the root alone never reveals it).
        distractors.push(
          reg({
            root: correctChord.root,
            quality: alternateQuality(correctChord.quality),
          })
        )
        // Same quality (same degree) in the other keys — varied roots, so the
        // quality alone never reveals it either.
        for (const other of KEYS) {
          if (other === key) continue
          const ot = keyForMode(other, mode).tonic
          distractors.push(reg(romanToChord(ot, mode, degree, seventh)))
        }

        const q = buildQuestion(
          'chords',
          `chord-deg:${asciiTonicId(tonic)}:${mode}:${degree}${seventh ? ':7' : ''}`,
          'Diatonic chord',
          `In ${name}, what is the ${roman} chord?`,
          correct,
          distractors,
          audio,
          chordExplanation(name, mode, degree, seventh, correctChord)
        )
        // Reveal shows the answer chord as one block (root-position) stave note.
        q.staff = { groups: [voiceChordRootPosition(correctChord)] }
        questions.push(q)
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

/**
 * Concrete chord spelling of a progression (e.g. "Dm – G – C"), registering its
 * block-chords-in-series playback into `audio` under that string.
 */
function spellAndRegister(
  tonic: Note,
  prog: Progression,
  seventh: boolean,
  audio: Record<string, Playable>
): string {
  const chords = prog.degrees.map((d) =>
    romanToChord(tonic, prog.mode, d, seventh)
  )
  const s = chords.map(chordSymbol).join(' – ')
  audio[s] = { kind: 'progression', events: progressionEvents(chords) }
  return s
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
      const lastIndex = prog.degrees.length - 1
      for (const { tonic, name } of modeKeys) {
        const audio: Record<string, Playable> = {}
        const correct = spellAndRegister(tonic, prog, seventh, audio)

        const distractors: string[] = []
        // Same-key variant that keeps the FIRST chord but alters the last, so
        // "starts on the tonic chord" is no longer a giveaway.
        const sameStart: Progression = {
          ...prog,
          degrees: prog.degrees.map((d, i) =>
            i === lastIndex ? (d + 2) % 7 : d
          ),
        }
        distractors.push(spellAndRegister(tonic, sameStart, seventh, audio))
        // Then the same progression transposed to other keys of this mode.
        for (const other of modeKeys) {
          if (other.tonic === tonic) continue
          distractors.push(spellAndRegister(other.tonic, prog, seventh, audio))
        }

        questions.push(
          buildQuestion(
            'progressions',
            `prog:${asciiTonicId(tonic)}:${prog.mode}:${prog.slug}${seventh ? ':7' : ':3'}`,
            'Progression',
            `In ${name}, spell the progression ${label}.`,
            correct,
            distractors,
            audio,
            progressionExplanation(
              name,
              label.split('–'),
              correct.split(' – '),
              prog.slug
            )
          )
        )
      }
    }
  }
  return questions
}

interface IntervalDef {
  name: string
  semitones: number
  letterSteps: number
}

/** The 12 intervals within an octave, ascending. */
const INTERVALS: IntervalDef[] = [
  { name: 'Minor 2nd', semitones: 1, letterSteps: 1 },
  { name: 'Major 2nd', semitones: 2, letterSteps: 1 },
  { name: 'Minor 3rd', semitones: 3, letterSteps: 2 },
  { name: 'Major 3rd', semitones: 4, letterSteps: 2 },
  { name: 'Perfect 4th', semitones: 5, letterSteps: 3 },
  { name: 'Tritone', semitones: 6, letterSteps: 3 },
  { name: 'Perfect 5th', semitones: 7, letterSteps: 4 },
  { name: 'Minor 6th', semitones: 8, letterSteps: 5 },
  { name: 'Major 6th', semitones: 9, letterSteps: 5 },
  { name: 'Minor 7th', semitones: 10, letterSteps: 6 },
  { name: 'Major 7th', semitones: 11, letterSteps: 6 },
  { name: 'Octave', semitones: 12, letterSteps: 7 },
]

/** 6. Interval ear-training: identify an ascending interval by sound. */
function intervalEarQuestions(): Question[] {
  return INTERVALS.map((iv) => {
    // Distractors: the nearest intervals by semitone (the easiest to confuse).
    const distractors = INTERVALS.filter((x) => x.name !== iv.name)
      .sort(
        (a, b) =>
          Math.abs(a.semitones - iv.semitones) -
          Math.abs(b.semitones - iv.semitones)
      )
      .map((x) => x.name)
    const q = buildQuestion(
      'intervals-ear',
      `interval-ear:${iv.semitones}`,
      'Interval',
      'Identify the interval you hear.',
      iv.name,
      distractors,
      undefined,
      intervalEarExplanation(iv.name, iv.semitones)
    )
    q.ear = { kind: 'interval', semitones: iv.semitones, letterSteps: iv.letterSteps }
    return q
  })
}

/** 7. Progression ear-training: identify a curated progression by sound. */
function progressionEarQuestions(): Question[] {
  const labelOf = (p: Progression) =>
    p.degrees.map((d) => romanLabel(p.mode, d, false)).join('–')
  return PROGRESSIONS.map((prog) => {
    const distractors = PROGRESSIONS.filter(
      (p) => p.mode === prog.mode && p.slug !== prog.slug
    ).map(labelOf)
    const q = buildQuestion(
      'progressions-ear',
      `prog-ear:${prog.mode}:${prog.slug}`,
      'Progression by ear',
      'Identify the progression you hear.',
      labelOf(prog),
      distractors,
      undefined,
      progressionEarExplanation(prog.slug, labelOf(prog))
    )
    q.ear = { kind: 'progression', mode: prog.mode, degrees: prog.degrees }
    return q
  })
}

/** All study questions, deterministic across runs. */
export function generateAllQuestions(): Question[] {
  return [
    ...relativeMinorQuestions(),
    ...scaleSpellingQuestions(),
    ...fingeringQuestions(),
    ...chordDegreeQuestions(),
    ...progressionQuestions(),
    ...intervalEarQuestions(),
    ...progressionEarQuestions(),
  ]
}
