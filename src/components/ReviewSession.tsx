import { useMemo, useRef, useState } from 'react'
import type { Question, SrsData } from '../contracts'
import { getState, grade, initialState, isDue, save, setState } from '../srs'
import QuestionCard from './QuestionCard'
import Button from './Button'

const CORRECT_QUALITY = 5
const INCORRECT_QUALITY = 2

/** Categories with a sudden-death answer timer, and the limit. */
const TIMED_CATEGORIES = new Set(['Relative minor', 'Diatonic chord'])
const TIME_LIMIT_MS = 5000

interface ReviewSessionProps {
  /** The questions to study this session (already scoped to one étude). */
  bank: Question[]
  /** The current SRS store, owned by App (so import/export stay in sync). */
  data: SrsData
  /** Persist + lift store changes back to App. */
  onDataChange: (data: SrsData) => void
}

/** Build the due queue: due questions sorted by dueAt ascending. */
function dueQueue(bank: Question[], data: SrsData, now: number): Question[] {
  return bank
    .filter((q) => isDue(getState(data, q.id) ?? initialState(now), now))
    .sort((a, b) => {
      const da = (getState(data, a.id) ?? initialState(now)).dueAt
      const db = (getState(data, b.id) ?? initialState(now)).dueAt
      return da - db
    })
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
  data,
  onDataChange,
}: ReviewSessionProps) {
  // A "queue token" lets us rebuild the queue on demand (start/restart).
  const [queueToken, setQueueToken] = useState(0)
  // null queue means we're showing the due session built from current `data`.
  // A non-null override is an explicit "practice anyway" set.
  const [practiceAll, setPracticeAll] = useState(false)

  // Build the queue once per (re)start, snapshotting due items at that moment.
  const queue = useMemo(() => {
    const now = Date.now()
    return practiceAll ? [...bank] : dueQueue(bank, data, now)
    // queueToken forces a rebuild when the user restarts a session.
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

  if (!finished) {
    const q = queue[index]
    const resolved = selected !== null || timedOut
    const progress = total > 0 ? ((index + (resolved ? 1 : 0)) / total) * 100 : 0
    const timeLimitMs = TIMED_CATEGORIES.has(q.category)
      ? TIME_LIMIT_MS
      : undefined
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
        {moreDue > 0
          ? `${moreDue} item${moreDue === 1 ? '' : 's'} still due`
          : `Next review ${formatRelative(nextDue, now)}`}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {moreDue > 0 && (
          <Button onClick={() => startSession(false)}>Study again</Button>
        )}
        <Button variant="secondary" onClick={() => startSession(true)}>
          Practice anyway
        </Button>
      </div>
    </article>
  )
}
