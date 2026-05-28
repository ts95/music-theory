import type { Note } from '../contracts'
import { pitchClass } from './notes'
import { QUALITY_INTERVALS, type Chord, type Quality } from './chords'

/**
 * MIDI note number for a spelled note at a given octave (C4 = 60).
 * Enharmonics/double accidentals collapse to pitch class — fine for playback.
 */
export function noteMidi(note: Note, octave = 4): number {
  return 12 * (octave + 1) + pitchClass(note)
}

/**
 * A scale as one single-note event per note, octave-bumped so the line ascends
 * even when the pitch class wraps (e.g. B → C goes up, not down).
 */
export function scaleEvents(notes: Note[], octave = 4): number[][] {
  const events: number[][] = []
  let prev = -Infinity
  for (const note of notes) {
    let midi = noteMidi(note, octave)
    while (midi <= prev) midi += 12
    events.push([midi])
    prev = midi
  }
  return events
}

/** Voice a chord ascending from the root, returning the MIDI notes. */
function voiceChord(root: Note, quality: Quality, octave: number): number[] {
  const base = noteMidi(root, octave)
  return QUALITY_INTERVALS[quality].map((semitones) => base + semitones)
}

/** A chord as a single block event. */
export function chordEvents(
  root: Note,
  quality: Quality,
  octave = 4
): number[][] {
  return [voiceChord(root, quality, octave)]
}

/** A progression as one block event per chord, played in series. */
export function progressionEvents(chords: Chord[], octave = 4): number[][] {
  return chords.map((c) => voiceChord(c.root, c.quality, octave))
}
