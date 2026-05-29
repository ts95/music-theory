import type {
  Hand,
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
        'fingerings',
        `fingering:${asciiTonicId(key.minorTonic)}:${hand}`,
        'Fingering',
        `What is the standard ${HAND_WORD[hand]} fingering for the ${noteToString(
          key.minorTonic
        )} minor scale (two octaves, ascending)?`,
        correct,
        pool,
        undefined,
        fingeringExplanation(key.minorTonic, hand, f)
      )
      // Reveal lights up two octaves of the natural-minor scale (tonic..tonic..
      // tonic), each key labelled with its finger number.
      const natural = minorScale(key.minorTonic, 'natural')
      const twoOctaves = [...natural, ...natural, natural[0]]
      q.keyboard = {
        marks: voiceScaleAscending(twoOctaves).map((v, i) => ({
          midi: voicedMidi(v),
          label: String(f[i]),
        })),
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
// Curated 4-note diatonic motifs (0-based scale degrees, 0 = tonic … 7 = octave).
const MELODY_MOTIFS: number[][] = [
  [0, 2, 4, 0], // do mi sol do
  [0, 1, 2, 0], // do re mi do
  [4, 3, 2, 0], // sol fa mi do
  [0, 4, 2, 0], // do sol mi do
  [2, 1, 0, 4], // mi re do sol
  [0, 2, 1, 0], // do mi re do
  [4, 2, 0, 2], // sol mi do mi
  [0, 4, 7, 4], // do sol do' sol
  [0, 1, 0, 4], // do re do sol
  [7, 4, 2, 0], // do' sol mi do
  [0, 2, 4, 7], // do mi sol do'
  [4, 5, 4, 0], // sol la sol do
]

const clampDeg = (d: number): number => Math.max(0, Math.min(7, d))

const melodyAnswer = (mode: Mode, degrees: number[]): string =>
  degrees.map((d) => solfege(mode, d)).join('–')

/** 8. Melodic dictation: hear a 4-note motif from a random tonic; name it in solfège. */
function melodicDictationQuestions(): Question[] {
  const modes: Mode[] = ['major', 'minor']
  const questions: Question[] = []
  for (const mode of modes) {
    for (const degrees of MELODY_MOTIFS) {
      const correct = melodyAnswer(mode, degrees)
      // Distractors: nudge the inner notes by ±1 step, or swap them — confusable
      // but distinct solfège sequences. buildQuestion keeps the first 3 distinct.
      const variants: number[][] = [
        [degrees[0], clampDeg(degrees[1] + 1), degrees[2], degrees[3]],
        [degrees[0], degrees[1], clampDeg(degrees[2] - 1), degrees[3]],
        [degrees[0], degrees[2], degrees[1], degrees[3]],
        [degrees[0], clampDeg(degrees[1] - 1), clampDeg(degrees[2] + 1), degrees[3]],
        [degrees[0], degrees[1], clampDeg(degrees[2] + 1), degrees[3]],
      ]
      const q = buildQuestion(
        'melodic-dictation',
        `melody:${mode}:${degrees.join('')}`,
        'Melodic dictation',
        'Identify the melody you hear (in solfège).',
        correct,
        variants.map((v) => melodyAnswer(mode, v)),
        undefined,
        melodicDictationExplanation(mode, degrees, correct)
      )
      q.ear = { kind: 'melody', mode, degrees }
      questions.push(q)
    }
  }
  return questions
}

// ── Rhythm dictation ─────────────────────────────────────────────────────────
// Curated one-bar 4/4 patterns (each sums to 4 beats). Shorthands keep them legible.
const H: RhythmEvent = { dur: 'h' }
const Q: RhythmEvent = { dur: 'q' }
const E: RhythmEvent = { dur: '8' }
const S: RhythmEvent = { dur: '16' }
const QR: RhythmEvent = { dur: 'q', rest: true }
const ER: RhythmEvent = { dur: '8', rest: true }
const QD: RhythmEvent = { dur: 'q', dots: 1 }
const T: RhythmEvent = { dur: '8', triplet: true } // eighth-note triplet member

// One-bar pattern pools per metre (each pattern sums to the metre's beats:
// 4/4 = 4, 3/4 = 3, 6/8 = 6 eighths = 3). 6/8 patterns group into two beats of
// three eighths {EEE | QD | QE}.
const RHYTHM_POOLS: Record<TimeSig, RhythmEvent[][]> = {
  '4/4': [
    [Q, Q, Q, Q],
    [E, E, Q, Q, Q],
    [Q, E, E, Q, Q],
    [E, E, E, E, Q, Q],
    [H, Q, Q],
    [Q, Q, H],
    [QD, E, Q, Q],
    [Q, QD, E, Q],
    [S, S, S, S, Q, Q, Q],
    [E, E, S, S, S, S, Q, Q],
    [QR, Q, Q, Q],
    [Q, QR, Q, Q],
    [H, E, E, Q],
    [E, E, Q, E, E, Q],
    [QD, E, E, E, Q],
    [S, S, E, Q, Q, Q],
    [Q, E, E, H],
    [ER, E, Q, Q, Q],
    // Eighth-note triplets (each T,T,T run = one beat).
    [Q, Q, T, T, T, Q],
    [T, T, T, Q, Q, Q],
    [Q, T, T, T, H],
    [T, T, T, T, T, T, Q, Q],
  ],
  '3/4': [
    [Q, Q, Q],
    [H, Q],
    [Q, H],
    [Q, Q, E, E],
    [E, E, Q, Q],
    [Q, E, E, Q],
    [QD, E, Q],
    [E, E, E, E, Q],
    [S, S, S, S, Q, Q],
    [Q, T, T, T, Q],
    [H, E, E],
  ],
  '6/8': [
    [QD, QD],
    [E, E, E, E, E, E],
    [QD, E, E, E],
    [E, E, E, QD],
    [Q, E, QD],
    [QD, Q, E],
    [Q, E, Q, E],
    [E, E, E, Q, E],
    [Q, E, E, E, E],
  ],
}

/** Stable serialization of a rhythm pattern, e.g. "q. 8 q q" / "t8 t8 t8 q" — the choice id. */
const rhythmKey = (p: RhythmEvent[]): string =>
  p
    .map(
      (e) =>
        `${e.rest ? 'r' : ''}${e.triplet ? 't' : ''}${e.dur}${'.'.repeat(e.dots ?? 0)}`
    )
    .join(' ')

const onsetCount = (p: RhythmEvent[]): number => p.filter((e) => !e.rest).length

/** 9. Rhythm dictation: hear a one-bar rhythm in 4/4, 3/4, or 6/8; pick the notation. */
function rhythmDictationQuestions(): Question[] {
  const questions: Question[] = []
  for (const meter of Object.keys(RHYTHM_POOLS) as TimeSig[]) {
    const pool = RHYTHM_POOLS[meter]
    const byKey: Record<string, RhythmEvent[]> = {}
    for (const p of pool) byKey[rhythmKey(p)] = p
    for (const pattern of pool) {
      const correct = rhythmKey(pattern)
      // Distractors: other patterns in the SAME metre, closest onset count first.
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
        `rhythm:${meter.replace('/', '-')}:${correct.replace(/[\s.]/g, '_')}`,
        'Rhythm dictation',
        `Identify the rhythm you hear (${meter}).`,
        correct,
        distractors,
        undefined,
        rhythmDictationExplanation(pattern, meter)
      )
      q.ear = { kind: 'rhythm', meter, pattern }
      // Align a pattern to each final (sorted) choice so they render as notation.
      q.rhythmChoices = q.choices.map((k) => byKey[k])
      questions.push(q)
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
    ...chordRecognitionQuestions(),
    ...progressionQuestions(),
    ...intervalEarQuestions(),
    ...progressionEarQuestions(),
    ...melodicDictationQuestions(),
    ...rhythmDictationQuestions(),
  ]
}
