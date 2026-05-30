import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyMark, Question } from '../contracts'
import { voicedMidi } from '../theory'
import { isMuted, playNote } from '../audio/player'
import { useMidiInput } from '../midi'
import PianoKeyboard from './PianoKeyboard'
import Button from './Button'

/**
 * Interactive "Play the Scale" étude. Show a key; the student plays it ascending
 * on the keyboard (tap/click or MIDI). Each correct note lights with its RH+LH
 * fingering; the first wrong (non-diatonic) note — or the sudden-death timer
 * running out — fails and reveals the full scale. Matching is positional by
 * pitch class, so a MIDI keyboard in any octave works.
 */

interface ScalePlayCardProps {
  question: Question
  onResolve: (passed: boolean) => void
  onNext: () => void
}

const mod = (n: number, m: number) => ((n % m) + m) % m

export default function ScalePlayCard({
  question,
  onResolve,
  onNext,
}: ScalePlayCardProps) {
  const sp = question.scalePlay!
  const midis = useMemo(() => sp.notes.map(voicedMidi), [sp])
  const pcs = useMemo(() => midis.map((m) => mod(m, 12)), [midis])
  // Fixed keyboard range spanning the scale (so it doesn't resize as keys light).
  const range = useMemo(() => {
    const lo = Math.min(...midis)
    const hi = Math.max(...midis)
    const from = lo - mod(lo, 12)
    const top = hi + mod(-hi, 12)
    return { from, octaves: Math.max(1, (top - from) / 12) as number }
  }, [midis])

  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<'playing' | 'passed' | 'failed'>('playing')
  const [remaining, setRemaining] = useState(sp.seconds * 1000)
  const [pressed, setPressed] = useState<number | null>(null)
  const resolved = useRef(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      if (pressTimer.current) clearTimeout(pressTimer.current)
    },
    []
  )

  const finish = (passed: boolean) => {
    if (resolved.current) return
    resolved.current = true
    setStatus(passed ? 'passed' : 'failed')
    onResolve(passed)
  }

  const handleNote = (midi: number) => {
    if (resolved.current) return
    playNote(midi)
    // Momentary depress cue (clears shortly after the strike).
    setPressed(midi)
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPressed(null), 150)
    if (mod(midi, 12) === pcs[index]) {
      const next = index + 1
      setIndex(next)
      if (next >= sp.notes.length) finish(true)
    } else {
      finish(false)
    }
  }
  // Stable callback for the MIDI listener (avoids re-subscribing each render).
  const handleRef = useRef(handleNote)
  handleRef.current = handleNote
  const { connected, supported } = useMidiInput(
    (m) => handleRef.current(m),
    status === 'playing'
  )

  // Sudden-death countdown.
  useEffect(() => {
    if (status !== 'playing') return
    const deadline = Date.now() + sp.seconds * 1000
    const id = setInterval(() => {
      const rem = deadline - Date.now()
      if (rem <= 0) {
        clearInterval(id)
        setRemaining(0)
        finish(false)
      } else {
        setRemaining(rem)
      }
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sp.seconds])

  const mark = (i: number): KeyMark => ({
    midi: midis[i],
    label: String(sp.rh[i]),
    sublabel: String(sp.lh[i]),
  })
  // Lit so far while playing; the whole scale once it's resolved.
  const marks =
    status === 'playing'
      ? sp.notes.slice(0, index).map((_, i) => mark(i))
      : sp.notes.map((_, i) => mark(i))

  const playing = status === 'playing'
  const pct = Math.max(0, (remaining / (sp.seconds * 1000)) * 100)
  const urgent = playing && remaining <= 3000

  return (
    <article className="relative overflow-hidden rounded-3xl border border-rule bg-card px-6 py-7 shadow-[0_22px_60px_-32px_rgba(33,28,21,0.5)] sm:px-9 sm:py-9">
      {playing && (
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-rule/40">
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-wrong' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-2 select-none font-display text-[12rem] leading-none text-ink/[0.04] sm:text-[15rem]"
      >
        𝄞
      </span>

      <p className="marking flex items-center gap-2 text-accent">
        <span className="h-px w-5 bg-accent/50" />
        {question.category}
        {playing && (
          <span
            className={`ml-auto font-mono text-sm font-semibold tabular-nums transition-colors ${urgent ? 'text-wrong' : 'text-ink-2'}`}
            aria-label="seconds remaining"
          >
            {Math.ceil(remaining / 1000)}s
          </span>
        )}
      </p>

      <h2 className="mt-3 font-display text-2xl font-medium leading-snug tracking-[-0.01em] text-ink sm:text-[1.7rem]">
        Play the <span className="italic">{sp.keyName}</span> scale, ascending
        {sp.octaves === 2 ? ' (two octaves)' : ''}.
      </h2>

      <p className="marking mt-3 flex items-center gap-2 text-ink-3">
        <span className={connected ? 'text-correct' : 'text-ink-3'}>
          {!supported
            ? '🎹 MIDI not supported in this browser — tap the keys'
            : connected
              ? '🎹 MIDI connected'
              : '🎹 connect a MIDI keyboard, or tap the keys'}
        </span>
        {isMuted() && <span className="text-wrong">· ♪ sound off</span>}
      </p>

      <div className="mt-5">
        <PianoKeyboard
          marks={marks}
          from={range.from}
          octaves={range.octaves}
          onPress={playing ? handleNote : undefined}
          pressed={pressed}
        />
      </div>

      {!playing && (
        <div className="mt-7 border-t border-rule pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-display text-lg italic">
              {status === 'passed' ? (
                <span className="text-correct">Just so.</span>
              ) : (
                <span className="text-wrong">
                  Not quite — here’s the {sp.keyName} scale.
                </span>
              )}
            </p>
            <Button onClick={onNext} autoFocus>
              Next
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}
