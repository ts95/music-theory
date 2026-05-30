import type {
  Note,
  Playable,
  Question,
  RhythmEvent,
  ScaleType,
  TimeSig,
} from '../contracts'
import {
  KEYS,
  alternateQuality,
  chordEvents,
  chordFingering,
  chordSymbol,
  dorianScale,
  fingering,
  isCleanNinth,
  keySignatureSpec,
  majorScale,
  minorScale,
  noteToString,
  phrygianScale,
  pitchClass,
  progressionEvents,
  qualityFromIntervals,
  recChordSymbol,
  recChordTones,
  romanLabel,
  romanToChord,
  scaleEvents,
  solfege,
  voiceChordRootPosition,
  voiceInversion,
  voiceScaleAscending,
  voicedMidi,
  withInversion,
} from '../theory'
import type { Chord, ChordSize, Mode, Voiced } from '../theory'
import {
  chordExplanation,
  chordRecognitionExplanation,
  fingeringExplanation,
  intervalEarExplanation,
  melodicDictationExplanation,
  progressionEarExplanation,
  progressionExplanation,
  relativeMinorExplanation,
  rhythmDictationExplanation,
  scaleExplanation,
} from './explanations'

const SCALE_TYPES: ScaleType[] = ['natural', 'harmonic', 'melodic']

const TYPE_WORD: Record<ScaleType, string> = {
  natural: 'natural minor',
  harmonic: 'harmonic minor',
  melodic: 'melodic minor',
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
 * from `correct` and each other, then the first `maxDistractors` (default 3,
 * i.e. four choices) are used.
 */
function buildQuestion(
  etudeId: string,
  id: string,
  category: string,
  prompt: string,
  correct: string,
  distractors: string[],
  audio?: Record<string, Playable>,
  explanation?: string,
  maxDistractors = 3
): Question {
  const picked: string[] = []
  for (const d of distractors) {
    if (d === correct || picked.includes(d)) continue
    picked.push(d)
    if (picked.length === maxDistractors) break
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
      'relative-minors',
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
        'scales',
        `scale-notes:${asciiTonicId(tonic)}:${type}`,
        'Scale spelling',
        `What are the notes of the ${noteToString(tonic)} ${TYPE_WORD[type]} scale?`,
        correct,
        distractorNotes.map(reg),
        audio,
        scaleExplanation(tonic, type, key.majorName)
      )
      // Reveal lights up the answer scale on the keyboard, each key labelled
      // with both fingerings (RH over LH). Fingering is shared across the three
      // minor forms, so the same finger sequence applies to every scale type.
      const rh = fingering(tonic, 'natural', 'RH')
      const lh = fingering(tonic, 'natural', 'LH')
      q.keyboard = {
        marks: voiceScaleAscending(correctNotes).map((v, i) => ({
          midi: voicedMidi(v),
          ...(rh && lh ? { label: String(rh[i]), sublabel: String(lh[i]) } : {}),
        })),
      }
      questions.push(q)
    })
  })
  return questions
}

/**
 * Join finger numbers with a wide gap (a "tab") at each position shift — where
 * the finger jumps by more than a step, i.e. an RH thumb-tuck or an LH cross-
 * over. The gaps make the hand-position groups legible.
 */
function groupFingers(f: number[]): string {
  return f
    .map((n, i) =>
      i === 0 ? `${n}` : Math.abs(n - f[i - 1]) !== 1 ? `    ${n}` : ` ${n}`
    )
    .join('')
}

/** Both hands as a two-line label (RH over LH), with thumb-tuck gaps. */
function bothHandsLabel(rh: number[], lh: number[]): string {
  return `RH  ${groupFingers(rh)}\nLH  ${groupFingers(lh)}`
}

// Three cumulative difficulty levels by ABRSM grade (the étude covers the minor
// keys, so these are the minor scales required at each grade): Easy = Grade 1
// (A, D), Medium adds Grade 2 (E, G), Hard = all twelve keys.
const FINGERING_LEVELS: string[][] = [
  ['A minor', 'D minor'],
  ['A minor', 'D minor', 'E minor', 'G minor'],
  KEYS.map((k) => k.minorName),
]

/** 3. Piano fingerings: one per key (both hands at once), three ABRSM levels. */
function fingeringQuestions(): Question[] {
  // Distractor pool: every key's both-hands label (deduped downstream).
  const pool: string[] = []
  for (const key of KEYS) {
    const rh = fingering(key.minorTonic, 'natural', 'RH')
    const lh = fingering(key.minorTonic, 'natural', 'LH')
    if (rh && lh) pool.push(bothHandsLabel(rh, lh))
  }

  const questions: Question[] = []
  FINGERING_LEVELS.forEach((names, levelIndex) => {
    const level = levelIndex + 1
    for (const key of KEYS) {
      if (!names.includes(key.minorName)) continue
      const rh = fingering(key.minorTonic, 'natural', 'RH')
      const lh = fingering(key.minorTonic, 'natural', 'LH')
      if (!rh || !lh) continue
      const q = buildQuestion(
        'fingerings',
        `fingering:L${level}:${asciiTonicId(key.minorTonic)}`,
        'Fingering',
        `What is the standard fingering — both hands — for the ${noteToString(
          key.minorTonic
        )} minor scale (two octaves, ascending)?`,
        bothHandsLabel(rh, lh),
        pool,
        undefined,
        fingeringExplanation(key.minorTonic, rh, lh)
      )
      // Reveal lights up two octaves of the natural-minor scale, each key
      // labelled with both fingers (RH over LH).
      const natural = minorScale(key.minorTonic, 'natural')
      const twoOctaves = [...natural, ...natural, natural[0]]
      q.keyboard = {
        marks: voiceScaleAscending(twoOctaves).map((v, i) => ({
          midi: voicedMidi(v),
          label: String(rh[i]),
          sublabel: String(lh[i]),
        })),
      }
      q.level = level
      questions.push(q)
    }
  })
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
        // Reveal lights up the answer chord (root position) on the keyboard,
        // each key labelled with both fingerings (RH over LH).
        const voiced = voiceChordRootPosition(correctChord)
        const rhFng = chordFingering(voiced.length, 'RH')
        const lhFng = chordFingering(voiced.length, 'LH')
        q.keyboard = {
          marks: voiced.map((v, i) => ({
            midi: voicedMidi(v),
            label: String(rhFng[i]),
            sublabel: String(lhFng[i]),
          })),
        }
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

// Three cumulative difficulty levels by semitone span. Each level keeps the
// easier intervals and adds more (so harder levels offer a wider array of
// options), and shows more choices: Easy 4, Medium 5, Hard 6.
const INTERVAL_LEVELS: { semitones: number[]; maxDistractors: number }[] = [
  { semitones: [1, 6, 7, 12], maxDistractors: 3 }, // m2, TT, P5, 8ve
  { semitones: [1, 2, 3, 4, 5, 6, 7, 12], maxDistractors: 4 }, // + M2 m3 M3 P4
  { semitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], maxDistractors: 5 }, // all
]

/** 6. Interval ear-training: identify an ascending interval by sound (3 levels). */
function intervalEarQuestions(): Question[] {
  const out: Question[] = []
  INTERVAL_LEVELS.forEach((def, levelIndex) => {
    const level = levelIndex + 1
    const pool = INTERVALS.filter((iv) => def.semitones.includes(iv.semitones))
    for (const iv of pool) {
      // Distractors: the nearest intervals by semitone within this level's pool.
      const distractors = pool
        .filter((x) => x.name !== iv.name)
        .sort(
          (a, b) =>
            Math.abs(a.semitones - iv.semitones) -
            Math.abs(b.semitones - iv.semitones)
        )
        .map((x) => x.name)
      const q = buildQuestion(
        'intervals-ear',
        `interval-ear:L${level}:${iv.semitones}`,
        'Interval',
        'Identify the interval you hear.',
        iv.name,
        distractors,
        undefined,
        intervalEarExplanation(iv.name, iv.semitones),
        def.maxDistractors
      )
      q.ear = { kind: 'interval', semitones: iv.semitones, letterSteps: iv.letterSteps }
      q.level = level
      out.push(q)
    }
  })
  return out
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

// Only root, first, and second inversion (bass = root / 3rd / 5th) — never the
// 7th or 9th in the bass. Every chord size has these three, so the cap is fixed.
const INVERSIONS = 3
const INVERSION_NAMES = ['root position', 'first inversion', 'second inversion']

/** The three Chord-Recognition difficulty levels (chord complexity + key range). */
interface RecLevel {
  n: number
  sizes: ChordSize[]
  invert: boolean
  /** Include keys whose signature has at most this many accidentals. */
  maxAccidentals: number
}
const REC_LEVELS: RecLevel[] = [
  { n: 1, sizes: ['triad'], invert: false, maxAccidentals: 1 }, // Easy
  { n: 2, sizes: ['triad', 'seventh'], invert: true, maxAccidentals: 3 }, // Medium
  { n: 3, sizes: ['triad', 'seventh', 'ninth'], invert: true, maxAccidentals: 12 }, // Hard
]

/** Semitones (0–11) from `root` up to `tone`. */
const semis = (root: Note, tone: Note): number =>
  (((pitchClass(tone) - pitchClass(root)) % 12) + 12) % 12

/** Accidentals in a major key's signature (its relative minor shares it). */
const accidentalCount = (majorTonic: Note): number => {
  const fifths = (7 * pitchClass(majorTonic)) % 12
  return fifths <= 6 ? fifths : 12 - fifths
}

/**
 * 6. Chord recognition: read a diatonic chord rendered on a staff (under its key
 * signature) and name it — chord symbol, with slash notation for inversions.
 * Three difficulty levels (see REC_LEVELS) scale chord complexity and key range,
 * each its own SRS set via level-prefixed ids. Size, inversion, and clef are
 * chosen deterministically from a running index so the bank is stable and
 * well-mixed. Minor uses harmonic forms at III/V/vii° (so the augmented III+,
 * dominant V, and diminished vii° all appear).
 */
function chordRecognitionQuestions(): Question[] {
  const modes: Mode[] = ['major', 'minor']
  const questions: Question[] = []
  for (const level of REC_LEVELS) {
    let idx = 0
    KEYS.forEach((key, keyIndex) => {
      if (accidentalCount(key.majorTonic) > level.maxAccidentals) return
      for (const mode of modes) {
        const { tonic, name } = keyForMode(key, mode)
        const keySignature = keySignatureSpec(tonic, mode)
        for (let degree = 0; degree < 7; degree++) {
          // Deterministic size; demote an exotic ninth to its seventh.
          let size = level.sizes[idx % level.sizes.length]
          let tones = recChordTones(tonic, mode, degree, size)
          if (size === 'ninth' && !isCleanNinth(tones)) {
            size = 'seventh'
            tones = recChordTones(tonic, mode, degree, size)
          }
          const inversion = level.invert
            ? Math.floor(idx / level.sizes.length) % INVERSIONS
            : 0
          const clef: 'treble' | 'bass' = idx % 2 === 0 ? 'treble' : 'bass'
          // Octave that centres a stacked chord on each clef's staff.
          const octave = clef === 'treble' ? 4 : 2
          idx++

          const baseSymbol = recChordSymbol(tones)
          const correct = withInversion(baseSymbol, tones, inversion)

          // Hover-to-play: each choice sounds its own chord, as a block, voiced
          // in a comfortable register (octave 4) regardless of the staff clef.
          const audio: Record<string, Playable> = {}
          const offer = (sym: string, voiced: Voiced[]) => {
            audio[sym] = { kind: 'chord', events: [voiced.map(voicedMidi)] }
          }
          offer(correct, voiceInversion(tones, inversion, 4))

          // Different-root distractors: the same degree/size in neighbour keys.
          const neighbours: string[] = []
          for (const step of [1, 5, 7, 2, 3, 8, 4]) {
            const other = keyForMode(KEYS[(keyIndex + step) % KEYS.length], mode).tonic
            const otherTones = recChordTones(other, mode, degree, size)
            if (size === 'ninth' && !isCleanNinth(otherTones)) continue
            const inv = level.invert ? inversion : 0
            const sym = withInversion(recChordSymbol(otherTones), otherTones, inv)
            neighbours.push(sym)
            offer(sym, voiceInversion(otherTones, inv, 4))
          }
          const triadQuality = qualityFromIntervals(
            tones.slice(1, 3).map((t) => semis(tones[0], t))
          )
          const altQ = alternateQuality(triadQuality)
          const altQuality = chordSymbol({ root: tones[0], quality: altQ })
          audio[altQuality] = { kind: 'chord', events: chordEvents(tones[0], altQ, 4) }

          const invSym1 = withInversion(baseSymbol, tones, (inversion + 1) % INVERSIONS)
          const invSym2 = withInversion(baseSymbol, tones, (inversion + 2) % INVERSIONS)
          if (level.invert) {
            offer(invSym1, voiceInversion(tones, (inversion + 1) % INVERSIONS, 4))
            offer(invSym2, voiceInversion(tones, (inversion + 2) % INVERSIONS, 4))
          }

          // Prioritized so the first three vary inversion / root / quality.
          // Easy has no inversions, so its options stay root-position symbols.
          const distractors = (
            level.invert
              ? [invSym1, neighbours[0], altQuality, invSym2, ...neighbours.slice(1)]
              : [neighbours[0], altQuality, ...neighbours.slice(1)]
          ).filter((s): s is string => Boolean(s))

          const seventh = size !== 'triad'
          const q = buildQuestion(
            'chord-recognition',
            `chord-rec:L${level.n}:${asciiTonicId(tonic)}${mode === 'minor' ? 'm' : 'M'}:${degree}:${size}:${inversion}`,
            'Chord recognition',
            `In ${name}, name the chord shown.`,
            correct,
            distractors,
            audio,
            chordRecognitionExplanation(
              correct,
              name,
              romanLabel(mode, degree, seventh),
              INVERSION_NAMES[inversion],
              tones
            )
          )
          q.level = level.n
          q.notation = {
            groups: [voiceInversion(tones, inversion, octave)],
            clef,
            keySignature,
          }
          questions.push(q)
        }
      }
    })
  }
  return questions
}

// ── Melodic dictation ───────────────────────────────────────────────────────
// Diatonic motifs as 0-based scale degrees (0 = tonic … 7 = octave), per level.
const MELODY_LEVELS: number[][][] = [
  // L1 Easy: 3-note motifs (stepwise / triadic).
  [
    [0, 1, 2],
    [0, 2, 4],
    [2, 1, 0],
    [4, 2, 0],
    [0, 2, 1],
    [2, 4, 2],
    [0, 1, 0],
    [4, 3, 2],
    [0, 4, 2],
    [2, 0, 2],
  ],
  // L2 Medium: 4–5-note motifs with leaps.
  [
    [0, 2, 4, 0],
    [0, 1, 2, 0],
    [4, 3, 2, 0],
    [0, 4, 2, 0],
    [2, 1, 0, 4],
    [0, 2, 1, 0],
    [4, 2, 0, 2],
    [0, 4, 7, 4],
    [0, 1, 0, 4],
    [7, 4, 2, 0],
    [0, 2, 4, 7],
    [4, 5, 4, 0],
  ],
  // L3 Hard: 5–8-note lines, including the complete ascending/descending scale.
  [
    [0, 1, 2, 3, 4, 5, 6, 7],
    [7, 6, 5, 4, 3, 2, 1, 0],
    [0, 2, 4, 5, 7],
    [0, 1, 2, 3, 4],
    [0, 2, 4, 7, 4, 2, 0],
    [7, 5, 4, 2, 0],
    [4, 5, 6, 7, 6, 5, 4],
    [0, 1, 2, 4, 2, 1, 0],
    [0, 2, 4, 5, 7, 5, 4, 2],
    [0, 4, 2, 5, 4, 7],
  ],
]

const clampDeg = (d: number): number => Math.max(0, Math.min(7, d))

const melodyAnswer = (mode: Mode, degrees: number[]): string =>
  degrees.map((d) => solfege(mode, d)).join('–')

/** Confusable distractor degree-sequences: nudge a note by a step, or swap two. */
function melodyVariants(degrees: number[]): number[][] {
  const n = degrees.length
  const set = (i: number, delta: number) =>
    degrees.map((d, j) => (j === i ? clampDeg(d + delta) : d))
  const swap = (i: number, k: number) =>
    degrees.map((d, j) => (j === i ? degrees[k] : j === k ? degrees[i] : d))
  const cands: number[][] = [
    set(1, +1),
    set(n - 2, -1),
    set(n - 1, -1),
    set(0, +1),
    swap(n - 2, n - 1),
  ]
  if (n >= 4) cands.push(swap(1, 2))
  return cands
}

/** 9. Melodic dictation: hear a motif from a random tonic; name it in solfège. */
function melodicDictationQuestions(): Question[] {
  const modes: Mode[] = ['major', 'minor']
  const questions: Question[] = []
  MELODY_LEVELS.forEach((pool, levelIndex) => {
    const level = levelIndex + 1
    for (const mode of modes) {
      for (const degrees of pool) {
        const correct = melodyAnswer(mode, degrees)
        const q = buildQuestion(
          'melodic-dictation',
          `melody:L${level}:${mode}:${degrees.join('')}`,
          'Melodic dictation',
          'Identify the melody you hear (in solfège).',
          correct,
          melodyVariants(degrees).map((v) => melodyAnswer(mode, v)),
          undefined,
          melodicDictationExplanation(mode, degrees, correct)
        )
        q.ear = { kind: 'melody', mode, degrees }
        q.level = level
        questions.push(q)
      }
    }
  })
  return questions
}

// ── Rhythm dictation ─────────────────────────────────────────────────────────
// Shorthands for one-bar patterns. Each pattern sums to its metre's beats
// (4/4 = 4, 3/4 = 3, 6/8 = 3 quarter-beats); ties don't change the total.
const W: RhythmEvent = { dur: 'w' }
const H: RhythmEvent = { dur: 'h' }
const Q: RhythmEvent = { dur: 'q' }
const QD: RhythmEvent = { dur: 'q', dots: 1 }
const E: RhythmEvent = { dur: '8' }
const S: RhythmEvent = { dur: '16' }
const X: RhythmEvent = { dur: '32' }
const T: RhythmEvent = { dur: '8', triplet: true } // eighth-note triplet member
const QR: RhythmEvent = { dur: 'q', rest: true }
const SR: RhythmEvent = { dur: '16', rest: true }
const XR: RhythmEvent = { dur: '32', rest: true }
/** Tie this event to the next (same pitch, held together). */
const tie = (e: RhythmEvent): RhythmEvent => ({ ...e, tie: true })

interface RhythmLevelDef {
  tempo: number
  pools: Partial<Record<TimeSig, RhythmEvent[][]>>
}

// Three difficulty levels: vocabulary, syncopation, and tempo grow per level.
const RHYTHM_LEVELS: RhythmLevelDef[] = [
  // L1 Easy — whole/half/quarter/eighth + simple rests; little syncopation.
  {
    tempo: 76,
    pools: {
      '4/4': [
        [W],
        [H, H],
        [H, Q, Q],
        [Q, Q, Q, Q],
        [Q, Q, H],
        [E, E, Q, Q, Q],
        [H, E, E, Q],
        [QR, Q, Q, Q],
        [Q, QR, H],
      ],
      '3/4': [
        [Q, Q, Q],
        [H, Q],
        [Q, H],
        [E, E, Q, Q],
        [Q, QR, Q],
        [H, E, E],
        [Q, E, E, Q],
      ],
    },
  },
  // L2 Medium — sixteenths, dotted figures, triplets, 16th rests, a few ties.
  {
    tempo: 100,
    pools: {
      '4/4': [
        [QD, E, Q, Q],
        [E, E, S, S, S, S, Q, Q],
        [S, S, S, S, Q, Q, Q],
        [Q, Q, T, T, T, Q],
        [T, T, T, Q, Q, Q],
        [QD, E, QD, E],
        [Q, tie(Q), Q, Q],
        [S, SR, S, S, Q, Q, Q],
      ],
      '3/4': [
        [QD, E, Q],
        [S, S, S, S, Q, Q],
        [Q, T, T, T, Q],
        [Q, tie(Q), Q],
        [E, E, Q, E, E],
        [QD, E, E, E],
      ],
      '6/8': [
        [QD, QD],
        [E, E, E, E, E, E],
        [QD, E, E, E],
        [E, E, E, QD],
        [Q, E, QD],
        [QD, Q, E],
        [Q, E, Q, E],
      ],
    },
  },
  // L3 Hard — 32nds, 32nd rests, dense ties and off-beat syncopation.
  {
    tempo: 138,
    pools: {
      '4/4': [
        [X, X, X, X, E, Q, Q, Q],
        [E, tie(Q), E, E, tie(Q), E],
        [S, S, E, S, S, E, Q, Q],
        [E, X, XR, X, X, Q, Q, Q],
        [tie(Q), E, E, Q, Q],
        [X, X, X, X, X, X, X, X, Q, Q, Q],
      ],
      '3/4': [
        [E, tie(Q), E, Q],
        [X, X, X, X, E, Q, Q],
        [S, S, S, S, E, E, Q],
        [tie(Q), tie(Q), Q],
      ],
      '6/8': [
        [S, S, E, E, QD],
        [E, E, E, S, S, S, S, E],
        [QD, E, E, E],
        [Q, E, Q, E],
        [E, E, E, QD],
      ],
    },
  },
]

/** Stable serialization, e.g. "q. 8 q q" / "t8 t8 t8 q" / "q~ q" — the choice id. */
const rhythmKey = (p: RhythmEvent[]): string =>
  p
    .map(
      (e) =>
        `${e.rest ? 'r' : ''}${e.triplet ? 't' : ''}${e.dur}${'.'.repeat(e.dots ?? 0)}${e.tie ? '~' : ''}`
    )
    .join(' ')

const onsetCount = (p: RhythmEvent[]): number => p.filter((e) => !e.rest).length

/** 10. Rhythm dictation: hear a one-bar rhythm; pick its notation. Three levels. */
function rhythmDictationQuestions(): Question[] {
  const questions: Question[] = []
  RHYTHM_LEVELS.forEach((def, levelIndex) => {
    const level = levelIndex + 1
    for (const meter of Object.keys(def.pools) as TimeSig[]) {
      const pool = def.pools[meter]!
      const byKey: Record<string, RhythmEvent[]> = {}
      for (const p of pool) byKey[rhythmKey(p)] = p
      for (const pattern of pool) {
        const correct = rhythmKey(pattern)
        // Distractors: other patterns in the SAME level + metre, closest onset count.
        const distractors = pool
          .filter((p) => rhythmKey(p) !== correct)
          .sort(
            (a, b) =>
              Math.abs(onsetCount(a) - onsetCount(pattern)) -
              Math.abs(onsetCount(b) - onsetCount(pattern))
          )
          .map(rhythmKey)
        const q = buildQuestion(
          'rhythm-dictation',
          `rhythm:L${level}:${meter.replace('/', '-')}:${correct.replace(/[\s.~]/g, '_')}`,
          'Rhythm dictation',
          `Identify the rhythm you hear (${meter}).`,
          correct,
          distractors,
          undefined,
          rhythmDictationExplanation(pattern, meter)
        )
        q.ear = { kind: 'rhythm', meter, tempo: def.tempo, pattern }
        q.level = level
        // Align a pattern to each final (sorted) choice so they render as notation.
        q.rhythmChoices = q.choices.map((k) => byKey[k])
        questions.push(q)
      }
    }
  })
  return questions
}

/** All study questions, deterministic across runs. */
export function generateAllQuestions(): Question[] {
  return [
    ...relativeMinorQuestions(),
    ...scaleSpellingQuestions(),
    ...fingeringQuestions(),
    ...chordDegreeQuestions(),
    ...chordRecognitionQuestions(),
    ...progressionQuestions(),
    ...intervalEarQuestions(),
    ...progressionEarQuestions(),
    ...melodicDictationQuestions(),
    ...rhythmDictationQuestions(),
  ]
}
