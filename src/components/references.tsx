import type { ReactNode } from 'react'
import { solfege } from '../theory'
import type { Mode } from '../theory'

/**
 * Per-étude reference content shown in a collapsible InfoBox on the étude screen.
 * Add an entry to REFERENCES to give an étude a permanent context box. Keep the
 * symbols/labels in sync with the generators (chords.ts QUALITY_SUFFIX,
 * explanations.ts TRIAD_PATTERN, generators.ts INTERVALS).
 */

export interface EtudeReference {
  title: string
  body: ReactNode
  defaultOpen?: boolean
  /** Optional link to a related reference page (navigated by route). */
  link?: { label: string; route: string }
}

// ── shared bits ──────────────────────────────────────────────────────────────
const mono = (s: string) => <span className="font-mono text-ink">{s}</span>

/** A labelled line: small-caps label + content. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="marking w-16 shrink-0 text-ink-3">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  )
}

/** A wrapped "symbol — meaning" legend. */
function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(([s, w]) => (
        <span key={s}>
          {mono(s)} <span className="text-ink-3">{w}</span>
        </span>
      ))}
    </div>
  )
}

/** A solfège ladder (degrees 1–7) for a mode, with degree numbers. */
function Ladder({ mode }: { mode: Mode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-ink">
      {[0, 1, 2, 3, 4, 5, 6].map((d) => (
        <span key={d}>
          {solfege(mode, d)}
          <span className="ml-0.5 align-super text-[0.7em] text-ink-3">{d + 1}</span>
        </span>
      ))}
    </div>
  )
}

const CHORD_SYMS: [string, string][] = [
  ['m', 'minor'],
  ['°', 'dim'],
  ['+', 'aug'],
  ['7', 'dom 7'],
  ['maj7', 'major 7'],
  ['m7', 'minor 7'],
  ['ø7', 'half-dim'],
  ['°7', 'dim 7'],
]

const NUMERALS: [string, string][] = [
  ['I', 'major'],
  ['i', 'minor'],
  ['°', 'diminished'],
  ['7', 'seventh'],
]

// Intervals grouped by consonance (semitones). P4 is treated as a (perfect)
// consonance here; the tritone is the sharpest dissonance.
const CONSONANT: [string, number][] = [
  ['m3', 3],
  ['M3', 4],
  ['P4', 5],
  ['P5', 7],
  ['m6', 8],
  ['M6', 9],
  ['8ve', 12],
]
const DISSONANT: [string, number][] = [
  ['m2', 1],
  ['M2', 2],
  ['TT', 6],
  ['m7', 10],
  ['M7', 11],
]

/** A row of "name semitones" interval tokens. */
function IntervalRow({ items }: { items: [string, number][] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
      {items.map(([n, s]) => (
        <span key={n}>
          <span className="text-ink">{n}</span>{' '}
          <span className="text-ink-3">{s}</span>
        </span>
      ))}
    </div>
  )
}

const DURATIONS: [string, string][] = [
  ['whole', '4'],
  ['half', '2'],
  ['quarter', '1'],
  ['eighth', '½'],
  ['16th', '¼'],
  ['32nd', '⅛'],
]

// ── registry ─────────────────────────────────────────────────────────────────
const REFERENCES: Record<string, EtudeReference> = {
  'relative-minors': {
    title: 'Relative keys',
    body: (
      <div className="space-y-2">
        <p>
          The relative minor is the 6th degree of the major scale — a minor 3rd
          (3 semitones) below the tonic.
        </p>
        <p>
          Relatives share a key signature, e.g. {mono('C major')} ↔{' '}
          {mono('A minor')}; the minor scale just starts on that 6th note.
        </p>
      </div>
    ),
  },
  scales: {
    title: 'Minor-scale formulas',
    body: (
      <div className="space-y-2">
        <Line label="Natural">{mono('W–H–W–W–H–W–W')}</Line>
        <Line label="Harmonic">natural minor with a raised 7th (leading tone)</Line>
        <Line label="Melodic">
          raised 6th &amp; 7th ascending; natural minor descending
        </Line>
        <p className="text-ink-3">
          One letter per scale degree — keep the accidentals consistent.
        </p>
      </div>
    ),
  },
  fingerings: {
    title: 'Fingering rules',
    body: (
      <div className="space-y-2">
        <p>
          {mono('1')} = thumb … {mono('5')} = pinky. Each answer gives both hands,
          RH over LH.
        </p>
        <p>
          The thumb ({mono('1')}) never plays a black key — that fixes where it
          tucks under (RH) and where the 3rd finger crosses over (LH). A wide gap
          in the numbers marks each of those shifts.
        </p>
        <p className="text-ink-3">
          Two octaves; drill hands separately until the crossing is automatic.
        </p>
      </div>
    ),
  },
  'scale-play': {
    title: 'How to play it',
    body: (
      <div className="space-y-2">
        <p>
          Play the named scale ascending — tap the keys, or strike a connected
          MIDI keyboard (any octave works). Start on the tonic and go up.
        </p>
        <p>
          Each correct note lights up with its fingering ({mono('RH')} over{' '}
          {mono('LH')}). A wrong (non-diatonic) note ends the run and reveals the
          whole scale. It's sudden-death — beat the clock.
        </p>
      </div>
    ),
  },
  chords: {
    title: 'Diatonic triads',
    body: (
      <div className="space-y-2">
        <Line label="Major">{mono('I ii iii IV V vi vii°')}</Line>
        <Line label="Minor">{mono('i ii° III iv V VI vii°')}</Line>
        <p className="text-ink-3">Minor’s V and vii° use the raised leading tone.</p>
        <Legend items={CHORD_SYMS} />
      </div>
    ),
  },
  'chord-recognition': {
    title: 'Reading chords',
    body: (
      <div className="space-y-2">
        <p>
          Re-stack the notes in thirds to find the root; read the 3rd &amp; 5th
          (plus any 7th/9th) for the quality; the lowest note gives the inversion.
        </p>
        <Legend items={[...CHORD_SYMS, ['9', 'dom 9'], ['maj9', 'major 9'], ['m9', 'minor 9']]} />
        <p className="text-ink-3">
          A slash, e.g. {mono('C/E')}, names the bass note — the inversion.
        </p>
      </div>
    ),
  },
  progressions: {
    title: 'Roman numerals',
    body: (
      <div className="space-y-2">
        <Legend items={NUMERALS} />
        <p className="text-ink-3">
          Numerals are built on the scale degrees, e.g. {mono('ii–V–I')}.
        </p>
      </div>
    ),
  },
  'intervals-ear': {
    title: 'Intervals (semitones)',
    body: (
      <div className="space-y-3">
        <div>
          <p className="marking mb-1 text-correct">Consonant — stable, restful</p>
          <IntervalRow items={CONSONANT} />
        </div>
        <div>
          <p className="marking mb-1 text-wrong">Dissonant — tense, wants to resolve</p>
          <IntervalRow items={DISSONANT} />
        </div>
        <p className="text-ink-3">
          The tritone (TT) is the sharpest dissonance. The lower note plays first
          — count up from it.
        </p>
      </div>
    ),
    link: { label: 'Songs to hear each interval →', route: 'interval-songs' },
  },
  'progressions-ear': {
    title: 'Roman numerals',
    body: (
      <div className="space-y-2">
        <Legend items={NUMERALS} />
        <p className="text-ink-3">
          The first chord you hear is the tonic — judge each chord relative to it.
        </p>
      </div>
    ),
  },
  'melodic-dictation': {
    title: 'Solfège reference',
    body: (
      <div className="space-y-3">
        <div>
          <p className="marking mb-1 text-ink-3">Major</p>
          <Ladder mode="major" />
        </div>
        <div>
          <p className="marking mb-1 text-ink-3">Minor (natural)</p>
          <Ladder mode="minor" />
        </div>
        <p className="text-ink-3">
          Movable do — {mono('do')} is the tonic of whatever key plays; minor
          lowers the 3rd, 6th &amp; 7th (me, le, te).
        </p>
      </div>
    ),
  },
  'rhythm-dictation': {
    title: 'Note values & metre',
    body: (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {DURATIONS.map(([name, beats]) => (
            <span key={name}>
              <span className="text-ink">{name}</span>{' '}
              <span className="text-ink-3">{beats}</span>
            </span>
          ))}
          <span className="text-ink-3">beats</span>
        </div>
        <p className="text-ink-3">
          A dot adds half; a triplet = three in the time of two; a tie holds across.
        </p>
        <Line label="Easy">
          {mono('4/4')} · {mono('3/4')} · {mono('2/4')}
        </Line>
        <Line label="Medium">
          adds {mono('6/8')} · {mono('₵')} cut time · {mono('12/8')}
        </Line>
        <Line label="Hard">
          adds {mono('5/4')} (felt 3+2)
        </Line>
        <p className="text-ink-3">
          Each level keeps the earlier metres. The count-in clicks set the tempo
          and metre.
        </p>
      </div>
    ),
  },
}

export function etudeReference(etudeId: string): EtudeReference | null {
  const r = REFERENCES[etudeId]
  return r ? { defaultOpen: true, ...r } : null
}
