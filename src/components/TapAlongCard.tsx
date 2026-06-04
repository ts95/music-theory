import { useEffect, useMemo, useRef, useState } from 'react'
import type { Question } from '../contracts'
import { METERS, holdMinFor, onsets, scoreTaps, type OnsetResult, type Tap } from '../rhythm'
import { countSyllables } from '../rhythmCounting'
import { isMuted, playClick, playRhythm, prime, stop } from '../audio/player'
import { getSavedTempo, saveTempo } from '../tempos'
import { getBoolPref, setBoolPref } from '../prefs'
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
const TEMPO_MIN = 30
const TEMPO_MAX = 90
const TEMPO_STEP = 5
const DEFAULT_TEMPO = 50
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
  // level, else 50 BPM. Snapped/clamped into the slider's range (handles stale
  // saved values from a previous range).
  const [tempo, setTempoState] = useState(() =>
    snapTempo(getSavedTempo('rhythm-tap', level) ?? DEFAULT_TEMPO)
  )
  const setTempo = (t: number) => {
    setTempoState(t)
    saveTempo('rhythm-tap', level, t)
  }
  // Counting guide shown on the ready screen: Traditional (numbers) or Kodály
  // (duration syllables), remembered globally.
  const [kodaly, setKodalyState] = useState(() => getBoolPref('count-kodaly', false))
  const setKodaly = (v: boolean) => {
    setKodalyState(v)
    setBoolPref('count-kodaly', v)
  }
  const counts = useMemo(
    () => countSyllables(pattern, meter, kodaly ? 'kodaly' : 'traditional'),
    [pattern, meter, kodaly]
  )
  const [status, setStatus] = useState<'ready' | 'tapping' | 'done'>('ready')
  // The tempo the just-finished attempt was performed at. The *trace* geometry is
  // drawn against this (not the live `tempo`) once done, so adjusting the slider
  // on the results screen — to set up a "Try again" — doesn't shift the recorded
  // dots/trails left or right. Scheduling/grading always use the live `tempo` so
  // a retry honours a slider change; while tapping the two are equal.
  const [doneTempo, setDoneTempo] = useState(0)
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
  // Trace gridlines at the metre's felt beats (+ the closing barline), as a
  // fraction of the bar — so 6/8 shows two lines, 12/8 four, cut time two, etc.,
  // matching the count-in pulse rather than every quarter.
  const beatGrid = useMemo(
    () => [...countIn.map((b) => b / totalBeats), 1],
    [countIn, totalBeats]
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
  // The tap trace under the staff is drawn against the *performed* tempo once
  // done — recorded taps carry fixed real-time ms, so re-projecting them onto a
  // different axis (the slider on the results screen) would shift them. While
  // tapping, this equals the live `beatMs`.
  const traceBeatMs = 60000 / (status === 'done' ? doneTempo : tempo)
  // One bar's worth of ms — the time axis of the tap trace (and its count-in lane).
  const barMs = totalBeats * traceBeatMs
  // A tap → its position (% across the bar) and the held line's length (% of bar).
  const markStyle = (down: number, hold: number) => {
    const pos = Math.max(0, Math.min(100, ((down - barMs) / barMs) * 100))
    return { left: `${pos}%`, width: `${Math.max(0, Math.min(100 - pos, (hold / barMs) * 100))}%` }
  }
  // Same, on the count-in lane's axis (the count-in bar, 0…barMs).
  const countInStyle = (down: number, hold: number) => {
    const pos = Math.max(0, Math.min(100, (down / barMs) * 100))
    return { left: `${pos}%`, width: `${Math.max(0, Math.min(100 - pos, (hold / barMs) * 100))}%` }
  }
  // The target onsets positioned on the trace's (frozen-on-done) axis, so the
  // "expected" lane lines up with the "you" lane no matter the slider.
  const traceExpected = useMemo(
    () =>
      onsets(pattern).map((o) => ({
        ms: (totalBeats + o.beat) * traceBeatMs,
        beats: o.beats,
        holdMs: o.hold * traceBeatMs,
      })),
    [pattern, totalBeats, traceBeatMs]
  )
  // Tail past the bar so a late final tap still lands; then we grade.
  const finishMs = 2 * totalBeats * beatMs + 450
  // Ignore taps during the count-in (a feel-the-beat tap shouldn't penalise).
  const gateMs = rhythmStartMs - 120

  // False during the count-in, true once the tapping bar has begun.
  const [started, setStarted] = useState(false)
  // A brief green flash at the downbeat where tapping begins (the colour cue).
  const [go, setGo] = useState(false)
  // The count-in beat number currently showing (1·2·3·4…); null when not counting.
  const [countNum, setCountNum] = useState<number | null>(null)
  // How many count-in felt beats have sounded — lights the count-in warm-up lane.
  const [countInLit, setCountInLit] = useState(0)
  // The user's completed warm-up taps during the count-in (with held length).
  const [countInTaps, setCountInTaps] = useState<Tap[]>([])
  // The in-progress warm-up tap, growing while held (its trail on the lane).
  const [countInLive, setCountInLive] = useState<{ down: number; hold: number } | null>(null)
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
  // An in-progress warm-up press during the count-in (down relative to t0 + the
  // absolute press time). Drives the warm-up trail; if still held at the downbeat
  // it becomes the first note (anticipated/held-into downbeat).
  const countInPending = useRef<{ down: number; downAbs: number } | null>(null)
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
    setDoneTempo(tempo) // freeze the trace axis at the performed tempo
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
    countInPending.current = null
    finishing.current = false
    setTapCount(0)
    setStarted(false)
    setGo(false)
    setCountNum(null)
    setCountInLit(0)
    setCountInTaps([])
    setCountInLive(null)
    setLive(null)
    setResult(null)
    setStatus('tapping')
    for (const c of clicks) {
      timers.current.push(
        setTimeout(() => {
          playClick(c.accent)
          setBeatLit(true)
          if (c.num != null) {
            setCountNum(c.num) // count-in beat number
            setCountInLit(c.num) // light this felt beat on the warm-up lane
          }
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
        // If a warm-up press is still held from the count-in (anticipated
        // downbeat), hand it off to the first note so the hold counts.
        if (countInPending.current && !pending.current) {
          stopRaf()
          countInPending.current = null
          setCountInLive(null)
          pending.current = { downRel: rhythmStartMs, downAbs: performance.now() }
          setLive({ down: rhythmStartMs, hold: 0 })
          startGrow()
        }
      }, rhythmStartMs)
    )
    timers.current.push(setTimeout(finish, finishMs))
  }

  // Grow the live trace (dot + line) while the graded note is held.
  const startGrow = () => {
    const grow = () => {
      if (!pending.current) return
      setLive({ down: pending.current.downRel, hold: performance.now() - pending.current.downAbs })
      raf.current = requestAnimationFrame(grow)
    }
    raf.current = requestAnimationFrame(grow)
  }
  // Same, for a warm-up press during the count-in (grows the count-in trail).
  const startCountInGrow = () => {
    const grow = () => {
      if (!countInPending.current) return
      setCountInLive({ down: countInPending.current.down, hold: performance.now() - countInPending.current.downAbs })
      raf.current = requestAnimationFrame(grow)
    }
    raf.current = requestAnimationFrame(grow)
  }
  // Press: start a note. Release: record it with how long it was held. One press
  // at a time (a held key/finger), so the next note needs a release first.
  const pressDown = () => {
    if (status !== 'tapping' || t0.current == null || pending.current || countInPending.current) return
    const downRel = performance.now() - t0.current
    if (downRel < gateMs) {
      // A press during the count-in: not graded, but it grows a warm-up trail —
      // and if it's still held at the downbeat it becomes the first note.
      countInPending.current = { down: downRel, downAbs: performance.now() }
      setCountInLive({ down: downRel, hold: 0 })
      startCountInGrow()
      return
    }
    pending.current = { downRel, downAbs: performance.now() }
    setLive({ down: downRel, hold: 0 })
    startGrow()
  }
  const pressUp = () => {
    // A warm-up press released during the count-in → record it (with held length).
    if (countInPending.current) {
      stopRaf()
      const { down, downAbs } = countInPending.current
      countInPending.current = null
      setCountInLive(null)
      setCountInTaps((prev) => [...prev, { down, hold: performance.now() - downAbs }])
      return
    }
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

  // Per-event feedback colours, aligned to the full pattern. Rests stay ink; a
  // tied continuation inherits its onset's colour, so a whole tied note (the
  // struck note + everything tied to it) shows as one colour.
  const eventColors = useMemo(() => {
    if (!result) return undefined
    const colors: (string | undefined)[] = []
    let k = 0
    let held: string | undefined // the current tied group's colour
    for (let i = 0; i < pattern.length; i++) {
      const e = pattern[i]
      const continuation = i > 0 && !!pattern[i - 1].tie
      if (e.rest) {
        colors.push(undefined)
        held = undefined
        continue
      }
      if (continuation) {
        colors.push(held)
        continue
      }
      held = onsetColor(result.perOnset[k++])
      colors.push(held)
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

  // Tempo slider, shown before the first try and again before a retry.
  const tempoControl = (
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
      <span className="w-20 font-mono text-sm tabular-nums text-ink">{tempo} BPM</span>
    </label>
  )

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
        onPointerDown={tapping ? pressDown : undefined}
        className={`relative mt-5 select-none rounded-2xl border px-3 py-4 transition-all duration-300 ${
          !tapping
            ? 'border-rule bg-paper/60'
            : !started
              ? 'cursor-pointer border-dashed border-rule bg-paper/60' // count-in: warm-up taps allowed
              : go
                ? 'cursor-pointer border-correct bg-correct/10 ring-1 ring-correct' // downbeat flash
                : 'cursor-pointer border-correct/40 bg-paper ring-1 ring-correct/20' // steady
        }`}
      >
        <RhythmStaff
          pattern={pattern}
          meter={meter}
          eventColors={eventColors}
          counts={status === 'ready' ? counts : undefined}
        />

        {/* Count-in warm-up lane: a felt-beat mark lights in sync with each
            count-in click (accent), and your warm-up taps show too (ink) — so you
            can test your timing before the real bar starts. */}
        {tapping && !started && (
          <div className="relative mt-1 h-7" aria-hidden>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule/60" />
            {beatGrid.map((frac, i) => (
              <div
                key={`cg${i}`}
                className="absolute top-1 bottom-1 w-px bg-rule/40"
                style={{ left: `${frac * 100}%` }}
              />
            ))}
            {countIn.slice(0, countInLit).map((bq, i) => (
              <div
                key={`cm${i}`}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${(bq / totalBeats) * 100}%` }}
              />
            ))}
            {countInTaps.map((t, i) => (
              <div key={`ct${i}`} className="absolute top-1/2 -translate-y-1/2" style={countInStyle(t.down, t.hold)}>
                <div className="h-1 w-full rounded-full bg-ink/55" />
                <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/70" />
              </div>
            ))}
            {countInLive && (
              <div className="absolute top-1/2 -translate-y-1/2" style={countInStyle(countInLive.down, countInLive.hold)}>
                <div className="h-1 w-full rounded-full bg-ink" />
                <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
              </div>
            )}
          </div>
        )}

        {/* Tap trace(s): under the staff, a dot per onset with a line extending
            right for its held length. While tapping, just your taps (the live one
            grows as you hold). On the results screen a second "expected" lane is
            added below so you can compare your timing/duration to the target. */}
        {(started || status === 'done') && (
          <>
            {status === 'done' && (
              <p className="marking mt-3 text-ink-2">you</p>
            )}
            <div className="relative mt-1 h-7" aria-hidden>
              {/* faint felt-beat grid + baseline */}
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule/60" />
              {beatGrid.map((frac, i) => (
                <div
                  key={`g${i}`}
                  className="absolute top-1 bottom-1 w-px bg-rule/40"
                  style={{ left: `${frac * 100}%` }}
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

            {status === 'done' && (
              <>
                <p className="marking mt-2 text-accent">expected</p>
                <div className="relative mt-1 h-7" aria-hidden>
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule/60" />
                  {beatGrid.map((frac, i) => (
                    <div
                      key={`eg${i}`}
                      className="absolute top-1 bottom-1 w-px bg-rule/40"
                      style={{ left: `${frac * 100}%` }}
                    />
                  ))}
                  {traceExpected.map((e, i) => {
                    // Draw the target at the required-hold fraction + 20pp (60%
                    // fast / 90% otherwise) — a touch past the grading threshold
                    // (holdMinFor), so aiming for this line clears it comfortably.
                    const frac = Math.min(1, holdMinFor(e.beats) + 0.2)
                    const s = markStyle(e.ms, e.holdMs * frac)
                    return (
                      <div key={i} className="absolute top-1/2 -translate-y-1/2" style={s}>
                        <div className="h-1 w-full rounded-full bg-accent/55" />
                        <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {tapping &&
          (started ? (
            <p className="marking mt-2 text-center text-ink-3">
              tap &amp; hold each note for its length
            </p>
          ) : (
            <p className="marking mt-2 text-center text-ink-3">tap along to warm up…</p>
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
        <>
          {/* Counting guide system toggle + a one-line legend. */}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="marking text-ink-3">Count</span>
            <div className="inline-flex rounded-full border border-rule bg-card p-0.5">
              {[
                { label: 'Traditional', on: !kodaly, set: () => setKodaly(false) },
                { label: 'Kodály', on: kodaly, set: () => setKodaly(true) },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={o.set}
                  aria-pressed={o.on}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    o.on ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="marking text-ink-3">
              {kodaly
                ? 'ta = quarter · ti = eighth · ti-ka sixteenths'
                : 'numbers on beats · & off-beats · e/a sixteenths'}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            {tempoControl}
            <Button onClick={run} autoFocus>
              Begin
            </Button>
          </div>
        </>
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

          {/* Adjust the tempo before retrying. */}
          <div className="mt-4">{tempoControl}</div>

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
