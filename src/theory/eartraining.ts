import type { EarSpec, Letter, Note, Voiced } from '../contracts'
import { noteToString } from './notes'
import { noteMidi } from './midi'
import {
  QUALITY_INTERVALS,
  diatonicTriads,
  romanToChord,
  type Chord,
  type Mode,
  type Quality,
} from './chords'
import { majorScale, minorScale } from './scales'
import { KEYS } from './keys'

const MAJOR_SOLFEGE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti', 'do']
const MINOR_SOLFEGE = ['do', 're', 'me', 'fa', 'sol', 'le', 'te', 'do']

/** Do-based movable solfège for a scale degree (0 = tonic … 7 = octave). */
export function solfege(mode: Mode, degree: number): string {
  return (mode === 'major' ? MAJOR_SOLFEGE : MINOR_SOLFEGE)[degree]
}

export type { Voiced }

/**
 * Realizes an ear-training spec into concrete pitches from a chosen root, used
 * for both playback (MIDI via noteMidi) and notation (the same voiced notes fed
 * to VexFlow), so sound and staff always agree. Pure — the random root is
 * chosen by the caller, keeping the question bank deterministic.
 */

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

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

/** Spell a chord upward from a voiced root: root, 3rd, 5th, (7th). */
function spellChordFrom(root: Voiced, quality: Quality): Voiced[] {
  return QUALITY_INTERVALS[quality].map((semitones, i) =>
    i === 0 ? root : spellAbove(root, CHORD_TONE_STEPS[i], semitones)
  )
}

/**
 * Voice a chord with its root placed in the one-octave band at/above `tonic`, so
 * successive chords in a progression stay in a tidy register instead of leaping
 * (and diving below the staff) by where their root letter happens to fall.
 */
function voiceChord(chord: Chord, tonic: Voiced): Voiced[] {
  let root: Voiced = { note: chord.root, octave: tonic.octave }
  if (voicedMidi(root) < voicedMidi(tonic)) {
    root = { ...root, octave: root.octave + 1 }
  }
  return spellChordFrom(root, chord.quality)
}

/** Voice a single chord in root position from `octave` (for notation/display). */
export function voiceChordRootPosition(chord: Chord, octave = 4): Voiced[] {
  return spellChordFrom({ note: chord.root, octave }, chord.quality)
}

/**
 * Voice a scale's notes ascending from `octave`, bumping the octave whenever the
 * pitch class wraps (so B → C rises, and a repeated tonic lands an octave up),
 * for notation/display.
 */
export function voiceScaleAscending(notes: Note[], octave = 4): Voiced[] {
  const out: Voiced[] = []
  let prevMidi = -Infinity
  let oct = octave
  for (const note of notes) {
    let v: Voiced = { note, octave: oct }
    while (voicedMidi(v) <= prevMidi) {
      oct += 1
      v = { note, octave: oct }
    }
    out.push(v)
    prevMidi = voicedMidi(v)
  }
  return out
}

export interface RealizedEar {
  /** The anchor played first: the interval's lower note / the tonic triad. */
  reference: Voiced[][]
  /** The events to identify: [lower],[upper] (melodic) / the block chords. */
  target: Voiced[][]
  style: 'melodic' | 'block'
}

/** Realize a pitched ear prompt from a chosen root/tonic. */
export function realizeEar(spec: EarSpec, root: Voiced): RealizedEar {
  if (spec.kind === 'interval') {
    const upper = spellAbove(root, spec.letterSteps, spec.semitones)
    return { reference: [[root]], target: [[root], [upper]], style: 'melodic' }
  }
  if (spec.kind === 'rhythm') {
    throw new Error('realizeEar: rhythm prompts have no pitch realization')
  }
  // melody and progression both build from the tonic's scale.
  const tonic = root.note
  const reference = [voiceChord(diatonicTriads(tonic, spec.mode)[0], root)]
  if (spec.kind === 'melody') {
    // One-octave scale (tonic..octave), voiced ascending, indexed by degree.
    const scale = spec.mode === 'major' ? majorScale(tonic) : minorScale(tonic, 'natural')
    const scale8 = voiceScaleAscending([...scale, scale[0]], root.octave)
    const target = spec.degrees.map((d) => [scale8[d]])
    return { reference, target, style: 'melodic' }
  }
  const target = spec.degrees.map((d) =>
    voiceChord(romanToChord(tonic, spec.mode, d, false), root)
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
