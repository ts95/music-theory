import type { Etude } from '../contracts'

/** The selectable study exercises, in display order. */
export const ETUDES: Etude[] = [
  {
    id: 'keys',
    number: 1,
    title: 'Keys & Relative Minors',
    subtitle: 'Relative minors, scale spellings & piano fingerings',
  },
  {
    id: 'chords',
    number: 2,
    title: 'Chords by Degree',
    subtitle: 'Diatonic triads (and V7) in every major & minor key',
  },
  {
    id: 'progressions',
    number: 3,
    title: 'Progressions',
    subtitle: 'Roman-numeral progressions → concrete chords',
  },
  {
    id: 'intervals-ear',
    number: 4,
    title: 'Intervals by Ear',
    subtitle: 'Hear an interval and name it — relative-pitch training',
  },
  {
    id: 'progressions-ear',
    number: 5,
    title: 'Progressions by Ear',
    subtitle: 'Hear a progression over its tonic and name it',
  },
]
