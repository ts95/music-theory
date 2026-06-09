import type {
  Note,
  Playable,
  Question,
  RhythmEvent,
  ScaleKind,
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
  majorFingering,
  isCleanNinth,
  keySignatureSpec,
  locrianScale,
  lydianScale,
  majorScale,
  minorScale,
  mixolydianScale,
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
  spellChord,
  voiceChordRootPosition,
  voiceInversion,
  voiceScaleAscending,
  voicedMidi,
  withInversion,
} from '../theory'
import type { Chord, ChordSize, Mode, Quality, Voiced } from '../theory'
import {
  chordExplanation,
  keySignatureExplanation,
  chordRecognitionExplanation,
  chordSpellingExplanation,
  intervalEarExplanation,
  melodicDictationExplanation,
  progressionEarExplanation,
  progressionExplanation,
  relativeMinorExplanation,
  rhythmDictationExplanation,
  scaleExplanation,
} from './explanations'
import { audibleSignature } from '../rhythm'

const SCALE_TYPES: ScaleType[] = ['natural', 'harmonic', 'melodic']

const SCALE_WORD: Record<ScaleKind, string> = {
  major: 'major',
  natural: 'natural minor',
  harmonic: 'harmonic minor',
  melodic: 'melodic minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
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

/** The notes of any asked-about scale flavour, on a given tonic. */
function scaleKindNotes(kind: ScaleKind, tonic: Note): Note[] {
  switch (kind) {
    case 'major':
      return majorScale(tonic)
    case 'natural':
    case 'harmonic':
    case 'melodic':
      return minorScale(tonic, kind)
    case 'dorian':
      return dorianScale(tonic)
    case 'phrygian':
      return phrygianScale(tonic)
    case 'lydian':
      return lydianScale(tonic)
    case 'mixolydian':
      return mixolydianScale(tonic)
    case 'locrian':
      return locrianScale(tonic)
  }
}

/** True if any note needs a double sharp/flat — too ugly to ask as a mode. */
const hasDoubleAccidental = (notes: Note[]): boolean =>
  notes.some((n) => Math.abs(n.accidental) >= 2)

interface ScaleKindDef {
  kind: ScaleKind
  /** Which of the key's tonics the scale is built on. */
  on: 'major' | 'minor'
  /** A Greek mode — only generated at Expert. */
  mode: boolean
}

// Each level's content: major + the 3 minor forms at every level; the modes are
// added only at Expert. Major/Lydian/Mixolydian sit on the major tonic; the
// minor forms on the relative minor; the (minor-family) modes on the major tonic
// so all 12 pitch classes are covered with clean spellings.
const SCALE_KINDS: ScaleKindDef[] = [
  { kind: 'major', on: 'major', mode: false },
  { kind: 'natural', on: 'minor', mode: false },
  { kind: 'harmonic', on: 'minor', mode: false },
  { kind: 'melodic', on: 'minor', mode: false },
  { kind: 'dorian', on: 'major', mode: true },
  { kind: 'phrygian', on: 'major', mode: true },
  { kind: 'lydian', on: 'major', mode: true },
  { kind: 'mixolydian', on: 'major', mode: true },
  { kind: 'locrian', on: 'major', mode: true },
]

// Four cumulative ABRSM-graded levels by key range (key-signature accidentals):
// Easy ≤2, Medium ≤4, Hard / Expert all twelve (≤6). Easy ≈ grades 1–2, Medium ≈
// grades 3–4, Hard/Expert ≈ grade 5+. Expert additionally adds the Greek modes.
const SCALE_LEVEL_ACCIDENTALS = [2, 4, 6, 6]

/**
 * 2. Scale spelling: one per (level, key, scale flavour). All four options start
 * on the SAME tonic so the first note never gives the answer away; distractors
 * are other named scales on that tonic, the mix varied deterministically. Each
 * level is its own SRS set (level-prefixed ids), cumulative by key range. Major +
 * the 3 minor forms at every level; the modes are added at Expert.
 */
function scaleSpellingQuestions(): Question[] {
  const questions: Question[] = []
  SCALE_LEVEL_ACCIDENTALS.forEach((maxAccidentals, levelIndex) => {
    const level = levelIndex + 1
    const expert = level === SCALE_LEVEL_ACCIDENTALS.length
    KEYS.forEach((key, keyIndex) => {
      if (accidentalCount(key.majorTonic) > maxAccidentals) return
      SCALE_KINDS.forEach((def, kindIndex) => {
        if (def.mode && !expert) return
        const tonic = def.on === 'major' ? key.majorTonic : key.minorTonic
        const correctNotes = scaleKindNotes(def.kind, tonic)
        // Skip modes whose spelling would need a double accidental (e.g. Locrian
        // on D♭). The major/minor scales keep all 12 keys, as they always have.
        if (def.mode && hasDoubleAccidental(correctNotes)) return

        const audio: Record<string, Playable> = {}
        // Render a scale to its string AND register its ascending playback.
        const reg = (notes: Note[]): string => {
          const s = renderScale(notes)
          audio[s] = { kind: 'scale', events: scaleEvents(notes) }
          return s
        }
        const correct = reg(correctNotes)

        // Distractors: every other flavour on the SAME tonic (so the first note
        // never reveals the answer), rotated per question so the mix varies.
        // buildQuestion keeps the first 3 distinct from this over-supply.
        const rot = keyIndex + kindIndex + level
        const others = SCALE_KINDS.filter((d) => d.kind !== def.kind)
        const distractorNotes = others.map((_, i) =>
          scaleKindNotes(others[(i + rot) % others.length].kind, tonic)
        )

        const q = buildQuestion(
          'scales',
          `scale-notes:L${level}:${asciiTonicId(tonic)}:${def.kind}`,
          'Scale spelling',
          `What are the notes of the ${noteToString(tonic)} ${SCALE_WORD[def.kind]} scale?`,
          correct,
          distractorNotes.map(reg),
          audio,
          scaleExplanation(tonic, def.kind, correctNotes, key.majorName)
        )
        q.level = level
        // Reveal lights up the answer scale on the keyboard, each key labelled
        // with RH/LH fingerings where we have them (major + the minor forms,
        // which share a fingering); modes light the keys without finger numbers.
        const rh =
          def.kind === 'major'
            ? majorFingering(tonic, 'RH')
            : def.mode
              ? null
              : fingering(tonic, 'natural', 'RH')
        const lh =
          def.kind === 'major'
            ? majorFingering(tonic, 'LH')
            : def.mode
              ? null
              : fingering(tonic, 'natural', 'LH')
        q.keyboard = {
          marks: voiceScaleAscending(correctNotes).map((v, i) => ({
            midi: voicedMidi(v),
            ...(rh && lh ? { label: String(rh[i]), sublabel: String(lh[i]) } : {}),
          })),
        }
        questions.push(q)
      })
    })
  })
  return questions
}

// ── Key Signatures ───────────────────────────────────────────────────────────
// "Which notes are sharp/flat in this key?" across the full circle of fifths.

/** The 15 major tonics, 7♯ (C♯) → 7♭ (C♭), incl. the enharmonic pairs. */
const SIG_MAJOR_TONICS: Note[] = [
  { letter: 'C', accidental: 0 },
  { letter: 'G', accidental: 0 },
  { letter: 'D', accidental: 0 },
  { letter: 'A', accidental: 0 },
  { letter: 'E', accidental: 0 },
  { letter: 'B', accidental: 0 },
  { letter: 'F', accidental: 1 }, // F♯ (6♯)
  { letter: 'C', accidental: 1 }, // C♯ (7♯)
  { letter: 'F', accidental: 0 },
  { letter: 'B', accidental: -1 }, // B♭
  { letter: 'E', accidental: -1 }, // E♭
  { letter: 'A', accidental: -1 }, // A♭
  { letter: 'D', accidental: -1 }, // D♭
  { letter: 'G', accidental: -1 }, // G♭ (6♭)
  { letter: 'C', accidental: -1 }, // C♭ (7♭)
]

/** The seven sharps / flats in the order they're added to a key signature. */
const SHARP_ORDER: Note[] = (['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const).map(
  (letter) => ({ letter, accidental: 1 })
)
const FLAT_ORDER: Note[] = (['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const).map(
  (letter) => ({ letter, accidental: -1 })
)

/** Render an accidental set as a choice string ("F♯, C♯, G♯", or "None"). */
const renderAccidentals = (notes: Note[]): string =>
  notes.length === 0 ? 'None' : notes.map(noteToString).join(', ')

/**
 * Voice a note as close to middle C (C4 = 60) as possible but never below it —
 * the lowest octave whose pitch is at or above middle C (so it lands within the
 * octave just above, never under the staff).
 */
function nearMiddleC(note: Note): Voiced {
  let octave = 2
  while (voicedMidi({ note, octave }) < 60) octave++
  return { note, octave }
}

// Four cumulative ABRSM-style bands by key-signature accidentals, scaling like
// the Scales étude: Easy ≤2, Medium ≤4, Hard ≤6, Expert ≤7 (adds C♯/C♭ major,
// A♯/A♭ minor — the seven-accidental keys).
const SIG_LEVEL_ACCIDENTALS = [2, 4, 6, 7]

/**
 * 3. Key signatures: name the sharps/flats of each major and minor key. Four
 * cumulative levels by key range (level-prefixed ids, each its own SRS set). On
 * reveal, a treble staff shows the key signature + ascending scale, and the
 * keyboard highlights only the sharpened/flattened keys (labelled, so an E♯ on
 * the F key reads clearly). Minor keys use the natural minor (= the signature).
 */
function keySignatureQuestions(): Question[] {
  const questions: Question[] = []
  SIG_LEVEL_ACCIDENTALS.forEach((maxAccidentals, levelIndex) => {
    const level = levelIndex + 1
    for (const majorTonic of SIG_MAJOR_TONICS) {
      const majorNotes = majorScale(majorTonic)
      const minorTonic = majorNotes[5] // relative minor = 6th degree
      const accNotes = majorNotes.filter((n) => n.accidental !== 0)
      const count = accNotes.length
      if (count > maxAccidentals) continue
      const sharp = accNotes.length > 0 && accNotes[0].accidental > 0
      const order = sharp ? SHARP_ORDER : FLAT_ORDER
      const opposite = sharp ? FLAT_ORDER : SHARP_ORDER

      const correct = renderAccidentals(order.slice(0, count))
      // Distractors: one fewer / one more of the same sign, and the same count of
      // the opposite sign — forcing the exact count AND sharp-vs-flat. (count 0
      // has no sign, so offer small sharp/flat sets instead.)
      const distractors =
        count === 0
          ? [
              renderAccidentals(SHARP_ORDER.slice(0, 1)),
              renderAccidentals(FLAT_ORDER.slice(0, 1)),
              renderAccidentals(SHARP_ORDER.slice(0, 2)),
              renderAccidentals(FLAT_ORDER.slice(0, 2)),
            ]
          : [
              renderAccidentals(order.slice(0, count - 1)),
              renderAccidentals(order.slice(0, Math.min(count + 1, 7))),
              renderAccidentals(opposite.slice(0, count)),
              renderAccidentals(opposite.slice(0, Math.max(count - 1, 1))),
            ]

      for (const mode of ['major', 'minor'] as Mode[]) {
        const tonic = mode === 'major' ? majorTonic : minorTonic
        const scale = mode === 'major' ? majorNotes : minorScale(minorTonic, 'natural')
        // The signature is shared with the relative key (the other mode).
        const relativeKeyName =
          mode === 'major'
            ? `${noteToString(minorTonic)} minor`
            : `${noteToString(majorTonic)} major`
        const q = buildQuestion(
          'key-signatures',
          `key-sig:L${level}:${asciiTonicId(tonic)}:${mode}`,
          'Key signature',
          `What notes are sharpened or flattened in ${noteToString(tonic)} ${mode}?`,
          correct,
          distractors,
          undefined,
          keySignatureExplanation(tonic, mode, order.slice(0, count), relativeKeyName)
        )
        q.level = level
        // Reveal shows ONLY the sharpened/flattened notes: on the staff (under
        // the key signature) and highlighted on the keyboard (labelled with the
        // note name, so a white-key enharmonic like E♯ is unambiguous). Each note
        // is voiced as close to middle C as possible, then ordered low→high. Keys
        // with no accidentals (C major / A minor) get neither — nothing to show.
        const accidentals = scale
          .filter((n) => n.accidental !== 0)
          .map(nearMiddleC)
          .sort((a, b) => voicedMidi(a) - voicedMidi(b))
        if (accidentals.length > 0) {
          q.notation = {
            groups: accidentals.map((v) => [v]),
            clef: 'treble',
            keySignature: keySignatureSpec(tonic, mode),
            onReveal: true,
          }
          q.keyboard = {
            marks: accidentals.map((v) => ({
              midi: voicedMidi(v),
              label: noteToString(v.note),
            })),
          }
        }
        questions.push(q)
      }
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

// Four cumulative difficulty levels by key range (key-signature accidentals):
// Easy ≤1, Medium ≤3, Hard ≤5, Expert all twelve (≤6). Spreading the key range
// across four bands tracks ABRSM, where the full set of keys arrives by grade 5.
const CHORD_LEVEL_ACCIDENTALS = [1, 3, 5, 6]

/**
 * 4. Diatonic chords by Roman-numeral degree, for both modes of every key.
 * Trimmed triad set plus the V7. Distractors lead with the same degree in
 * other keys of the same mode (forcing key knowledge), then the other
 * diatonic chords of the same key.
 */
function chordDegreeQuestions(): Question[] {
  const modes: Mode[] = ['major', 'minor']
  const questions: Question[] = []
  CHORD_LEVEL_ACCIDENTALS.forEach((maxAccidentals, levelIndex) => {
    const level = levelIndex + 1
    for (const key of KEYS) {
      if (accidentalCount(key.majorTonic) > maxAccidentals) continue
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
            `chord-deg:L${level}:${asciiTonicId(tonic)}:${mode}:${degree}${seventh ? ':7' : ''}`,
            'Diatonic chord',
            `In ${name}, what is the ${roman} chord?`,
            correct,
            distractors,
            audio,
            chordExplanation(name, mode, degree, seventh, correctChord)
          )
          q.level = level
          // V and vii° in minor borrow the harmonic minor's raised 7th, which
          // isn't in the natural minor scale — clarify that on the reveal.
          if (mode === 'minor' && (degree === 4 || degree === 6)) {
            const leadingTone = noteToString(minorScale(tonic, 'harmonic')[6])
            q.caption = `${leadingTone} is the harmonic minor's raised 7th — the leading tone, not in the natural minor scale. Minor keys borrow it so V is major and vii° diminished; natural minor alone gives a minor v and a major VII.`
          }
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
  })
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
// Four cumulative difficulty levels by key range (key-signature accidentals) —
// the dominant difficulty when spelling a progression: Easy ≤1 accidental
// (C/G/F + relative minors), Medium ≤3, Hard ≤5, Expert all twelve (≤6).
const PROGRESSION_LEVEL_ACCIDENTALS = [1, 3, 5, 6]

function progressionQuestions(): Question[] {
  const questions: Question[] = []
  PROGRESSION_LEVEL_ACCIDENTALS.forEach((maxAccidentals, levelIndex) => {
    const level = levelIndex + 1
    for (const prog of PROGRESSIONS) {
      const sevenths = SEVENTH_PROGRESSION_SLUGS.has(prog.slug)
        ? [false, true]
        : [false]
      for (const seventh of sevenths) {
        const label = progressionLabel(prog, seventh)
        const modeKeys = KEYS.map((key) => keyForMode(key, prog.mode))
        const lastIndex = prog.degrees.length - 1
        for (const key of KEYS) {
          if (accidentalCount(key.majorTonic) > maxAccidentals) continue
          const { tonic, name } = keyForMode(key, prog.mode)
          const audio: Record<string, Playable> = {}
          const correct = spellAndRegister(tonic, prog, seventh, audio)
          const chords = prog.degrees.map((d) =>
            romanToChord(tonic, prog.mode, d, seventh)
          )

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

          const q = buildQuestion(
            'progressions',
            `prog:L${level}:${asciiTonicId(tonic)}:${prog.mode}:${prog.slug}${seventh ? ':7' : ':3'}`,
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
          q.level = level
          // On reveal, show the chords on a treble staff under the key's
          // signature, so the spelling is read in its harmonic context.
          q.notation = {
            groups: chords.map((c) => voiceChordRootPosition(c, 4)),
            clef: 'treble',
            keySignature: keySignatureSpec(tonic, prog.mode),
            onReveal: true,
          }
          questions.push(q)
        }
      }
    }
  })
  return questions
}

interface IntervalDef {
  name: string
  semitones: number
  letterSteps: number
}

/** The simple intervals within an octave, then the compound intervals (Expert). */
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
  // Compound intervals (octave + a simple interval) — ABRSM grade 5+.
  { name: 'Minor 9th', semitones: 13, letterSteps: 8 },
  { name: 'Major 9th', semitones: 14, letterSteps: 8 },
  { name: 'Minor 10th', semitones: 15, letterSteps: 9 },
  { name: 'Major 10th', semitones: 16, letterSteps: 9 },
  { name: 'Perfect 11th', semitones: 17, letterSteps: 10 },
  { name: 'Perfect 12th', semitones: 19, letterSteps: 11 },
  { name: 'Major 13th', semitones: 21, letterSteps: 12 },
]

// Four cumulative difficulty bands by interval span (ABRSM-aligned): Easy =
// 3rds/5th/octave; Medium adds 2nds/4th/tritone; Hard = all simple intervals;
// Expert adds compound intervals (9th–13th). Choices widen: Easy 4 … Expert 6.
const INTERVAL_LEVELS: { semitones: number[]; maxDistractors: number }[] = [
  { semitones: [3, 4, 7, 12], maxDistractors: 3 }, // m3, M3, P5, 8ve
  { semitones: [1, 2, 3, 4, 5, 6, 7, 12], maxDistractors: 4 }, // + m2 M2 P4 TT
  { semitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], maxDistractors: 5 }, // all simple
  { semitones: [3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21], maxDistractors: 5 }, // + compound
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
// A succinct note on each progression's character and where it's heard.
const PROGRESSION_STYLE: Record<string, string> = {
  'I-IV-V': 'The three primary chords — the bedrock of folk, blues, and early rock ’n’ roll.',
  'ii-V-I': 'The ii–V–I: the cadential backbone of jazz.',
  'I-V-vi-IV': 'The “four-chord song” — ubiquitous across modern pop.',
  'I-vi-IV-V': 'The 1950s doo-wop progression (think “Stand by Me”).',
  'vi-IV-I-V': 'A pop/rock anthem staple — a rotation of the “axis” progression.',
  'I-IV-vi-V': 'A bright pop turnaround.',
  'i-iv-V': 'A minor cadence with a major V borrowed from the harmonic minor — common in classical and flamenco.',
  'iio-V-i': 'The minor ii°–V–i: the minor-key jazz cadence.',
  'i-VI-iv-V': 'A wistful minor pop/rock progression.',
  'VI-iv-i-V': 'A brooding minor pop progression.',
  'i-iv-V-i': 'A full minor cadence, classical in flavour.',
}

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
    q.caption = PROGRESSION_STYLE[prog.slug]
    return q
  })
}

// Only root, first, and second inversion (bass = root / 3rd / 5th) — never the
// 7th or 9th in the bass. Every chord size has these three, so the cap is fixed.
const INVERSIONS = 3
const INVERSION_NAMES = ['root position', 'first inversion', 'second inversion']

/** The four Chord-Recognition difficulty levels (chord complexity + key range). */
interface RecLevel {
  n: number
  sizes: ChordSize[]
  invert: boolean
  /** Include keys whose signature has at most this many accidentals. */
  maxAccidentals: number
}
// ABRSM-aligned: root-position triads (G1–3) → inversions (G5) → sevenths (G6)
// → ninths (G7–8). Ninths now live only in Expert (Hard was too hard).
const REC_LEVELS: RecLevel[] = [
  { n: 1, sizes: ['triad'], invert: false, maxAccidentals: 3 }, // Easy
  { n: 2, sizes: ['triad'], invert: true, maxAccidentals: 6 }, // Medium — inversions
  { n: 3, sizes: ['triad', 'seventh'], invert: true, maxAccidentals: 6 }, // Hard — sevenths
  { n: 4, sizes: ['triad', 'seventh', 'ninth'], invert: true, maxAccidentals: 6 }, // Expert — ninths
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
          // Inversions take longer to read (re-stack the notes in thirds to
          // find the root), so grant 5 s on top of the 10 s category default.
          // Expert runs against a tighter clock (8 s, +4 s for inversions).
          if (level.n === 4) q.timeLimitMs = inversion !== 0 ? 12000 : 8000
          else if (inversion !== 0) q.timeLimitMs = 15000
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

// Line-of-fifths position of each natural letter (F=−1 … B=5); a key's signature
// adds 7 per sharp / subtracts 7 per flat on the tonic's accidental.
const LETTER_FIFTHS: Record<string, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 }

/**
 * The chord's own tonic-key signature: the major key of the root when the chord
 * has a major 3rd, the minor key when it has a minor 3rd — so the root names the
 * key and the remaining tones (♭5/♯5/♭7…) print as accidentals. Falls back to no
 * signature (every alteration inline) when that key isn't a real one — i.e. the
 * root's spelling would need more than 7 sharps/flats, e.g. D♯ major or E♯ minor.
 */
function chordKeySignature(tones: Note[]): string {
  const root = tones[0]
  const major = semis(root, tones[1]) === 4
  const fifths = LETTER_FIFTHS[root.letter] + 7 * root.accidental
  const sigFifths = major ? fifths : fifths - 3
  if (sigFifths < -7 || sigFifths > 7) return 'C'
  return keySignatureSpec(root, major ? 'major' : 'minor')
}

// The four Chord-Spelling levels (chord complexity × key range; no inversions).
// Each step adds either a chord size or more keys, and the full key range is held
// back to Expert so every band is distinct.
const SPELL_LEVELS: { n: number; sizes: ChordSize[]; maxAccidentals: number }[] = [
  { n: 1, sizes: ['triad'], maxAccidentals: 1 }, // Easy
  { n: 2, sizes: ['triad', 'seventh'], maxAccidentals: 3 }, // Medium
  { n: 3, sizes: ['triad', 'seventh', 'ninth'], maxAccidentals: 5 }, // Hard
  { n: 4, sizes: ['triad', 'seventh', 'ninth'], maxAccidentals: 6 }, // Expert
]

/** Same-root distractor qualities by size (the root is given by the symbol). */
const TRIAD_QUALITIES: Quality[] = ['maj', 'min', 'dim', 'aug']
const SEVENTH_QUALITIES: Quality[] = ['dom7', 'maj7', 'min7', 'm7b5', 'dim7', 'mMaj7']
/** Base sevenths for clean ninths (9 / maj9 / m9 / m(maj9)). */
const NINTH_BASES: Quality[] = ['dom7', 'maj7', 'min7', 'mMaj7']

/**
 * 7. Chord spelling — the inverse of Chord Recognition: show a chord symbol and
 * pick its notes. Diatonic chords of every key supply the symbols (so spellings
 * are always correct); three levels (SPELL_LEVELS) scale chord size and key
 * range, each its own SRS set. Choices share the answer's root and differ only
 * in quality (the symbol already gives the root), so the test is decoding the
 * quality. Reveal shows the chord on a staff beside a fingered keyboard.
 */
function chordSpellingQuestions(): Question[] {
  const modes: Mode[] = ['major', 'minor']
  const questions: Question[] = []
  for (const level of SPELL_LEVELS) {
    let idx = 0
    for (const key of KEYS) {
      if (accidentalCount(key.majorTonic) > level.maxAccidentals) continue
      for (const mode of modes) {
        const { tonic } = keyForMode(key, mode)
        for (let degree = 0; degree < 7; degree++) {
          // Deterministic size; demote an exotic ninth to its seventh.
          let size = level.sizes[idx % level.sizes.length]
          let tones = recChordTones(tonic, mode, degree, size)
          if (size === 'ninth' && !isCleanNinth(tones)) {
            size = 'seventh'
            tones = recChordTones(tonic, mode, degree, size)
          }
          idx++

          const symbol = recChordSymbol(tones)
          const root = tones[0]

          // Each choice is a note-set string; register its block playback.
          const audio: Record<string, Playable> = {}
          const offer = (notes: Note[]): string => {
            const s = renderScale(notes)
            audio[s] = {
              kind: 'chord',
              events: [voiceScaleAscending(notes, 4).map(voicedMidi)],
            }
            return s
          }
          const correct = offer(tones)

          // Same-root, different-quality distractors (buildQuestion drops the
          // one that equals the correct spelling). Skip any out-of-range spelling.
          const distractors: string[] = []
          if (size === 'ninth') {
            const ninth = tones[4] // the clean major-9th, shared by all bases
            for (const base of NINTH_BASES) {
              try {
                distractors.push(offer([...spellChord(root, base), ninth]))
              } catch {
                continue
              }
            }
          } else {
            const pool = size === 'triad' ? TRIAD_QUALITIES : SEVENTH_QUALITIES
            for (const q of pool) {
              try {
                distractors.push(offer(spellChord(root, q)))
              } catch {
                continue
              }
            }
          }

          const q = buildQuestion(
            'chord-spelling',
            `chord-spell:L${level.n}:${asciiTonicId(tonic)}${mode === 'minor' ? 'm' : 'M'}:${degree}:${size}`,
            'Chord spelling',
            `Spell the chord ${symbol}.`,
            correct,
            distractors,
            audio,
            chordSpellingExplanation(symbol, tones)
          )
          q.level = level.n
          // Reveal: the chord on a staff under its own tonic key's signature
          // (root names the key; the rest of the chord prints as accidentals)
          // beside the keyboard, each key labelled with both fingerings.
          const voiced = voiceScaleAscending(tones, 4)
          const rhFng = chordFingering(voiced.length, 'RH')
          const lhFng = chordFingering(voiced.length, 'LH')
          q.notation = {
            groups: [voiced],
            clef: 'treble',
            keySignature: chordKeySignature(tones),
            onReveal: true,
          }
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
  // L4 Expert: longer lines (6–10 notes) ranging beyond the octave (up to a 10th,
  // degree 9). Solfège is octave-agnostic, so the upper-octave notes reuse the
  // same syllables (re, mi …) — the leap, not the name, is what's harder.
  [
    [0, 2, 4, 7, 9, 7, 4, 0],
    [0, 4, 7, 9, 7, 4, 0],
    [0, 2, 4, 5, 7, 9, 8, 7],
    [7, 9, 8, 7, 5, 4, 2, 0],
    [0, 7, 9, 7, 4, 2, 0],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [9, 7, 5, 4, 2, 0],
    [0, 4, 2, 7, 9, 5, 4, 0],
    [0, 2, 4, 7, 8, 9, 7, 0],
    [4, 7, 9, 7, 4, 2, 0],
  ],
]

const clampDeg = (d: number): number => Math.max(0, Math.min(14, d))

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
const HD: RhythmEvent = { dur: 'h', dots: 1 } // dotted half = 3 beats
const Q: RhythmEvent = { dur: 'q' }
const QD: RhythmEvent = { dur: 'q', dots: 1 } // dotted quarter = 1.5 beats
const E: RhythmEvent = { dur: '8' }
const ED: RhythmEvent = { dur: '8', dots: 1 } // dotted eighth = 0.75 beat
const S: RhythmEvent = { dur: '16' }
const X: RhythmEvent = { dur: '32' }
const T: RhythmEvent = { dur: '8', triplet: true } // eighth-note triplet member
const QT: RhythmEvent = { dur: 'q', triplet: true } // quarter-note triplet member (three over two beats)
const HT: RhythmEvent = { dur: 'h', triplet: true } // half-note triplet member (three over four beats)
const ST: RhythmEvent = { dur: '16', triplet: true } // sixteenth triplet member (three per half-beat)
const TR: RhythmEvent = { dur: '8', triplet: true, rest: true } // eighth rest inside a triplet
const QDD: RhythmEvent = { dur: 'q', dots: 2 } // double-dotted quarter = 1.75 beats
const QR: RhythmEvent = { dur: 'q', rest: true }
const ER: RhythmEvent = { dur: '8', rest: true }
const SR: RhythmEvent = { dur: '16', rest: true }
// (No 32nd rests — avoided as a rule; they read as clutter.)
/** Tie this event to the next (same pitch, held together). */
const tie = (e: RhythmEvent): RhythmEvent => ({ ...e, tie: true })

interface RhythmLevelDef {
  tempo: number
  pools: Partial<Record<TimeSig, RhythmEvent[][]>>
}

// Four difficulty levels: vocabulary, syncopation, and tempo grow per level,
// following the graded sources (ABRSM/RCM syllabi, Kodály sequences, Starer):
// Easy ≈ grade 1–2, Medium ≈ 3–5, Hard ≈ 6–7, Expert ≈ 8+.
export const RHYTHM_LEVELS: RhythmLevelDef[] = [
  // L1 Easy (≈ grade 1–2) — whole/half/quarter/paired-eighth values and simple
  // rests in the simple metres; no triplets, no compound metre, no syncopation.
  // One up-edge melodic cell: dotted-quarter + eighth.
  {
    tempo: 76,
    pools: {
      '4/4': [
        [Q, Q, Q, Q],
        [H, H],
        [W],
        [H, Q, Q],
        [Q, Q, H],
        [Q, H, Q],
        [HD, Q],
        [QD, E, H], // dotted quarter + eighth — the one Easy dotted figure
        [E, E, Q, Q, Q],
        [Q, E, E, Q, Q],
        [Q, Q, Q, E, E],
        [E, E, E, E, H],
        [H, E, E, Q],
        [QR, Q, Q, Q],
        [Q, QR, Q, Q],
        [Q, QR, H],
        [H, QR, Q],
      ],
      '3/4': [
        [Q, Q, Q],
        [H, Q],
        [Q, H],
        [HD],
        [QD, E, Q],
        [E, E, Q, Q],
        [Q, E, E, Q],
        [Q, Q, E, E],
        [H, E, E],
        [Q, QR, Q],
        [QR, Q, Q],
      ],
      // Easy is simple-metre only — 6/8 (compound) is introduced at Medium.
      '2/4': [
        [Q, Q],
        [H],
        [Q, E, E],
        [E, E, Q],
        [E, E, E, E],
        [Q, QR],
        [QR, Q],
        [E, E, QR],
      ],
    },
  },
  // L2 Medium (≈ grade 3–5) — sixteenth cells (ti-tika, tika-ti), dotted-eighth
  // figures and the Scotch snap, the named syncopation family (syncopa,
  // tresillo, Charleston; cinquillo and habanera in 2/4), eighth triplets, a
  // first quarter-note triplet, simple ties, fuller 6/8, cut time.
  {
    tempo: 100,
    pools: {
      '4/4': [
        [S, S, S, S, Q, Q, Q],
        [Q, S, S, S, S, Q, Q],
        [E, S, S, E, S, S, Q, Q],
        [S, S, E, S, S, E, Q, Q],
        [ED, S, Q, Q, Q], // dotted-eighth + sixteenth (long-short)
        [S, ED, Q, Q, Q], // sixteenth + dotted-eighth (Scotch snap)
        [QD, E, Q, Q],
        [Q, QD, E, Q],
        [QD, QD, Q], // tresillo (3+3+2)
        [QD, E, QR, Q], // Charleston — the "& of 2" anticipation, then space
        [E, Q, E, Q, Q], // syncopa — eighth, quarter, eighth
        [T, T, T, Q, Q, Q],
        [Q, Q, T, T, T, Q],
        [QT, QT, QT, H], // quarter-note triplet — three over beats 1–2
        [E, E, S, S, S, S, Q, Q],
        [Q, tie(Q), Q, Q],
        [S, SR, S, S, Q, Q, Q],
        [ER, E, ER, E, Q, Q], // off-beat eighths
      ],
      '3/4': [
        [S, S, S, S, Q, Q],
        [Q, S, S, S, S, Q],
        [E, S, S, E, S, S, Q],
        [ED, S, Q, Q],
        [S, ED, Q, Q],
        [QD, E, Q],
        [Q, QD, E],
        [E, Q, E, Q], // syncopa
        [T, T, T, Q, Q],
        [E, E, Q, E, E],
        [Q, tie(Q), Q],
      ],
      '6/8': [
        [QD, QD],
        [E, E, E, E, E, E],
        [QD, E, E, E],
        [E, E, E, QD],
        [Q, E, Q, E], // long–short on each beat
        [E, Q, E, Q], // short–long on each beat
        [Q, E, QD],
        [QD, Q, E],
        [E, E, E, Q, E],
        [S, S, E, E, QD],
        [QD, E, ER, E],
      ],
      // 2/4 inherited from Easy — sixteenth and dotted cells plus the Cuban
      // one-bar cells (cinquillo, habanera).
      '2/4': [
        [S, S, S, S, Q],
        [E, S, S, Q],
        [S, S, E, Q],
        [ED, S, Q],
        [S, ED, Q],
        [QD, E],
        [T, T, T, Q],
        [E, S, E, S, E], // cinquillo
        [ED, S, E, E], // habanera
      ],
      // 12/8 — compound quadruple (four dotted-quarter beats).
      '12/8': [
        [QD, QD, QD, QD],
        [E, E, E, E, E, E, E, E, E, E, E, E],
        [QD, E, E, E, QD, E, E, E],
        [E, E, E, QD, E, E, E, QD],
        [Q, E, Q, E, Q, E, Q, E],
        [QD, QD, Q, E, QD],
        [E, E, E, E, E, E, QD, QD],
        [S, S, E, E, QD, QD, QD],
      ],
      // 2/2 — cut time (felt in two half-note beats).
      '2/2': [
        [H, H],
        [W],
        [H, Q, Q],
        [Q, Q, H],
        [Q, Q, Q, Q],
        [E, E, Q, Q, Q],
        [H, E, E, Q],
        [Q, H, Q], // syncopa at the half-note-beat level
        [QD, E, H],
      ],
    },
  },
  // L3 Hard (≈ grade 6–7) — tied cross-beat syncopation and anticipation
  // pushes, off-beat quarters, sixteenth syncopes, the triplet-syncopation
  // family (tied-first-two shuffle, tied-last-two, gapped), quarter-note
  // triplets, 32nd runs, 5/4, and first 5/8 (3+2) & 7/8 (2+2+3) bars.
  {
    tempo: 138,
    pools: {
      '4/4': [
        [S, S, S, S, S, S, S, S, Q, Q],
        [E, S, S, E, S, S, E, S, S, Q],
        [ED, S, ED, S, Q, Q],
        [S, ED, S, ED, Q, Q],
        [QD, QD, Q], // tresillo
        [E, QD, QD, E], // Charleston-style off-beats
        [E, Q, Q, Q, E], // off-beat quarters
        [E, Q, Q, E, Q],
        [E, tie(Q), E, E, tie(Q), E],
        [Q, E, tie(Q), E, Q], // anticipation — pushed into beat 3 and held
        [S, E, S, Q, Q, Q], // sixteenth syncope (short-long-short)
        [T, T, T, T, T, T, Q, Q],
        [T, T, T, Q, T, T, T, Q],
        [tie(T), T, T, Q, Q, Q], // shuffle — first two triplet notes tied
        [T, tie(T), T, Q, Q, Q], // last two triplet notes tied
        [T, TR, T, Q, Q, Q], // gapped triplet — rest in the middle
        [TR, T, T, Q, Q, Q], // triplet starting off a rest
        [QT, QT, QT, Q, Q], // quarter-note triplet over beats 1–2
        [Q, Q, QT, QT, QT], // quarter-note triplet over beats 3–4
        [X, X, X, X, E, Q, Q, Q],
        [ED, S, E, E, Q, Q],
      ],
      '3/4': [
        [S, S, S, S, S, S, S, S, Q],
        [ED, S, ED, S, Q],
        [S, ED, S, ED, Q],
        [E, Q, Q, E],
        [T, T, T, T, T, T, Q],
        [E, tie(Q), E, Q],
        [E, QD, Q],
        [S, S, E, S, S, E, Q],
        [QT, QT, QT, Q],
        [tie(T), T, T, Q, Q],
        [S, E, S, Q, Q],
      ],
      '6/8': [
        [QD, E, E, E],
        [E, E, E, QD],
        [Q, E, Q, E],
        [S, S, S, S, E, QD],
        [E, E, E, S, S, S, S, E],
        [E, S, S, E, QD],
        [QD, S, S, E, E],
        [E, E, E, E, S, S, E],
        [E, Q, Q, E], // cross-beat syncopation
        [E, ER, E, E, ER, E], // off-beat eighths in compound
      ],
      // 2/4 inherited — dense sixteenth runs, snaps, triplets, syncopation.
      '2/4': [
        [S, S, S, S, S, S, S, S],
        [E, S, S, E, S, S],
        [ED, S, ED, S],
        [S, ED, S, ED],
        [T, T, T, T, T, T],
        [E, tie(Q), E],
        [E, Q, E],
        [S, E, S, Q],
        [tie(T), T, T, Q],
      ],
      // 12/8 inherited — sixteenth cells and off-beat compound syncopation.
      '12/8': [
        [S, S, E, E, QD, QD, QD],
        [E, S, S, E, QD, E, S, S, E, QD],
        [S, S, S, S, S, S, QD, QD, QD],
        [E, Q, E, Q, E, Q, E, Q],
        [QD, S, S, E, E, QD, QD],
        [QD, QD, E, S, S, E, QD],
      ],
      // 5/4 — asymmetric quintuple (felt 3+2).
      '5/4': [
        [Q, Q, Q, Q, Q],
        [HD, H],
        [H, HD],
        [H, Q, H],
        [Q, Q, Q, H],
        [E, E, E, E, Q, Q, Q],
        [QD, QD, Q, Q],
        [S, S, S, S, Q, Q, Q, Q],
        [Q, Q, Q, T, T, T, Q],
      ],
      // 2/2 inherited — cut time, now with syncopation and finer subdivision.
      '2/2': [
        [H, H],
        [Q, Q, Q, Q],
        [E, E, E, E, E, E, E, E],
        [Q, H, Q],
        [S, S, S, S, Q, Q, Q],
        [E, Q, Q, Q, E],
        [QD, QD, Q],
        [E, tie(Q), E, H], // tied cross-beat push in cut time
      ],
      // 5/8 — asymmetric, felt 3+2 (a dotted-quarter beat then a quarter beat).
      '5/8': [
        [QD, Q],
        [E, E, E, E, E],
        [QD, E, E],
        [E, E, E, Q],
        [QD, E, ER],
      ],
      // 7/8 — asymmetric, felt 2+2+3 (two quarter beats then a dotted-quarter).
      '7/8': [
        [Q, Q, QD],
        [E, E, E, E, E, E, E],
        [Q, Q, E, E, E],
        [E, E, Q, QD],
        [Q, E, E, QD],
        [Q, Q, Q, E],
      ],
    },
  },
  // L4 Expert (≈ grade 8+) — quarter- and half-note triplets, tied-triplet
  // shuffle lines, sixteenth triplets, double-dotted figures, dense displaced
  // sixteenth (funk/Latin) cells, full 32nd runs, wall-to-wall tied/off-beat
  // syncopation, and denser 5/8 & 7/8.
  {
    tempo: 152,
    pools: {
      '4/4': [
        [X, X, X, X, X, X, X, X, Q, Q, Q],
        [T, T, T, T, T, T, T, T, T, T, T, T],
        [ED, S, ED, S, ED, S, Q],
        [S, S, E, S, S, E, S, S, E, S, S, E],
        [E, tie(Q), E, E, tie(Q), E],
        [S, S, S, S, X, X, X, X, X, X, X, X, Q, Q],
        [E, QD, QD, E],
        [X, X, X, X, E, T, T, T, Q, Q],
        [HT, HT, HT], // half-note triplet — three over the whole bar
        [QT, QT, QT, QT, QT, QT], // back-to-back quarter-note triplets
        [tie(T), T, T, tie(T), T, T, Q, Q], // shuffle line
        [ST, ST, ST, ST, ST, ST, Q, Q, Q], // sixteenth triplets — six per beat
        [ST, ST, ST, E, ST, ST, ST, E, Q, Q],
        [QDD, S, QDD, S], // double-dotted quarters
        [S, E, S, S, E, S, Q, Q], // paired sixteenth syncopes
        [S, E, E, E, S, Q, Q], // displaced off-beat sixteenth chain
        [E, Q, E, E, Q, E], // double syncopa
      ],
      '3/4': [
        [X, X, X, X, X, X, X, X, Q, Q],
        [T, T, T, T, T, T, T, T, T],
        [S, S, E, S, S, E, S, S, E],
        [E, tie(Q), tie(E), E, E],
        [X, X, X, X, E, T, T, T, Q],
        [ED, S, ED, S, E, E],
        [Q, QT, QT, QT],
        [ST, ST, ST, ST, ST, ST, Q, Q],
        [QDD, S, Q],
      ],
      '2/4': [
        [X, X, X, X, X, X, X, X, Q],
        [T, T, T, T, T, T],
        [S, S, E, S, S, E],
        [X, X, X, X, E, Q],
        [ED, S, ED, S],
        [ST, ST, ST, ST, ST, ST, Q],
        [S, E, S, S, E, S],
        [E, S, tie(E), S, E], // compressed cinquillo — tied middle
      ],
      '6/8': [
        [S, S, S, S, S, S, S, S, S, S, S, S],
        [S, S, E, S, S, E, S, S, E],
        [E, E, S, S, E, S, S, E],
        [QD, S, S, E, E],
        [S, S, S, S, E, QD],
        [E, tie(Q), E, Q],
        [Q, Q, Q], // hemiola — three quarters against the two dotted beats
        [E, Q, E, E, E],
      ],
      '12/8': [
        [E, S, S, E, QD, E, S, S, E, QD],
        [S, S, E, E, QD, S, S, E, E, QD],
        [E, E, E, QD, E, E, E, QD],
        [QD, E, E, E, QD, E, E, E],
        [S, S, S, S, E, QD, S, S, S, S, E, QD],
      ],
      '5/4': [
        [X, X, X, X, X, X, X, X, Q, Q, Q, Q],
        [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
        [S, S, E, S, S, E, S, S, E, S, S, E, S, S, E],
        [E, E, Q, E, E, Q, Q],
        [QD, QD, Q, Q],
        [Q, E, E, Q, Q, Q],
      ],
      '2/2': [
        [X, X, X, X, X, X, X, X, Q, Q, Q],
        [T, T, T, T, T, T, T, T, T, T, T, T],
        [S, S, E, S, S, E, S, S, E, S, S, E],
        [E, tie(Q), E, E, tie(Q), E],
        [E, QD, QD, E],
        [QD, QD, Q],
        [HT, HT, HT], // half-note triplet across the cut-time bar
      ],
      '5/8': [
        [S, S, S, S, S, S, E, E],
        [E, S, S, E, S, S, E],
        [QD, S, S, S, S],
        [E, E, E, S, S, E],
        [E, Q, Q], // syncope across the 3+2 seam
      ],
      '7/8': [
        [S, S, S, S, Q, E, E, E],
        [E, S, S, E, S, S, QD],
        [E, E, E, E, E, S, S, E],
        [Q, E, Q, E, E],
        [S, S, S, S, E, E, E, E, E],
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
      const rawPool = def.pools[meter]!
      // Collapse patterns that SOUND identical (e.g. a dotted quarter vs a
      // quarter tied to an eighth): keep the simplest notation per audible
      // signature, in first-seen order, so a question never offers two choices
      // that both match the rhythm played.
      const repBySig = new Map<string, RhythmEvent[]>()
      for (const p of rawPool) {
        const s = audibleSignature(p)
        const cur = repBySig.get(s)
        if (!cur || p.length < cur.length) repBySig.set(s, p)
      }
      const seen = new Set<string>()
      const pool: RhythmEvent[][] = []
      for (const p of rawPool) {
        const s = audibleSignature(p)
        if (seen.has(s)) continue
        seen.add(s)
        pool.push(repBySig.get(s)!)
      }
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

// Metres trimmed from tap-along (only) vs the shared RHYTHM_LEVELS, by level:
// Medium drops 12/8 — compound quadruple is left for Hard+ here. (Rhythm
// Dictation keeps the full RHYTHM_LEVELS set; this filter is tap-along-specific.)
const TAP_EXCLUDE_METERS: Partial<Record<number, TimeSig[]>> = {
  2: ['12/8'],
}

/**
 * Tap the Rhythm (interactive): show a one-bar rhythm as notation; the student
 * taps it in time after a count-in. Reuses the rhythm-dictation vocabulary
 * (`RHYTHM_LEVELS`) and the same per-audible-signature dedup, but each pattern is
 * its own non-MC question graded by tap accuracy (no distractors).
 */
function rhythmTapQuestions(): Question[] {
  const questions: Question[] = []
  RHYTHM_LEVELS.forEach((def, levelIndex) => {
    const level = levelIndex + 1
    for (const meter of Object.keys(def.pools) as TimeSig[]) {
      if (TAP_EXCLUDE_METERS[level]?.includes(meter)) continue
      const rawPool = def.pools[meter]!
      // Keep the simplest notation per audible signature (same as dictation).
      const repBySig = new Map<string, RhythmEvent[]>()
      for (const p of rawPool) {
        const s = audibleSignature(p)
        const cur = repBySig.get(s)
        if (!cur || p.length < cur.length) repBySig.set(s, p)
      }
      const seen = new Set<string>()
      for (const p of rawPool) {
        const s = audibleSignature(p)
        if (seen.has(s)) continue
        seen.add(s)
        const pattern = repBySig.get(s)!
        const key = rhythmKey(pattern).replace(/[\s.~]/g, '_')
        questions.push({
          id: `rhythm-tap:L${level}:${meter.replace('/', '-')}:${key}`,
          etudeId: 'rhythm-tap',
          category: 'Tap the rhythm',
          prompt: `Tap this rhythm (${meter}).`,
          choices: [],
          answerIndex: -1,
          level,
          tapAlong: { meter, tempo: def.tempo, pattern },
        })
      }
    }
  })
  return questions
}

// ── Play the Scale (interactive) ─────────────────────────────────────────────
// Sudden-death; cumulative ABRSM-grade key scope. Easy = 1 octave / 15 s;
// Medium = 2 oct / 20 s; Hard = 2 oct / 15 s. Each in-scope minor key appears
// in all three forms.
interface ScalePlayLevel {
  n: number
  octaves: 1 | 2
  seconds: number
  majors: string[] // major tonic names in scope
  minors: string[] // minor tonic names in scope
}
const ALL_MAJOR = KEYS.map((k) => noteToString(k.majorTonic))
const ALL_MINOR = KEYS.map((k) => noteToString(k.minorTonic))
// Cumulative ABRSM scale scope: Easy = grade-1 keys (C/G/D/F + A/D minor), 1
// octave; Medium = grade-2/3 keys, 2 octaves; Hard = all keys, 2 octaves; Expert
// = all keys, 2 octaves against a tighter clock and zero forgiven errors (the
// error allowance is set per level in ScalePlayCard).
const SCALE_PLAY_LEVELS: ScalePlayLevel[] = [
  { n: 1, octaves: 1, seconds: 15, majors: ['C', 'G', 'D', 'F'], minors: ['A', 'D'] },
  { n: 2, octaves: 2, seconds: 20, majors: ['C', 'G', 'D', 'F', 'A'], minors: ['A', 'D', 'E', 'G'] },
  { n: 3, octaves: 2, seconds: 18, majors: ALL_MAJOR, minors: ALL_MINOR },
  { n: 4, octaves: 2, seconds: 12, majors: ALL_MAJOR, minors: ALL_MINOR },
]

function scalePlayQuestion(
  lvl: ScalePlayLevel,
  tonic: Note,
  scale: Note[],
  idType: string,
  keyName: string,
  rh: number[],
  lh: number[]
): Question {
  const seq =
    lvl.octaves === 1 ? [...scale, scale[0]] : [...scale, ...scale, scale[0]]
  return {
    id: `scale-play:L${lvl.n}:${asciiTonicId(tonic)}:${idType}`,
    etudeId: 'scale-play',
    category: 'Play the scale',
    prompt: `Play the ${keyName} scale, ascending.`,
    choices: [],
    answerIndex: -1,
    level: lvl.n,
    scalePlay: {
      keyName,
      octaves: lvl.octaves,
      seconds: lvl.seconds,
      notes: voiceScaleAscending(seq),
      rh,
      lh,
    },
  }
}

function scalePlayQuestions(): Question[] {
  const out: Question[] = []
  for (const lvl of SCALE_PLAY_LEVELS) {
    for (const key of KEYS) {
      const root = key.majorTonic
      if (!lvl.majors.includes(noteToString(root))) continue
      out.push(
        scalePlayQuestion(
          lvl,
          root,
          majorScale(root),
          'major',
          `${noteToString(root)} major`,
          majorFingering(root, 'RH', lvl.octaves)!,
          majorFingering(root, 'LH', lvl.octaves)!
        )
      )
    }
    for (const key of KEYS) {
      const root = key.minorTonic
      if (!lvl.minors.includes(noteToString(root))) continue
      for (const type of SCALE_TYPES) {
        const name =
          type === 'natural'
            ? `${noteToString(root)} minor`
            : `${noteToString(root)} ${type} minor`
        out.push(
          scalePlayQuestion(
            lvl,
            root,
            minorScale(root, type),
            type,
            name,
            fingering(root, type, 'RH', lvl.octaves)!,
            fingering(root, type, 'LH', lvl.octaves)!
          )
        )
      }
    }
  }
  return out
}

/** All study questions, deterministic across runs. */
export function generateAllQuestions(): Question[] {
  return [
    ...relativeMinorQuestions(),
    ...scaleSpellingQuestions(),
    ...keySignatureQuestions(),
    ...chordDegreeQuestions(),
    ...chordRecognitionQuestions(),
    ...chordSpellingQuestions(),
    ...progressionQuestions(),
    ...intervalEarQuestions(),
    ...progressionEarQuestions(),
    ...melodicDictationQuestions(),
    ...rhythmDictationQuestions(),
    ...rhythmTapQuestions(),
    ...scalePlayQuestions(),
  ]
}
