import type { EarSpec, Letter, Note } from '../contracts'
import { noteToString } from './notes'
import { noteMidi } from './midi'
import {
  QUALITY_INTERVALS,
  diatonicTriads,
  romanToChord,
  type Chord,
  type Mode,
} from './chords'
import { KEYS } from './keys'

/**
 * Realizes an ear-training spec into concrete pitches from a chosen root, used
 * for both playback (MIDI via noteMidi) and notation (the same voiced notes fed
 * to VexFlow), so sound and staff always agree. Pure — the random root is
 * chosen by the caller, keeping the question bank deterministic.
 */

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** A note placed in a specific octave (C4 = middle C). */
export interface Voiced {
  note: Note
  octave: number
}

export const voicedMidi = (v: Voiced): number => noteMidi(v.note, v.octave)

/**
 * Spell the note `letterSteps` letters and `semitones` above `root`, choosing
 * the accidental so the pitch lands exactly `semitones` higher. Octave-aware.
 */
function spellAbove(root: Voiced, letterSteps: number, semitones: number): Voiced {
  const idx = LETTERS.indexOf(root.note.letter) + letterSteps
  const letter = LETTERS[((idx % 7) + 7) % 7]
  const octave = root.octave + Math.floor(idx / 7)
  const targetMidi = voicedMidi(root) + semitones
  const naturalMidi = noteMidi({ letter, accidental: 0 }, octave)
  return { note: { letter, accidental: targetMidi - naturalMidi }, octave }
}

const CHORD_TONE_STEPS = [0, 2, 4, 6]

/** Voice a chord upward from its root at `octave`: root, 3rd, 5th, (7th). */
function voiceChord(chord: Chord, octave: number): Voiced[] {
  const root: Voiced = { note: chord.root, octave }
  return QUALITY_INTERVALS[chord.quality].map((semitones, i) =>
    i === 0 ? root : spellAbove(root, CHORD_TONE_STEPS[i], semitones)
  )
}

export interface RealizedEar {
  /** The anchor played first: the interval's lower note / the tonic triad. */
  reference: Voiced[][]
  /** The events to identify: [lower],[upper] (melodic) / the block chords. */
  target: Voiced[][]
  style: 'melodic' | 'block'
}

/** Realize an ear prompt from a chosen root/tonic. */
export function realizeEar(spec: EarSpec, root: Voiced): RealizedEar {
  if (spec.kind === 'interval') {
    const upper = spellAbove(root, spec.letterSteps, spec.semitones)
    return { reference: [[root]], target: [[root], [upper]], style: 'melodic' }
  }
  const tonic = root.note
  const reference = [voiceChord(diatonicTriads(tonic, spec.mode)[0], root.octave)]
  const target = spec.degrees.map((d) =>
    voiceChord(romanToChord(tonic, spec.mode, d, false), root.octave)
  )
  return { reference, target, style: 'block' }
}

/** Natural roots (octave 4) for interval prompts — no double accidentals. */
export const INTERVAL_ROOTS: Voiced[] = LETTERS.map((letter) => ({
  note: { letter, accidental: 0 },
  octave: 4,
}))

/**
 * Tonics (octave 4) for progression prompts. Minor excludes G♯/D♯ — their
 * harmonic-minor V/vii° need double sharps that clutter the staff.
 */
export function progressionTonics(mode: Mode): Voiced[] {
  return KEYS.map((k) => (mode === 'major' ? k.majorTonic : k.minorTonic))
    .filter((t) => !(mode === 'minor' && ['G♯', 'D♯'].includes(noteToString(t))))
    .map((note) => ({ note, octave: 4 }))
}
