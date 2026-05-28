import { useEffect, useMemo, useRef, useState } from 'react'
import type { Question } from '../contracts'
import { isMuted, play, playEar, stop } from '../audio/player'
import {
  INTERVAL_ROOTS,
  progressionTonics,
  realizeEar,
  voicedMidi,
} from '../theory'
import Staff from './Staff'
import Button from './Button'

interface QuestionCardProps {
  question: Question
  /** The choice index the user has selected, or null if unanswered. */
  selected: number | null
  /** True when the answer timer expired before a choice was made. */
  timedOut?: boolean
  /** If set, the question must be answered within this many ms. */
  timeLimitMs?: number
  onSelect: (choiceIndex: number) => void
  onNext: () => void
  onTimeout: () => void
}

type ChoiceState = 'idle' | 'correct' | 'wrong' | 'muted'

/** Fisher–Yates shuffle of [0, n). Returns the order of original indices. */
function shuffledOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** Row container styling per state. */
function rowClasses(state: ChoiceState): string {
  switch (state) {
    case 'correct':
      return 'bg-correct/10 ring-2 ring-correct'
    case 'wrong':
      return 'bg-wrong/10 ring-2 ring-wrong'
    case 'muted':
      return 'bg-card/60 ring-1 ring-rule opacity-55'
    default:
      return 'bg-card ring-1 ring-rule hover:ring-ink hover:bg-paper hover:-translate-y-0.5'
  }
}

/** The engraved numeral badge styling per state. */
function badgeClasses(state: ChoiceState): string {
  switch (state) {
    case 'correct':
      return 'bg-correct text-card ring-correct'
    case 'wrong':
      return 'bg-wrong text-card ring-wrong'
    case 'muted':
      return 'text-ink-3 ring-rule'
    default:
      return 'text-ink-2 ring-rule group-hover:bg-ink group-hover:text-paper group-hover:ring-ink'
  }
}

export default function QuestionCard({
  question,
  selected,
  timedOut = false,
  timeLimitMs,
  onSelect,
  onNext,
  onTimeout,
}: QuestionCardProps) {
  // Shuffle once per presentation of a question, keyed to its id.
  const order = useMemo(
    () => shuffledOrder(question.choices.length),
    [question.id],
  )

  const answered = selected !== null || timedOut
  const isCorrect = selected === question.answerIndex

  // Keep onTimeout in a ref so an ancestor re-render (e.g. the per-second
  // practice-time tick) that changes its identity doesn't restart the
  // countdown effect below — which would reset the deadline forever.
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  // Countdown timer (only for timed questions). The card remounts per question
  // (keyed by id), so this effect starts fresh each time.
  const [remaining, setRemaining] = useState(timeLimitMs ?? 0)
  useEffect(() => {
    if (timeLimitMs === undefined || answered) return
    const deadline = Date.now() + timeLimitMs
    const id = setInterval(() => {
      const rem = deadline - Date.now()
      if (rem <= 0) {
        clearInterval(id)
        setRemaining(0)
        onTimeoutRef.current()
      } else {
        setRemaining(rem)
      }
    }, 100)
    return () => clearInterval(id)
  }, [timeLimitMs, answered])

  const timed = timeLimitMs !== undefined
  const pct = timed ? Math.max(0, (remaining / timeLimitMs) * 100) : 0
  const urgent = timed && remaining <= 2000

  // Ear-training: realize the prompt from a random root (stable across replays
  // within this presentation; a fresh root next time the card mounts).
  const ear = question.ear
  const earIsInterval = ear?.kind === 'interval'
  const [earRoot] = useState(() => {
    if (!ear) return null
    const pool =
      ear.kind === 'interval' ? INTERVAL_ROOTS : progressionTonics(ear.mode)
    return pool[Math.floor(Math.random() * pool.length)]
  })
  const realized = useMemo(
    () => (ear && earRoot ? realizeEar(ear, earRoot) : null),
    [ear, earRoot],
  )

  function playPrompt() {
    if (!realized) return
    const reference = earIsInterval
      ? []
      : realized.reference.map((ev) => ev.map(voicedMidi))
    const target = realized.target.map((ev) => ev.map(voicedMidi))
    playEar(reference, target, realized.style)
  }
  function playReference() {
    if (!realized) return
    playEar([], realized.reference.map((ev) => ev.map(voicedMidi)), realized.style)
  }

  // Auto-play once when an ear question mounts (audio is already unlocked by the
  // click that opened the étude).
  useEffect(() => {
    if (realized && !isMuted()) playPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realized])

  // Keyboard: number keys 1–N select; Enter advances once answered.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!answered && /^[1-9]$/.test(e.key)) {
        const pos = Number(e.key) - 1
        if (pos < order.length) onSelect(order[pos])
      } else if (answered && e.key === 'Enter') {
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, order, onSelect, onNext])

  // Stop any lingering audio when this card unmounts (e.g. advancing).
  useEffect(() => () => stop(), [])

  return (
    <article className="relative overflow-hidden rounded-3xl border border-rule bg-card px-6 py-7 shadow-[0_22px_60px_-32px_rgba(33,28,21,0.5)] sm:px-9 sm:py-9">
      {/* Depleting countdown bar pinned to the top edge — a burning fuse. */}
      {timed && !answered && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-rule/40"
        >
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-wrong' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Faint engraved clef watermark for atmosphere. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-2 select-none font-display text-[12rem] leading-none text-ink/[0.04] sm:text-[15rem]"
      >
        𝄞
      </span>

      <p className="marking flex items-center gap-2 text-accent">
        <span className="h-px w-5 bg-accent/50" />
        {question.category}
        {timed && !answered && (
          <span
            className={`ml-auto font-mono text-sm font-semibold tabular-nums transition-colors ${urgent ? 'text-wrong' : 'text-ink-2'}`}
            aria-label="seconds remaining"
          >
            {Math.ceil(remaining / 1000)}s
          </span>
        )}
      </p>
      <h2 className="mt-3 font-display text-2xl font-medium leading-snug tracking-[-0.01em] text-ink sm:text-[1.7rem]">
        {question.prompt}
      </h2>

      {ear && (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button onClick={playPrompt}>▶ Play</Button>
          <button
            type="button"
            onClick={playReference}
            className="marking text-ink-3 transition-colors hover:text-ink"
          >
            {earIsInterval ? 'hear lower note' : 'hear tonic'}
          </button>
          {isMuted() && (
            <span className="marking text-wrong">♪ Sound is off</span>
          )}
        </div>
      )}

      <ul className="mt-7 space-y-2.5">
        {order.map((choiceIndex, pos) => {
          const isAnswer = choiceIndex === question.answerIndex
          const isChosen = choiceIndex === selected

          let state: ChoiceState = 'idle'
          if (answered) {
            if (isAnswer) state = 'correct'
            else if (isChosen) state = 'wrong'
            else state = 'muted'
          }

          const choiceText = question.choices[choiceIndex]
          const playable = question.audio?.[choiceText]

          return (
            <li
              key={choiceIndex}
              className="ink"
              style={{ animationDelay: `${pos * 60}ms` }}
              onPointerEnter={playable ? () => play(playable) : undefined}
              onPointerLeave={playable ? () => stop() : undefined}
            >
              <button
                type="button"
                disabled={answered}
                onClick={() => onSelect(choiceIndex)}
                className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 disabled:cursor-default ${rowClasses(state)}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium ring-1 transition-colors duration-200 ${badgeClasses(state)}`}
                >
                  {state === 'correct' ? '✓' : state === 'wrong' ? '✕' : pos + 1}
                </span>
                <span className="flex-1 font-mono text-[1.02rem] text-ink">
                  {choiceText}
                </span>
                {playable && (
                  <span
                    aria-hidden
                    className="shrink-0 text-ink-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  >
                    ♪
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {answered ? (
        <div className="mt-7 border-t border-rule pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-display text-lg italic">
              {isCorrect ? (
                <span className="text-correct">Just so.</span>
              ) : (
                <span className="text-wrong">
                  {timedOut ? 'Time’s up — it’s' : 'Not quite — it’s'}{' '}
                  <span className="font-mono not-italic">
                    {question.choices[question.answerIndex]}
                  </span>
                  .
                </span>
              )}
            </p>
            <Button onClick={onNext} autoFocus>
              Next
            </Button>
          </div>
          {ear && realized && (
            <Staff
              groups={realized.target}
              labels={
                earIsInterval
                  ? undefined
                  : question.choices[question.answerIndex].split('–')
              }
            />
          )}
          {!isCorrect && question.explanation && (
            <p className="ink mt-4 rounded-xl border border-rule bg-paper/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
              <span className="marking mr-1.5 text-accent">Remember</span>
              {question.explanation}
            </p>
          )}
        </div>
      ) : (
        <p className="marking mt-7 text-ink-3">
          Keys 1–{order.length} to answer · Enter for next
        </p>
      )}
    </article>
  )
}
