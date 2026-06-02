import { useEffect, useMemo, useRef, useState } from 'react'
import type { Question } from '../contracts'
import { METERS, onsets, scoreTaps, type OnsetResult, type Tap } from '../rhythm'
import { isMuted, playClick, playRhythm, prime, stop } from '../audio/player'
import { getSavedTempo, saveTempo } from '../tempos'
import RhythmStaff from './RhythmStaff'
import Button from './Button'

/**
 * Interactive "Tap the Rhythm" étude. Show a one-bar rhythm as notation; after a
 * one-bar count-in (a click on every felt beat, continuing under the bar), the
 * student taps the rhythm with Space or by tapping the screen. Each tap is timed
 * against the expected onset; the run is graded as an accuracy % (≥ 80 % passes).
 * Pure sight-reading — the rhythm is only ever heard *after* the attempt, via the
 * "Hear it" button. The results screen colours each note by how it was hit so the
 * mistakes are obvious. Graded once through `onResolve` (like ScalePlayCard).
 */

interface TapAlongCardProps {
  question: Question
  onResolve: (passed: boolean, tempo: number) => void
  onNext: () => void
}

const PASS = 80
const TEMPO_MIN = 50
const TEMPO_MAX = 150
const TEMPO_STEP = 5
// Feedback notehead colours (design tokens): viridian = on the beat, gold =
// off but counted, vermilion = missed.
const ON_BEAT = '#2f6b4e'
const OFF = '#b08d57'
const MISSED = '#bb4430'

const onsetColor = (r: OnsetResult): string =>
  r.dtMs === null || r.short ? MISSED : r.score === 1 ? ON_BEAT : OFF

/** Snap a tempo into the slider's range and step (the per-level default). */
const snapTempo = (t: number): number =>
  Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(t / TEMPO_STEP) * TEMPO_STEP))

export default function TapAlongCard({
  question,
  onResolve,
  onNext,
}: TapAlongCardProps) {
  const ta = question.tapAlong!
  const { meter, pattern } = ta
  const level = question.level ?? 0
  // The tempo is user-adjustable (slider); default to the saved tempo for this
  // level, else the level's built-in tempo snapped into the slider's range.
  const [tempo, setTempoState] = useState(
    () => getSavedTempo('rhythm-tap', level) ?? snapTempo(ta.tempo)
  )
  const setTempo = (t: number) => {
    setTempoState(t)
    saveTempo('rhythm-tap', level, t)
  }
  const beatMs = 60000 / tempo
  const { countIn, totalBeats } = METERS[meter]

  // Where taps are expected (ms from the count-in start): the pattern's struck
  // notes, shifted past the one-bar count-in. `beats` drives the timing window;
  // `holdMs` is how long the note sounds (the press must cover ≥ 80% of it).
  const expected = useMemo(
    () =>
      onsets(pattern).map((o) => ({
        ms: (totalBeats + o.beat) * beatMs,
        beats: o.beats,
        holdMs: o.hold * beatMs,
      })),
    [pattern, totalBeats, beatMs]
  )
  // A click on every felt beat across both bars — one uniform wooden click, the
  // same for the count-in and the exercise. The first beat of each measure is
  // slightly accented. The count-in bar counts the felt beats the usual way
  // (1·2·3·4 in 4/4, 1·2·3 in 3/4, …). No tick past the bar's last beat — a
  // trailing click reads as a beat behind.
  const clicks = useMemo(() => {
    const out: { ms: number; accent: boolean; num?: number }[] = []
    for (let bar = 0; bar < 2; bar++) {
      countIn.forEach((b, i) =>
        out.push({
          ms: (bar * totalBeats + b) * beatMs,
          accent: i === 0, // first beat of the measure — a light accent
          num: bar === 0 ? i + 1 : undefined, // count the felt beats: 1·2·3·4
        })
      )
    }
    return out
  }, [countIn, totalBeats, beatMs])
  // When the tapping bar begins (the count-in is over): the "now tap" moment.
  const rhythmStartMs = totalBeats * beatMs
  // One bar's worth of ms — the time axis of the tap trace under the staff.
  const barMs = totalBeats * beatMs
  // A tap → its position (% across the bar) and the held line's length (% of bar).
  const markStyle = (down: number, hold: number) => {
    const pos = Math.max(0, Math.min(100, ((down - rhythmStartMs) / barMs) * 100))
    return { left: `${pos}%`, width: `${Math.max(0, Math.min(100 - pos, (hold / barMs) * 100))}%` }
  }
  // Tail past the bar so a late final tap still lands; then we grade.
  const finishMs = 2 * totalBeats * beatMs + 450
  // Ignore taps during the count-in (a feel-the-beat tap shouldn't penalise).
  const gateMs = rhythmStartMs - 120

  const [status, setStatus] = useState<'ready' | 'tapping' | 'done'>('ready')
  // False during the count-in, true once the tapping bar has begun.
  const [started, setStarted] = useState(false)
  // A brief green flash at the downbeat where tapping begins (the colour cue).
  const [go, setGo] = useState(false)
  // The count-in beat number currently showing (1·2·3·4…); null when not counting.
  const [countNum, setCountNum] = useState<number | null>(null)
  const [tapCount, setTapCount] = useState(0)
  // A one-shot flash on every beat — the visual metronome (also covers muted).
  const [beatLit, setBeatLit] = useState(false)
  // The in-progress tap, growing while held, for the live trace under the staff.
  const [live, setLive] = useState<{ down: number; hold: number } | null>(null)
  const [result, setResult] = useState<ReturnType<typeof scoreTaps> | null>(null)
  // How many attempts have been performed. Only the first is graded to SRS;
  // later ones are practice ("Try again"), shown but not counted.
  const [attempts, setAttempts] = useState(0)
  // Whether the graded (first) attempt passed — shown on practice retries.
  const [gradedPass, setGradedPass] = useState(false)

  const t0 = useRef<number | null>(null)
  const tapsRef = useRef<Tap[]>([])
  // The in-progress press (one at a time): onset relative to t0 + the absolute
  // press time, so its hold is measured on release.
  const pending = useRef<{ downRel: number; downAbs: number } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  // Animation frame growing the live tap's trace while a key/finger is held.
  const raf = useRef<number | undefined>(undefined)
  // True once an attempt is being scored, so a stray timer can't double-finish.
  const finishing = useRef(false)
  // True once SRS has been graded — set on the FIRST attempt and never again, so
  // retries are practice only and can't turn a fail into a pass.
  const resolved = useRef(false)

  const clearTimers = () => {
    for (const id of timers.current) clearTimeout(id)
    timers.current = []
  }
  const stopRaf = () => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = undefined
  }
  useEffect(
    () => () => {
      clearTimers()
      stopRaf()
      stop()
    },
    []
  )

  const finish = () => {
    if (finishing.current) return
    finishing.current = true
    stopRaf()
    setLive(null)
    // Close a press still held at the buzzer so its hold still counts.
    if (pending.current) {
      const { downRel, downAbs } = pending.current
      pending.current = null
      tapsRef.current.push({ down: downRel, hold: performance.now() - downAbs })
    }
    const res = scoreTaps(expected, tapsRef.current)
    setResult(res)
    setStatus('done')
    setAttempts((n) => n + 1)
    // Grade SRS once, on the first attempt only.
    if (!resolved.current) {
      resolved.current = true
      setGradedPass(res.accuracy >= PASS)
      onResolve(res.accuracy >= PASS, tempo)
    }
  }

  // Run one attempt (the first via "Begin", later ones via "Try again").
  const run = () => {
    clearTimers()
    stopRaf()
    prime() // unlock audio on this gesture
    t0.current = performance.now()
    tapsRef.current = []
    pending.current = null
    finishing.current = false
    setTapCount(0)
    setStarted(false)
    setGo(false)
    setCountNum(null)
    setLive(null)
    setResult(null)
    setStatus('tapping')
    for (const c of clicks) {
      timers.current.push(
        setTimeout(() => {
          playClick(c.accent)
          setBeatLit(true)
          if (c.num != null) setCountNum(c.num) // count-in beat number
          timers.current.push(setTimeout(() => setBeatLit(false), 110))
        }, c.ms)
      )
    }
    // The downbeat: flip to the tapping phase, clear the count, flash green.
    timers.current.push(
      setTimeout(() => {
        setStarted(true)
        setCountNum(null)
        setGo(true)
        timers.current.push(setTimeout(() => setGo(false), 550))
      }, rhythmStartMs)
    )
    timers.current.push(setTimeout(finish, finishMs))
  }

  // Press: start a note. Release: record it with how long it was held. One press
  // at a time (a held key/finger), so the next note needs a release first.
  const pressDown = () => {
    if (status !== 'tapping' || t0.current == null || pending.current) return
    const downRel = performance.now() - t0.current
    if (downRel < gateMs) return // still in the count-in — ignore
    const downAbs = performance.now()
    pending.current = { downRel, downAbs }
    // Grow the live trace (dot + line) while held.
    setLive({ down: downRel, hold: 0 })
    const grow = () => {
      if (!pending.current) return
      setLive({ down: pending.current.downRel, hold: performance.now() - pending.current.downAbs })
      raf.current = requestAnimationFrame(grow)
    }
    raf.current = requestAnimationFrame(grow)
  }
  const pressUp = () => {
    if (!pending.current) return
    stopRaf()
    const { downRel, downAbs } = pending.current
    pending.current = null
    setLive(null)
    tapsRef.current.push({ down: downRel, hold: performance.now() - downAbs })
    setTapCount((n) => n + 1)
  }
  // Stable refs so the window listeners don't re-subscribe per render.
  const downRef = useRef(pressDown)
  downRef.current = pressDown
  const upRef = useRef(pressUp)
  upRef.current = pressUp

  // Space holds a note (press/release); pointer up anywhere ends a touch hold.
  // The card owns Space entirely — always preventDefault so it can't also
  // activate a focused button (e.g. tapping past your own result into "Next").
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (status === 'tapping' && !e.repeat) downRef.current()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (status === 'tapping') upRef.current()
    }
    const onPointerUp = () => upRef.current()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [status])

  // Per-event feedback colours, aligned to the full pattern (rests/ties left ink).
  const eventColors = useMemo(() => {
    if (!result) return undefined
    const colors: (string | undefined)[] = []
    let k = 0
    for (let i = 0; i < pattern.length; i++) {
      const e = pattern[i]
      const continuation = i > 0 && !!pattern[i - 1].tie
      if (e.rest || continuation) {
        colors.push(undefined)
        continue
      }
      colors.push(onsetColor(result.perOnset[k++]))
    }
    return colors
  }, [result, pattern])

  const accuracy = result?.accuracy ?? 0
  const verdict =
    accuracy >= 95
      ? 'Spot on.'
      : accuracy >= PASS
        ? 'Well in time.'
        : accuracy >= 60
          ? 'Close.'
          : 'Off the beat.'
  const passed = accuracy >= PASS
  const tapping = status === 'tapping'

  return (
    <article className="relative overflow-hidden rounded-3xl border border-rule bg-card px-6 py-7 shadow-[0_22px_60px_-32px_rgba(33,28,21,0.5)] sm:px-9 sm:py-9">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-2 select-none font-display text-[12rem] leading-none text-ink/[0.04] sm:text-[15rem]"
      >
        𝄞
      </span>

      <p className="marking flex items-center gap-2 text-accent">
        <span className="h-px w-5 bg-accent/50" />
        {question.category}
        <span className="ml-auto font-mono text-sm text-ink-3">{meter}</span>
      </p>

      <h2 className="mt-3 font-display text-2xl font-medium leading-snug tracking-[-0.01em] text-ink sm:text-[1.7rem]">
        Tap <span className="italic">and hold</span> this rhythm —{' '}
        <span className="font-mono not-italic">Space</span> or tap.
      </h2>

      <p className="marking mt-3 flex items-center gap-2 text-ink-3">
        <span
          aria-hidden
          className={`inline-block h-2.5 w-2.5 rounded-full transition-all duration-150 ${
            !tapping
              ? 'bg-rule'
              : !started
                ? // count-in: a calm pulse establishing the tempo
                  beatLit
                  ? 'bg-accent opacity-90'
                  : 'bg-accent opacity-30'
                : // under the bar: a gentle green pulse
                  beatLit
                  ? 'bg-correct opacity-90'
                  : 'bg-correct opacity-30'
          }`}
        />
        {tapping ? (
          started ? (
            <span className={`font-semibold ${go ? 'text-correct' : 'text-accent'}`}>
              Tap the rhythm · ♪ {tapCount}
            </span>
          ) : (
            'Get ready — counting you in…'
          )
        ) : status === 'ready' ? (
          'a one-bar count-in sets the tempo'
        ) : (
          'reading complete'
        )}
        {isMuted() && <span className="text-wrong">· ♪ turn sound on for the click</span>}
      </p>

      {/* The notation — also the tap surface while playing. One calm green hue
          marks the whole tapping phase: a brief brighter flash on the downbeat,
          settling to a soft steady green (no per-tap highlight). */}
      <div
        onPointerDown={tapping && started ? pressDown : undefined}
        className={`relative mt-5 select-none rounded-2xl border px-3 py-4 transition-all duration-300 ${
          !tapping
            ? 'border-rule bg-paper/60'
            : !started
              ? 'border-dashed border-rule bg-paper/60 opacity-70'
              : go
                ? 'cursor-pointer border-correct bg-correct/10 ring-1 ring-correct' // downbeat flash
                : 'cursor-pointer border-correct/40 bg-paper ring-1 ring-correct/20' // steady
        }`}
      >
        <RhythmStaff pattern={pattern} meter={meter} eventColors={eventColors} />

        {/* Tap trace: under the staff, a dot per tap with a line extending right
            for as long as it was held (the live one grows while you hold). */}
        {(started || status === 'done') && (
          <div className="relative mt-1 h-7" aria-hidden>
            {/* faint beat grid + baseline */}
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule/60" />
            {Array.from({ length: totalBeats + 1 }, (_, i) => (
              <div
                key={`g${i}`}
                className="absolute top-1 bottom-1 w-px bg-rule/40"
                style={{ left: `${(i / totalBeats) * 100}%` }}
              />
            ))}
            {tapsRef.current.map((t, i) => {
              const s = markStyle(t.down, t.hold)
              return (
                <div key={i} className="absolute top-1/2 -translate-y-1/2" style={s}>
                  <div className="h-1 w-full rounded-full bg-ink/55" />
                  <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/70" />
                </div>
              )
            })}
            {live && (
              <div className="absolute top-1/2 -translate-y-1/2" style={markStyle(live.down, live.hold)}>
                <div className="h-1 w-full rounded-full bg-ink" />
                <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
              </div>
            )}
          </div>
        )}

        {tapping &&
          (started ? (
            <p className="marking mt-2 text-center text-ink-3">
              tap &amp; hold each note for its length
            </p>
          ) : (
            <p className="marking mt-2 text-center text-ink-3">listen…</p>
          ))}
        {/* Count-in beat number (1·2·3·4…) over the staff — accent while
            counting; the downbeat then flashes the staff green (above). */}
        {tapping && !started && countNum != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span
              key={countNum}
              className="rise font-display text-7xl font-medium text-accent drop-shadow-[0_2px_10px_rgba(122,37,64,0.3)]"
            >
              {countNum}
            </span>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-3">
            <span className="marking text-ink-3">Tempo</span>
            <input
              type="range"
              min={TEMPO_MIN}
              max={TEMPO_MAX}
              step={TEMPO_STEP}
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              aria-label="Tempo in beats per minute"
              className="h-1 w-40 cursor-pointer appearance-none rounded-full bg-rule accent-accent"
            />
            <span className="w-20 font-mono text-sm tabular-nums text-ink">
              {tempo} BPM
            </span>
          </label>
          <Button onClick={run} autoFocus>
            Begin
          </Button>
        </div>
      )}

      {status === 'done' && result && (
        <div className="mt-7 border-t border-rule pt-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                className={`font-display text-lg italic ${passed ? 'text-correct' : 'text-wrong'}`}
              >
                {verdict}
              </p>
              <p className="mt-1 text-ink-2">
                <span className="font-mono text-2xl text-ink">{accuracy}%</span>{' '}
                accuracy
              </p>
              {attempts > 1 && (
                <p className="marking mt-2 text-ink-3">
                  practice retry — your first attempt{' '}
                  <span className={gradedPass ? 'text-correct' : 'text-wrong'}>
                    {gradedPass ? 'passed' : 'didn’t pass'}
                  </span>{' '}
                  and is what counts
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => playRhythm(pattern, meter, tempo)}
              >
                Hear it
              </Button>
              <Button variant="secondary" onClick={run}>
                Try again
              </Button>
              <Button onClick={onNext}>Next</Button>
            </div>
          </div>

          {/* Per-note mistakes, made explicit: offset (+ late / − early), held
              too short, or missed. */}
          <div className="mt-5 flex flex-wrap gap-2">
            {result.perOnset.map((r, i) => (
              <span
                key={i}
                className="font-mono text-xs tabular-nums"
                style={{ color: onsetColor(r) }}
              >
                <span className="text-ink-3">{i + 1}</span>{' '}
                {r.dtMs === null
                  ? 'missed'
                  : r.short
                    ? 'too short'
                    : `${r.dtMs > 0 ? '+' : ''}${r.dtMs} ms`}
              </span>
            ))}
            {result.extra > 0 && (
              <span className="font-mono text-xs text-wrong">
                · {result.extra} extra tap{result.extra === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="marking mt-3 text-ink-3">
            <span style={{ color: ON_BEAT }}>on the beat</span> ·{' '}
            <span style={{ color: OFF }}>a little off</span> ·{' '}
            <span style={{ color: MISSED }}>missed / too short</span>
          </p>
        </div>
      )}
    </article>
  )
}
