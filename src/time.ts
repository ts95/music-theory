/**
 * Per-étude practice time for the current day, persisted to localStorage. Only
 * today is kept: any read/write that finds a stored date other than `today`
 * starts fresh, so the counters reset at local midnight with no background
 * timer. The `today` argument is injectable for testing.
 */

const KEY = 'music-theory-practice-time'

interface DayTime {
  date: string
  seconds: Record<string, number>
}

/** Local-timezone date as 'YYYY-MM-DD'. */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function read(): DayTime | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DayTime
    if (typeof parsed?.date === 'string' && parsed.seconds && typeof parsed.seconds === 'object') {
      return parsed
    }
  } catch {
    /* corrupt/unavailable — treated as empty */
  }
  return null
}

function write(data: DayTime): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable — no-op */
  }
}

/** Human-readable minutes, e.g. "12 min", "<1 min", "0 min". */
export function formatMinutes(seconds: number): string {
  if (seconds >= 60) return `${Math.floor(seconds / 60)} min`
  return seconds > 0 ? '<1 min' : '0 min'
}

/** Today's accumulated seconds per étude (resets if the stored day rolled over). */
export function getTodaySeconds(today: string = localDate()): Record<string, number> {
  const stored = read()
  return stored && stored.date === today ? stored.seconds : {}
}

/** Add `secs` to an étude's total for today, resetting first if the day changed. */
export function addSeconds(
  etudeId: string,
  secs: number,
  today: string = localDate()
): void {
  if (secs <= 0) return
  const stored = read()
  const seconds =
    stored && stored.date === today ? { ...stored.seconds } : {}
  seconds[etudeId] = (seconds[etudeId] ?? 0) + secs
  write({ date: today, seconds })
}

/** Clear one étude's practice time for today. */
export function resetEtudeSeconds(etudeId: string, today: string = localDate()): void {
  const stored = read()
  const seconds = stored && stored.date === today ? { ...stored.seconds } : {}
  delete seconds[etudeId]
  write({ date: today, seconds })
}

/** Clear all practice time for today. */
export function resetAllSeconds(today: string = localDate()): void {
  write({ date: today, seconds: {} })
}

// ---------------------------------------------------------------------------
// Answer tally (accuracy) — a parallel today-only store, same midnight reset.
// ---------------------------------------------------------------------------

const ANSWERS_KEY = 'music-theory-practice-answers'

export interface AnswerTally {
  answered: number
  correct: number
}

interface DayAnswers {
  date: string
  answers: Record<string, AnswerTally>
}

function readAnswers(): DayAnswers | null {
  try {
    const raw = globalThis.localStorage?.getItem(ANSWERS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DayAnswers
    if (typeof parsed?.date === 'string' && parsed.answers && typeof parsed.answers === 'object') {
      return parsed
    }
  } catch {
    /* corrupt/unavailable — treated as empty */
  }
  return null
}

function writeAnswers(data: DayAnswers): void {
  try {
    globalThis.localStorage?.setItem(ANSWERS_KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable — no-op */
  }
}

/** Today's answered/correct tally per étude (resets if the stored day rolled over). */
export function getTodayAnswers(today: string = localDate()): Record<string, AnswerTally> {
  const stored = readAnswers()
  return stored && stored.date === today ? stored.answers : {}
}

/** Record one graded answer for an étude (answered +1, correct +1 if right). */
export function addAnswer(
  etudeId: string,
  correct: boolean,
  today: string = localDate()
): void {
  const stored = readAnswers()
  const answers = stored && stored.date === today ? { ...stored.answers } : {}
  const prev = answers[etudeId] ?? { answered: 0, correct: 0 }
  answers[etudeId] = {
    answered: prev.answered + 1,
    correct: prev.correct + (correct ? 1 : 0),
  }
  writeAnswers({ date: today, answers })
}

/** Clear one étude's answer tally for today. */
export function resetEtudeAnswers(etudeId: string, today: string = localDate()): void {
  const stored = readAnswers()
  const answers = stored && stored.date === today ? { ...stored.answers } : {}
  delete answers[etudeId]
  writeAnswers({ date: today, answers })
}

/** Clear all answer tallies for today. */
export function resetAllAnswers(today: string = localDate()): void {
  writeAnswers({ date: today, answers: {} })
}
