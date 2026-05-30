/**
 * Shared module contracts — the single source of truth for the interfaces
 * that connect theory/, srs/, questions/, and components/.
 *
 * Each module implements the types/functions described here. Implementations
 * live in their own files; this file only declares the shared *types* so every
 * module agrees on the same shapes. Do not put logic here.
 */

// ---------------------------------------------------------------------------
// theory/  (pure music-theory domain)
// ---------------------------------------------------------------------------

/** The seven natural note letters. */
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * A spelled note: a letter plus an accidental offset in semitones.
 * accidental: -2 = double-flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double-sharp.
 * (Some harmonic/melodic minors require double-sharps, e.g. D# minor.)
 */
export interface Note {
  letter: Letter
  accidental: number
}

export type ScaleType = 'natural' | 'harmonic' | 'melodic'
export type Hand = 'RH' | 'LH'

/** A spelled note placed at a specific octave (C4 = middle C). */
export interface Voiced {
  note: Note
  octave: number
}

/** One of the 12 practical keys and its relative minor. */
export interface KeyDef {
  /** Tonic of the major key, e.g. { letter: 'E', accidental: -1 } for Eb. */
  majorTonic: Note
  /** Tonic of the relative minor, e.g. C for Eb major. */
  minorTonic: Note
  /** Display name of the major key, e.g. "E♭ major". */
  majorName: string
  /** Display name of the relative minor, e.g. "C minor". */
  minorName: string
}

// ---------------------------------------------------------------------------
// srs/  (spaced-repetition engine)
// ---------------------------------------------------------------------------

/** Per-item SM-2-lite scheduling state. */
export interface SrsState {
  /** Easiness factor (SM-2), starts at 2.5, floored at 1.3. */
  ease: number
  /** Current inter-repetition interval in days. */
  intervalDays: number
  /** Number of successful repetitions in a row. */
  reps: number
  /** Epoch ms when this item is next due. */
  dueAt: number
}

/** The full persisted blob (localStorage + JSON export/import). */
export interface SrsData {
  version: number
  /** Keyed by question id (see Question.id). */
  items: Record<string, SrsState>
}

// ---------------------------------------------------------------------------
// questions/  (question generation)
// ---------------------------------------------------------------------------

/** A study exercise — a named, selectable group of questions. */
export interface Etude {
  /** Stable id used to tag questions and select an étude, e.g. "scales". */
  id: string
  /** Section header this étude is grouped under, e.g. "Chords & Harmony". */
  section: string
  /**
   * Difficulty levels, lowest first (e.g. ["Easy","Medium","Hard"]). When set,
   * the étude screen shows a selector and scopes the session to questions whose
   * `level` (1-based) matches the chosen level.
   */
  levels?: string[]
  /** Display number, e.g. 1. */
  number: number
  /** Title, e.g. "Scales & Fingerings". */
  title: string
  /** One-line description shown in the étude menu. */
  subtitle: string
}

/**
 * Audible playback for a choice. `events` is a series played in order; each
 * event is the set of MIDI note numbers struck together. A scale is many
 * single-note events, a chord is one multi-note event, a progression is many
 * multi-note events. `kind` only drives timing in the player.
 */
export interface Playable {
  kind: 'chord' | 'scale' | 'progression'
  events: number[][]
}

/**
 * An ear-training prompt. The concrete pitches are realized from a random root
 * at play time (relative-pitch training), so only the relationship is stored.
 */
export type EarSpec =
  | { kind: 'interval'; semitones: number; letterSteps: number }
  | { kind: 'progression'; mode: 'major' | 'minor'; degrees: number[] }
  | { kind: 'melody'; mode: 'major' | 'minor'; degrees: number[] }
  | { kind: 'rhythm'; meter: TimeSig; tempo: number; pattern: RhythmEvent[] }

/** Supported time signatures for the rhythm-dictation étude. */
export type TimeSig = '4/4' | '3/4' | '6/8' | '2/4' | '12/8' | '5/4' | '2/2'

/** One event in a rhythm pattern (a note or a rest). */
export interface RhythmEvent {
  /** Base duration: whole, half, quarter, eighth, sixteenth, thirty-second. */
  dur: 'w' | 'h' | 'q' | '8' | '16' | '32'
  /** Number of augmentation dots (default 0). */
  dots?: number
  /** True for a rest. */
  rest?: boolean
  /**
   * Member of an eighth-note triplet: three consecutive `triplet` eighths fill
   * one beat (so each is ⅓ beat instead of ½), drawn beamed with a "3" bracket.
   */
  triplet?: boolean
  /** Tied to the next event (same pitch, durations combined and held). */
  tie?: boolean
}

/** A highlighted key on the reveal piano keyboard. */
export interface KeyMark {
  /** MIDI number of the physical key to light up (C4 = 60). */
  midi: number
  /** Optional text on the key — a finger number (the top number when paired). */
  label?: string
  /** Optional second finger number, drawn below `label` (e.g. LH under RH). */
  sublabel?: string
}

/** A single multiple-choice question. */
export interface Question {
  /**
   * Stable, deterministic id used as the SRS item key. MUST be identical across
   * sessions for the same logical question (e.g. "rel-minor:Eb",
   * "scale-notes:C:harmonic", "fingering:G:natural:RH").
   */
  id: string
  /** The id of the étude this question belongs to (see Etude.id). */
  etudeId: string
  /** Short category label for grouping/UI, e.g. "Relative minor". */
  category: string
  /** The question text shown to the user. */
  prompt: string
  /** Answer choices (display strings). Length 3–4. */
  choices: string[]
  /** Index into `choices` of the correct answer. */
  answerIndex: number
  /** Optional hover-to-play audio, keyed by choice display string. */
  audio?: Record<string, Playable>
  /** A memory tip (rule + worked example) shown when the answer is missed. */
  explanation?: string
  /** A short note always shown on reveal (e.g. a progression's style/genre). */
  caption?: string
  /** Present for ear-training questions: what to play (realized from a random root). */
  ear?: EarSpec
  /**
   * Precomputed piano-keyboard highlight shown on reveal (the scale/fingering/
   * chord études): which physical keys to light up, with optional per-key labels
   * (finger numbers, for fingering questions).
   */
  keyboard?: { marks: KeyMark[] }
  /**
   * Notes drawn on a staff: the voiced groups, the clef, and the key signature
   * to render them under. Shown as the *question* by default (chord-recognition
   * étude); set `onReveal` to instead show it with the answer (progressions).
   */
  notation?: {
    groups: Voiced[][]
    clef: 'treble' | 'bass'
    keySignature: string
    onReveal?: boolean
  }
  /** 1-based difficulty level, for études that define `levels` (else absent). */
  level?: number
  /**
   * One rhythm pattern per choice, aligned to `choices` (rhythm-dictation étude):
   * the choices are rendered as notation rather than text.
   */
  rhythmChoices?: RhythmEvent[][]
  /**
   * Circle-of-fifths highlight shown on reveal (relative-minor recall): the
   * major key (by display name) to highlight on the wheel, alongside its
   * relative minor.
   */
  circle?: { major: string }
  /**
   * Interactive "play the scale" étude: the student plays the scale ascending on
   * a keyboard (tap or MIDI). `notes` is the expected ascending sequence; `rh`/
   * `lh` are the per-note fingerings (aligned to `notes`); `seconds` is the
   * sudden-death budget. Present instead of the multiple-choice fields.
   */
  scalePlay?: {
    keyName: string
    octaves: 1 | 2
    seconds: number
    notes: Voiced[]
    rh: number[]
    lh: number[]
  }
}
