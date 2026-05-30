import { useEffect, useMemo, useRef, useState } from 'react'
import type { Question, SrsData } from '../contracts'
import { getState, grade, initialState, isDue, save, setState } from '../srs'
import { remainingDue, recordDue, windowResetAt } from '../dueCap'
import QuestionCard from './QuestionCard'
import Button from './Button'

const CORRECT_QUALITY = 5
const INCORRECT_QUALITY = 2
// An explicit "I don't know" is a stronger lapse than a wrong guess — grade 0
// drops the ease the most, so the item resurfaces sooner and for longer.
const DONT_KNOW_QUALITY = 0
// Sentinel `selected` value meaning the user pressed "I don't know".
const DONT_KNOW = -1

/** Sudden-death answer-timer limit (ms) per category; absent ⇒ untimed. */
const TIMED_LIMITS: Record<string, number> = {
  'Relative minor': 5000,
  'Diatonic chord': 5000,
  // Reading a staff with inversions/extensions takes longer.
  'Chord recognition': 10000,
  // Working out a Roman-numeral progression needs a bit more thinking time.
  Progression: 15000,
}

interface ReviewSessionProps {
  /** The questions to study this session (already scoped to one étude). */
  bank: Question[]
  /** The étude id, for the per-étude due-batch cap. */
  etudeId: string
  /** The current SRS store, owned by App (so import/export stay in sync). */
  data: SrsData
  /** Persist + lift store changes back to App. */
  onDataChange: (data: SrsData) => void
  /** The id of the question currently shown (null on the summary), for the timer. */
  onQuestionChange?: (questionId: string | null) => void
}

/** The due questions (presentation order is randomized later, see `shuffle`). */
function dueQueue(bank: Question[], data: SrsData, now: number): Question[] {
  return bank.filter((q) => isDue(getState(data, q.id) ?? initialState(now), now))
}

/**
 * Fisher–Yates shuffle (returns a new array). The session order is randomized so
 * it can't be memorized by position — fresh items otherwise tie on dueAt and
 * fall back to the fixed generation order (by key, scale type, hand…).
 */
function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The soonest dueAt across all items (for the "next review" hint). */
function soonestDueAt(bank: Question[], data: SrsData, now: number): number {
  return Math.min(
    ...bank.map((q) => (getState(data, q.id) ?? initialState(now)).dueAt),
  )
}

/** Human-readable "in about ..." from now to a future epoch ms. */
function formatRelative(dueAt: number, now: number): string {
  const ms = dueAt - now
  if (ms <= 0) return 'now'
  const hours = ms / 3_600_000
  if (hours < 1) return 'in less than an hour'
  if (hours < 24) {
    const h = Math.round(hours)
    return `in about ${h} hour${h === 1 ? '' : 's'}`
  }
  const days = Math.round(hours / 24)
  if (days === 1) return 'tomorrow'
  return `in about ${days} days`
}

export default function ReviewSession({
  bank,
  etudeId,
  data,
  onDataChange,
  onQuestionChange,
}: ReviewSessionProps) {
  // A "queue token" lets us rebuild the queue on demand (start/restart).
  const [queueToken, setQueueToken] = useState(0)
  // null queue means we're showing the due session built from current `data`.
  // A non-null override is an explicit "practice anyway" set.
  const [practiceAll, setPracticeAll] = useState(false)

  // Build the queue once per (re)start, snapshotting due items at that moment
  // and shuffling so the order can't be memorized.
  const queue = useMemo(() => {
    const now = Date.now()
    if (practiceAll) return shuffle(bank) // explicit override — uncapped
    // Cap a due session to this étude's remaining batch allowance.
    return shuffle(dueQueue(bank, data, now)).slice(0, remainingDue(etudeId, now))
    // queueToken forces a rebuild (and reshuffle) when the user restarts a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank, queueToken, practiceAll])

  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  // True when the current question's timer expired before an answer.
  const [timedOut, setTimedOut] = useState(false)
  const [answered, setAnswered] = useState(0)
  const [correct, setCorrect] = useState(0)

  // Grading must always use the CURRENT stored state, not a stale snapshot.
  const dataRef = useRef(data)
  dataRef.current = data

  function startSession(all: boolean) {
    setPracticeAll(all)
    setQueueToken((t) => t + 1)
    setIndex(0)
    setSelected(null)
    setTimedOut(false)
    setAnswered(0)
    setCorrect(0)
  }

  /** Grade the current question and persist. `quality` per SM-2. */
  function resolve(q: Question, quality: number) {
    const current = getState(dataRef.current, q.id) ?? initialState(Date.now())
    const next = grade(current, quality, Date.now())
    const updated = setState(dataRef.current, q.id, next)
    save(updated)
    onDataChange(updated)
    // Each answered due exercise counts against the étude's 5-hour batch.
    if (!practiceAll) recordDue(etudeId, Date.now())
  }

  function handleSelect(choiceIndex: number) {
    if (selected !== null || timedOut) return
    const q = queue[index]
    const wasCorrect = choiceIndex === q.answerIndex
    setSelected(choiceIndex)
    setAnswered((n) => n + 1)
    if (wasCorrect) setCorrect((n) => n + 1)
    resolve(q, wasCorrect ? CORRECT_QUALITY : INCORRECT_QUALITY)
  }

  /** "I don't know" → a lapse with the strongest resurfacing signal. */
  function handleDontKnow() {
    if (selected !== null || timedOut) return
    setSelected(DONT_KNOW)
    setAnswered((n) => n + 1)
    resolve(queue[index], DONT_KNOW_QUALITY)
  }

  /** Timer expired with no answer → counts as incorrect (an SRS lapse). */
  function handleTimeout() {
    if (selected !== null || timedOut) return
    setTimedOut(true)
    setAnswered((n) => n + 1)
    resolve(queue[index], INCORRECT_QUALITY)
  }

  function handleNext() {
    setSelected(null)
    setTimedOut(false)
    setIndex((i) => i + 1)
  }

  const total = queue.length
  const finished = index >= total

  // Tell the timer which exercise is showing (null on the summary) so it can
  // cap counted time per question.
  const currentId = finished ? null : (queue[index]?.id ?? null)
  useEffect(() => {
    onQuestionChange?.(currentId)
  }, [currentId, onQuestionChange])

  if (!finished) {
    const q = queue[index]
    const resolved = selected !== null || timedOut
    const progress = total > 0 ? ((index + (resolved ? 1 : 0)) / total) * 100 : 0
    const timeLimitMs = TIMED_LIMITS[q.category]
    return (
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="marking text-ink-2">
            <span className="font-mono text-sm font-semibold text-ink">
              {index + 1}
            </span>
            <span className="mx-1.5 text-ink-3">/</span>
            <span className="font-mono text-sm">{total}</span>
          </div>
          <div className="marking text-ink-3">
            <span className="text-correct">✓ {correct}</span>
            <span className="mx-1.5">·</span>
            <span className="font-mono">{answered}</span> answered
          </div>
        </div>
        {/* progress hairline */}
        <div className="h-px w-full bg-rule">
          <div
            className="h-px bg-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <QuestionCard
          key={q.id}
          question={q}
          selected={selected}
          timedOut={timedOut}
          timeLimitMs={timeLimitMs}
          onSelect={handleSelect}
          onDontKnow={handleDontKnow}
          onNext={handleNext}
          onTimeout={handleTimeout}
        />
      </div>
    )
  }

  // ---- Session summary / caught-up state -------------------------------
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
  const now = Date.now()
  const moreDue = dueQueue(bank, data, now).length
  const nextDue = soonestDueAt(bank, data, now)
  // How many of those are still allowed in this window, and when the cap lifts.
  const allowed = Math.min(moreDue, remainingDue(etudeId, now))
  const resetAt = windowResetAt(etudeId, now)
  const cappedOut = moreDue > 0 && allowed === 0

  return (
    <article className="rise relative overflow-hidden rounded-3xl border border-rule bg-card px-6 py-12 text-center shadow-[0_22px_60px_-32px_rgba(33,28,21,0.5)] sm:px-10 sm:py-14">
      {/* "Fine." — the marking that closes a score, with a fermata above. */}
      <p aria-hidden className="font-display text-3xl leading-none text-ink-3">
        𝄐
      </p>
      <h2 className="mt-1 font-display text-5xl italic tracking-[-0.02em] text-ink">
        {answered > 0 ? 'Fine.' : 'Tacet.'}
      </h2>

      {answered > 0 && (
        <p className="mt-4 text-ink-2">
          You answered <span className="font-mono text-ink">{answered}</span>{' '}
          {answered === 1 ? 'question' : 'questions'} —{' '}
          <span className="font-mono text-correct">{correct}</span> correct
          <span className="mx-1 text-ink-3">·</span>
          <span className="font-mono text-ink">{accuracy}%</span> accuracy.
        </p>
      )}

      <p className="marking mt-3 text-ink-3">
        {allowed > 0
          ? `${allowed} item${allowed === 1 ? '' : 's'} still due`
          : cappedOut && resetAt
            ? `Batch done — next batch ${formatRelative(resetAt, now)}`
            : `Next review ${formatRelative(nextDue, now)}`}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {allowed > 0 && (
          <Button onClick={() => startSession(false)}>Study again</Button>
        )}
        <Button variant="secondary" onClick={() => startSession(true)}>
          Practice anyway
        </Button>
      </div>
    </article>
  )
}
