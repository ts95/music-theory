import { useEffect } from 'react'
import { INTERVAL_SONGS, intervalSongBySemitones } from '../intervalSongs'
import type { IntervalSong } from '../intervalSongs'
import { voicedMidi } from '../theory'
import { playEar, stop, isMuted } from '../audio/player'
import Staff from './Staff'

interface Props {
  /** null → the index; a number → that interval's song page. */
  semitones: number | null
  onNavigate: (route: string | null) => void
}

const route = (s: number) => `interval-songs/${s}`

export default function IntervalSongs({ semitones, onNavigate }: Props) {
  const song = semitones === null ? null : intervalSongBySemitones(semitones)
  return song ? (
    <SongPage song={song} onNavigate={onNavigate} />
  ) : (
    <IndexPage onNavigate={onNavigate} />
  )
}

function IndexPage({ onNavigate }: { onNavigate: Props['onNavigate'] }) {
  return (
    <>
      <header className="mb-9">
        <button
          type="button"
          onClick={() => onNavigate('intervals-ear')}
          className="marking rise text-ink-3 transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          ← Intervals by Ear
        </button>
        <div className="rise mt-4">
          <p className="marking text-accent">Training wheels</p>
          <h1 className="mt-2 font-display text-[2.75rem] font-medium leading-[0.95] tracking-[-0.02em] text-ink sm:text-5xl">
            Interval <span className="italic">Songs</span>
          </h1>
          <p className="mt-2 text-ink-2">
            A familiar tune for every interval — recall the melody to name the
            sound you hear.
          </p>
        </div>
        <div className="rise staff-rule mt-6" style={{ animationDelay: '80ms' }} />
      </header>

      <main className="rise" style={{ animationDelay: '160ms' }}>
        <ul className="space-y-3">
          {INTERVAL_SONGS.map((s, i) => (
            <li
              key={s.semitones}
              className="rise"
              style={{ animationDelay: `${180 + i * 40}ms` }}
            >
              <button
                type="button"
                onClick={() => onNavigate(route(s.semitones))}
                className="group flex w-full items-center gap-5 rounded-2xl border border-rule bg-card px-5 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-paper hover:ring-1 hover:ring-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:px-7"
              >
                <span className="w-12 shrink-0 font-mono text-lg text-accent">
                  {s.name}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-medium text-ink">
                    {s.full}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-2">{s.song}</span>
                </span>
                <span className="marking shrink-0 text-ink-3 transition-colors group-hover:text-ink">
                  hear it →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}

function SongPage({
  song,
  onNavigate,
}: {
  song: IntervalSong
  onNavigate: Props['onNavigate']
}) {
  // Hover (or tap) the staff to hear the phrase, played note-by-note.
  const melody = song.notes.map((n) => [voicedMidi(n)])
  const playMelody = () => playEar([], melody, 'melodic')

  // Stop audio when leaving the page or switching intervals.
  useEffect(() => () => stop(), [song.semitones])

  return (
    <>
      <header className="mb-9">
        <button
          type="button"
          onClick={() => onNavigate('interval-songs')}
          className="marking rise text-ink-3 transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          ← All intervals
        </button>
        <div className="rise mt-4">
          <p className="marking text-accent">
            {song.full} · {song.semitones} semitones
          </p>
          <h1 className="mt-2 font-display text-[2.4rem] font-medium leading-[1] tracking-[-0.02em] text-ink sm:text-[2.75rem]">
            {song.song}
          </h1>
        </div>
        <div className="rise staff-rule mt-6" style={{ animationDelay: '80ms' }} />
      </header>

      <main className="rise space-y-6" style={{ animationDelay: '160ms' }}>
        <div
          onMouseEnter={playMelody}
          onClick={playMelody}
          className="cursor-pointer rounded-2xl border border-rule bg-card px-4 py-3"
          title="Play the melody"
        >
          <Staff
            groups={song.notes.map((n) => [n])}
            labels={song.labels}
            highlight={song.leap}
          />
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                playMelody()
              }}
              className="marking text-accent transition-colors hover:text-ink"
            >
              ▶ play melody
            </button>
            <span className="marking text-ink-3">tap or hover the staff to hear it</span>
            {isMuted() && <span className="marking text-wrong">♪ sound is off</span>}
          </div>
        </div>

        <p className="leading-relaxed text-ink-2">{song.blurb}</p>

        <p className="border-t border-rule pt-4 text-sm text-ink-3">
          When you hear an interval and aren’t sure, sing the start of this tune
          from the lower note — if the leap lands where “{leapWords(song)}” does,
          that’s a {song.full.toLowerCase()}.
        </p>

        <nav className="flex flex-wrap gap-2 pt-2">
          {INTERVAL_SONGS.map((s) => {
            const active = s.semitones === song.semitones
            return (
              <button
                key={s.semitones}
                type="button"
                onClick={() => onNavigate(route(s.semitones))}
                aria-current={active}
                className={`rounded-full px-3 py-1 font-mono text-sm transition-colors ${
                  active
                    ? 'bg-ink text-paper'
                    : 'border border-rule text-ink-2 hover:text-ink'
                }`}
              >
                {s.name}
              </button>
            )
          })}
        </nav>
      </main>
    </>
  )
}

/** The two leap syllables, for the prose hint (falls back to the note names). */
function leapWords(song: IntervalSong): string {
  const [a, b] = song.leap
  if (song.labels) return `${song.labels[a]} → ${song.labels[b]}`.replace(/-/g, '')
  return 'the leap'
}
