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

/** A single multiple-choice question. */
export interface Question {
  /**
   * Stable, deterministic id used as the SRS item key. MUST be identical across
   * sessions for the same logical question (e.g. "rel-minor:Eb",
   * "scale-notes:C:harmonic", "fingering:G:natural:RH").
   */
  id: string
  /** Short category label for grouping/UI, e.g. "Relative minor". */
  category: string
  /** The question text shown to the user. */
  prompt: string
  /** Answer choices (display strings). Length 3–4. */
  choices: string[]
  /** Index into `choices` of the correct answer. */
  answerIndex: number
}
