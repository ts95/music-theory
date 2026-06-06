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
      <span className="marking w-20 shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
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
    title: 'Scale formulas',
    body: (
      <div className="space-y-2">
        <Line label="Major">{mono('W–W–H–W–W–W–H')}</Line>
        <Line label="Natural">{mono('W–H–W–W–H–W–W')} — natural minor</Line>
        <Line label="Harmonic">natural minor with a raised 7th (leading tone)</Line>
        <Line label="Melodic">
          raised 6th &amp; 7th ascending; natural minor descending
        </Line>
        <p className="text-ink-3">
          Levels track ABRSM grades by key range — Easy ≤2 sharps/flats, widening
          to all 12 keys by Hard. <span className="text-ink-2">Expert</span> adds the
          Greek modes: Dorian, Phrygian, Lydian, Mixolydian, Locrian.
        </p>
        <p className="text-ink-3">
          One letter per scale degree — keep the accidentals consistent.
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
          {mono('LH')}). A few wrong notes are forgiven (Hard allows one, Easy and
          Medium two) — one past that ends the run and reveals the whole scale.
          It's sudden-death — beat the clock.
        </p>
        <p className="text-ink-3">
          Stuck? Tap <span className="text-ink">show fingering</span> to flash the
          whole scale's finger numbers for 3 seconds (any key hides them sooner).
          Peeking counts the exercise as failed — it'll resurface sooner.
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
  'chord-spelling': {
    title: 'Spelling chords',
    body: (
      <div className="space-y-2">
        <p>
          Read the root from the letter, then the suffix for the quality. Stack
          the right 3rd, 5th (and 7th/9th) above it — one note letter per tone.
        </p>
        <Legend items={[...CHORD_SYMS, ['9', 'dom 9'], ['maj9', 'major 9'], ['m9', 'minor 9']]} />
        <p className="text-ink-3">
          e.g. {mono('Cm7')} = {mono('C – E♭ – G – B♭')} (minor 3rd, perfect 5th,
          minor 7th).
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
  'rhythm-tap': {
    title: 'How to tap it',
    body: (
      <div className="space-y-2">
        <p>
          Read the rhythm, then perform it. A <span className="text-ink">count-in</span>{' '}
          sets the tempo first, counting the beats <span className="text-accent">1·2·3·4</span>;
          the same steady metronome then carries on under your bar. The instant the
          staff flashes <span style={{ color: '#2f6b4e' }}>green</span> is your cue
          to start.
        </p>
        <p>
          Before you begin, the syllables under each note show <span className="text-ink">how to
          count it</span> — switch between <span className="text-ink">Traditional</span> (numbers,
          &amp;, e/a) and <span className="text-ink">Kodály</span> (ta, ti, ti-ka) with the toggle.
        </p>
        <p>
          <span className="text-ink">Press and hold</span> each note with{' '}
          <span className="text-ink">Space</span>, by pressing the staff, or with{' '}
          <span className="text-ink">any key of a MIDI keyboard</span> (the pitch
          doesn't matter — only the rhythm) — hold for most of its length
          (<span className="text-ink">~70%</span>, or just ~40% for quick notes —
          sixteenths, thirty-seconds, triplets), so a note is sustained, not just
          clipped. Release, then press the next note. Rests are silent — don't tap
          them.
        </p>
        <p>
          You're scored on timing accuracy — it's forgiving, so a little early or
          late still counts as 100% (a flat ~200 ms window for every note). The
          result colours each note{' '}
          <span style={{ color: '#2f6b4e' }}>on the beat</span> /{' '}
          <span style={{ color: '#b08d57' }}>a little off</span> /{' '}
          <span style={{ color: '#bb4430' }}>missed or held too short</span>, and{' '}
          <span className="text-ink">Hear it</span> plays the rhythm back.
        </p>
        <p>
          As an aid, the note head you're about to play{' '}
          <span style={{ color: '#7a2540' }}>lights up</span> during the count-in
          (a silent preview) and when you press <span className="text-ink">Hear
          it</span> — never while you're tapping. The <span className="text-ink">timing
          bars</span> below the staff (your taps against the target) can be hidden
          with the <span className="text-ink">Bars</span> toggle to practise with
          less assistance.
        </p>
        <p className="text-ink-3">
          <span className="text-ink">Try again</span> is a practice run — your
          first attempt is the one that counts, so a retry can't turn a miss into a
          pass. Same metres and levels as Rhythm Dictation — the tempo rises with
          the level.
        </p>
      </div>
    ),
  },
}

export function etudeReference(etudeId: string): EtudeReference | null {
  const r = REFERENCES[etudeId]
  return r ? { defaultOpen: true, ...r } : null
}
