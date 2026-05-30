import type { Letter } from './contracts'
import type { Voiced } from './theory'

/**
 * Reference songs for the ascending intervals: a familiar tune whose opening
 * leap *is* that interval, so you can recall the melody to recognise the sound.
 * Each entry carries the actual notes (for staff + playback) and the index pair
 * of the two notes that form the interval. Songs were chosen to be familiar to
 * the (Norwegian) user and the note contours verified against trusted sources.
 * Keep the leap's semitone span equal to `semitones` (the intervalSongs test
 * enforces this).
 */

export interface IntervalSong {
  /** Semitone span — also the URL segment (interval-songs/<semitones>). */
  semitones: number
  /** Short token, matching the étude/info-box names (m2 … 8ve). */
  name: string
  /** Spelled-out name. */
  full: string
  song: string
  notes: Voiced[]
  /** Lyric syllable under each note (omit for instrumental tunes). */
  labels?: string[]
  /** Indices into `notes` of the two notes that form the interval. */
  leap: [number, number]
  /** How to use the tune as a memory hook. */
  blurb: string
}

const ACCIDENTAL: Record<string, number> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 }

/** Parse a pitch like "Eb4", "F#5", "C4" into a Voiced note. */
function v(spec: string): Voiced {
  const m = /^([A-G])(bb|b|#|##|)(\d)$/.exec(spec)!
  return {
    note: { letter: m[1] as Letter, accidental: ACCIDENTAL[m[2]] },
    octave: Number(m[3]),
  }
}

const vs = (specs: string): Voiced[] => specs.split(' ').map(v)

export const INTERVAL_SONGS: IntervalSong[] = [
  {
    semitones: 1,
    name: 'm2',
    full: 'Minor 2nd',
    song: 'Jaws (theme)',
    notes: vs('E4 F4 E4 F4'),
    leap: [0, 1],
    blurb:
      'The shark closing in — just two notes a semitone apart, the tightest step there is. Hum the “dun… dun…” and you have a minor second.',
  },
  {
    semitones: 2,
    name: 'M2',
    full: 'Major 2nd',
    song: 'Happy Birthday',
    notes: vs('G4 G4 A4 G4'),
    labels: ['Hap', 'py', 'Birth', 'day'],
    leap: [1, 2],
    blurb:
      '“Happy BIRTH-day”: the rise from “py” up to “Birth” is a single whole step — a major second.',
  },
  {
    semitones: 3,
    name: 'm3',
    full: 'Minor 3rd',
    song: 'Smoke on the Water',
    notes: vs('G4 Bb4 C5'),
    leap: [0, 1],
    blurb:
      'Deep Purple’s riff opens by jumping straight up a minor third (G → B♭) before the B♭ → C whole step.',
  },
  {
    semitones: 4,
    name: 'M3',
    full: 'Major 3rd',
    song: 'When the Saints Go Marching In',
    notes: vs('C4 E4 F4 G4'),
    labels: ['Oh', 'when', 'the', 'saints'],
    leap: [0, 1],
    blurb:
      '“Oh (C), when (E)…” — that bright opening leap up to “when” is a major third.',
  },
  {
    semitones: 5,
    name: 'P4',
    full: 'Perfect 4th',
    song: 'Auld Lang Syne',
    notes: vs('G4 C5 C5 E5'),
    labels: ['Should', 'auld', 'ac-', 'quain-'],
    leap: [0, 1],
    blurb:
      'The New Year’s pickup “Should auld…” lifts from “Should” (G) up to “auld” (C) — a perfect fourth.',
  },
  {
    semitones: 6,
    name: 'TT',
    full: 'Tritone',
    song: 'The Simpsons (theme)',
    notes: vs('C4 F#4 A4'),
    labels: ['The', 'Simp-', 'sons'],
    leap: [0, 1],
    blurb:
      '“The Simp-sons!” — the uneasy jump from “The” up to “Simp” spans three whole tones: the tritone.',
  },
  {
    semitones: 7,
    name: 'P5',
    full: 'Perfect 5th',
    song: 'Twinkle, Twinkle, Little Star',
    notes: vs('C4 C4 G4 G4'),
    labels: ['Twin', 'kle', 'twin', 'kle'],
    leap: [1, 2],
    blurb:
      '“Twinkle, TWINKLE”: the leap onto the second “twinkle” is a perfect fifth — the most open, stable jump.',
  },
  {
    semitones: 8,
    name: 'm6',
    full: 'Minor 6th',
    song: 'The Entertainer',
    notes: vs('E4 C5 E4 C5'),
    leap: [0, 1],
    blurb:
      'Joplin’s rag keeps springing up a minor sixth — from the low note up to the accented high one (E → C) — three times in a row.',
  },
  {
    semitones: 9,
    name: 'M6',
    full: 'Major 6th',
    song: 'Hush, Little Baby',
    notes: vs('G4 E5'),
    labels: ['Hush…', 'ba-by'],
    leap: [0, 1],
    blurb:
      'The lullaby reaches up from “Hush” to “baby” — sol up to mi — a warm major sixth, a semitone wider than the minor sixth.',
  },
  {
    semitones: 10,
    name: 'm7',
    full: 'Minor 7th',
    song: 'The Winner Takes It All (ABBA)',
    notes: vs('D4 C5 Bb4'),
    labels: ['The', 'win-', 'ner'],
    leap: [0, 1],
    blurb:
      'ABBA’s chorus throws “The” up to “win-” — a yearning minor seventh — then sighs back down a step.',
  },
  {
    semitones: 11,
    name: 'M7',
    full: 'Major 7th',
    song: 'Take On Me (a-ha)',
    notes: vs('A4 G#5 A5'),
    labels: ['Take', 'on', 'me'],
    leap: [0, 1],
    blurb:
      'a-ha’s hook leaps “Take” up to “on” — a major seventh, just a semitone shy of the octave — before “me” completes the octave.',
  },
  {
    semitones: 12,
    name: '8ve',
    full: 'Octave',
    song: 'Over the Rainbow',
    notes: vs('C4 C5 A4 B4'),
    labels: ['Some-', 'where', 'o-', 'ver'],
    leap: [0, 1],
    blurb:
      '“Some-WHERE” jumps a full octave — the very same note name, eight steps higher.',
  },
]

export function intervalSongBySemitones(semitones: number): IntervalSong | null {
  return INTERVAL_SONGS.find((s) => s.semitones === semitones) ?? null
}
