import { useEffect, useMemo, useRef, useState } from 'react'
import type { Question } from '../contracts'
import { isMuted, play, playEar, playRhythm, stop } from '../audio/player'
import {
  INTERVAL_ROOTS,
  noteToString,
  progressionTonics,
  realizeEar,
  voicedMidi,
} from '../theory'
import Staff from './Staff'
import RhythmStaff from './RhythmStaff'
import PianoKeyboard from './PianoKeyboard'
import CircleOfFifths from './CircleOfFifths'
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
  /** The user gave up — graded as the strongest lapse (resurface soon). */
  onDontKnow: () => void
  onNext: () => void
  onTimeout: () => void
}

type ChoiceState = 'idle' | 'correct' | 'wrong' | 'muted'

// `selected` sentinel for "I don't know" (kept in sync with ReviewSession).
const DONT_KNOW = -1

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
  onDontKnow,
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
  const earIsRhythm = ear?.kind === 'rhythm'
  const earIsMelody = ear?.kind === 'melody'
  const rhythmMeter = ear?.kind === 'rhythm' ? ear.meter : '4/4'
  // Rhythm prompts are pitch-agnostic, so they pick no tonic and aren't realized.
  const [earRoot] = useState(() => {
    if (!ear || ear.kind === 'rhythm') return null
    const pool =
      ear.kind === 'interval' ? INTERVAL_ROOTS : progressionTonics(ear.mode)
    return pool[Math.floor(Math.random() * pool.length)]
  })
  const realized = useMemo(
    () =>
      ear && ear.kind !== 'rhythm' && earRoot ? realizeEar(ear, earRoot) : null,
    [ear, earRoot],
  )
  // Optional interval "training wheels", revealed only on request and reset
  // each question (the card remounts per question id).
  const intervalSemis = ear?.kind === 'interval' ? ear.semitones : null
  const [revealQuality, setRevealQuality] = useState(false)

  function playPrompt() {
    if (ear?.kind === 'rhythm') {
      playRhythm(ear.pattern, ear.meter, ear.tempo)
      return
    }
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
  // Intervals only: sound both notes at once (one block event).
  function playHarmonic() {
    if (!realized) return
    const both = realized.target.flat().map(voicedMidi)
    playEar([], [both], 'block')
  }
  // Hint: walk up one semitone at a time from the lower note to the target, so
  // you can count the distance instead of guessing.
  function playWalkUp() {
    if (!earRoot || intervalSemis === null) return
    const base = voicedMidi(earRoot)
    const steps = Array.from({ length: intervalSemis + 1 }, (_, i) => [base + i])
    playEar([], steps, 'melodic')
  }
  // Hint: consonant intervals are stable/restful, dissonant ones tense — knowing
  // which roughly halves the options. (P4 grouped as a consonance here.)
  const isConsonant =
    intervalSemis !== null && [3, 4, 5, 7, 8, 9, 12].includes(intervalSemis)

  // Auto-play once when an ear question mounts (audio is already unlocked by the
  // click that opened the étude).
  useEffect(() => {
    if (!isMuted() && (realized || earIsRhythm)) playPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realized])

  // Keyboard: number keys 1–N select; 0 = "I don't know"; Enter advances.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!answered && /^[1-9]$/.test(e.key)) {
        const pos = Number(e.key) - 1
        if (pos < order.length) onSelect(order[pos])
      } else if (!answered && e.key === '0') {
        onDontKnow()
      } else if (answered && e.key === 'Enter') {
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, order, onSelect, onDontKnow, onNext])

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

      {question.notation && !question.notation.onReveal && (
        <Staff
          groups={question.notation.groups}
          clef={question.notation.clef}
          keySignature={question.notation.keySignature}
        />
      )}

      {ear && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {earIsInterval ? (
              <>
                <Button onClick={playPrompt}>▶ Arpeggiated</Button>
                <Button variant="secondary" onClick={playHarmonic}>
                  ▶ Together
                </Button>
              </>
            ) : (
              <Button onClick={playPrompt}>▶ Play</Button>
            )}
            {!earIsRhythm && (
              <button
                type="button"
                onClick={playReference}
                className="marking text-ink-3 transition-colors hover:text-ink"
              >
                {earIsInterval ? 'hear lower note' : 'hear tonic'}
              </button>
            )}
            {isMuted() && (
              <span className="marking text-wrong">♪ Sound is off</span>
            )}
          </div>
          {earIsInterval && earRoot && (
            <p className="mt-3 text-ink-2">
              The lower note is{' '}
              <span className="font-mono text-ink">{noteToString(earRoot.note)}</span>.
            </p>
          )}
          {earIsInterval && !answered && (
            // Optional training wheels — kept subtle so they don't crowd the prompt.
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="marking text-ink-3">Hints</span>
              <button
                type="button"
                onClick={playWalkUp}
                className="marking text-ink-3 transition-colors hover:text-ink"
              >
                ▶ step up to it
              </button>
              {revealQuality ? (
                <span
                  className={`marking ${isConsonant ? 'text-correct' : 'text-wrong'}`}
                >
                  {isConsonant ? 'consonant — restful' : 'dissonant — tense'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setRevealQuality(true)}
                  className="marking text-ink-3 transition-colors hover:text-ink"
                >
                  consonant or dissonant?
                </button>
              )}
            </div>
          )}
          {earIsRhythm && (
            <p className="mt-3 text-ink-2">
              The clicks before the bar are a count-in — they set the tempo and
              the metre before the rhythm plays.
            </p>
          )}
          {ear?.kind === 'progression' && (
            <p className="mt-3 text-ink-2">
              The first chord you hear is the tonic — judge each chord relative
              to it.
            </p>
          )}
          {earIsMelody && earRoot && (
            <p className="mt-3 text-ink-2">
              The tonic — <span className="font-mono text-ink">do</span> — is{' '}
              <span className="font-mono text-ink">
                {noteToString(earRoot.note)}
              </span>{' '}
              here. Solfège names each note's step from it.
            </p>
          )}
        </>
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
                {question.rhythmChoices ? (
                  <span className="flex-1">
                    <RhythmStaff
                      pattern={question.rhythmChoices[choiceIndex]}
                      meter={rhythmMeter}
                    />
                  </span>
                ) : (
                  <span className="flex-1 whitespace-pre-wrap font-mono text-[1.02rem] leading-relaxed text-ink">
                    {choiceText}
                  </span>
                )}
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

      {/* "I don't know" — an honest miss; reveals the answer and tells the SRS
          to bring this back soon. Shown until answered, or kept (red) if chosen. */}
      {(!answered || selected === DONT_KNOW) && (
        <button
          type="button"
          disabled={answered}
          onClick={onDontKnow}
          className={`mt-2.5 flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all duration-200 disabled:cursor-default ${
            selected === DONT_KNOW
              ? 'bg-wrong/10 ring-2 ring-wrong'
              : 'bg-card/50 ring-1 ring-rule hover:-translate-y-0.5 hover:bg-paper hover:ring-ink'
          }`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium ring-1 transition-colors duration-200 ${
              selected === DONT_KNOW
                ? 'bg-wrong text-card ring-wrong'
                : 'text-ink-3 ring-rule'
            }`}
          >
            {selected === DONT_KNOW ? '✕' : '0'}
          </span>
          <span
            className={`flex-1 ${selected === DONT_KNOW ? 'text-ink' : 'text-ink-2'}`}
          >
            I don’t know
          </span>
        </button>
      )}

      {answered ? (
        <div className="mt-7 border-t border-rule pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-display text-lg italic">
              {isCorrect ? (
                <span className="text-correct">Just so.</span>
              ) : earIsRhythm ? (
                <span className="text-wrong">
                  {timedOut ? 'Time’s up' : 'Not quite'} — it’s the highlighted bar.
                </span>
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
                  : earIsMelody
                    ? question.choices[question.answerIndex]
                        .split('–')
                        .map((s, i) =>
                          realized.target[i]
                            ? `${s} ${noteToString(realized.target[i][0].note)}`
                            : s,
                        )
                    : question.choices[question.answerIndex].split('–')
              }
            />
          )}
          {question.notation?.onReveal && (
            <Staff
              groups={question.notation.groups}
              clef={question.notation.clef}
              keySignature={question.notation.keySignature}
            />
          )}
          {!ear && question.keyboard && (
            <PianoKeyboard marks={question.keyboard.marks} />
          )}
          {!ear && question.circle && <CircleOfFifths major={question.circle.major} />}
          {!isCorrect && question.explanation && (
            <p className="ink mt-4 rounded-xl border border-rule bg-paper/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
              <span className="marking mr-1.5 text-accent">Remember</span>
              {question.explanation}
            </p>
          )}
        </div>
      ) : (
        <p className="marking mt-7 text-ink-3">
          Keys 1–{order.length} to answer · 0 = don’t know · Enter for next
        </p>
      )}
    </article>
  )
}
