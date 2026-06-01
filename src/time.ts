/**
 * Per-(étude, level, version) practice time and answer tally for the current
 * day, persisted to localStorage. Only today is kept: any read/write that finds
 * a stored date other than `today` starts fresh, so counters reset at local
 * midnight with no background timer. The `today` argument is injectable for
 * testing.
 *
 * Records are keyed by (étude, difficulty level, étude version) so the practice
 * history can attribute time/accuracy to a specific level + content version.
 * Display accessors (`getTodaySeconds`) still aggregate per étude; the sync
 * layer uses the `*ByLevel` accessors to push each dimension separately. Level 0
 * means the étude has no difficulty selector (no `levels` array); études with a
 * selector use a 1-based level. Legacy plain-étude keys parse as level 0 / version 1.
 */

const KEY = 'music-theory-practice-time'
const ANSWERS_KEY = 'music-theory-practice-answers'
const SEP = '\t' // separator: never present in étude ids or numeric level/version

/** Stable composite key for a (étude, level, version) record. */
export function practiceKey(etudeId: string, level: number, version: number): string {
  return `${etudeId}${SEP}${level}${SEP}${version}`
}

function parseKey(key: string): { etudeId: string; level: number; version: number } {
  const parts = key.split(SEP)
  return {
    etudeId: parts[0],
    level: Number(parts[1]) || 0,
    version: Number(parts[2]) || 1,
  }
}

/** Local-timezone date as 'YYYY-MM-DD'. */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Human-readable minutes, e.g. "12 min", "<1 min", "0 min". */
export function formatMinutes(seconds: number): string {
  if (seconds >= 60) return `${Math.floor(seconds / 60)} min`
  return seconds > 0 ? '<1 min' : '0 min'
}

// --- generic today-only Record<compositeKey, T> store -----------------------

interface DayStore<T> {
  date: string
  values: Record<string, T>
}

function read<T>(storageKey: string): DayStore<T> | null {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DayStore<T>
    if (typeof parsed?.date === 'string' && parsed.values && typeof parsed.values === 'object') {
      return parsed
    }
  } catch {
    /* corrupt/unavailable — treated as empty */
  }
  return null
}

function write<T>(storageKey: string, data: DayStore<T>): void {
  try {
    globalThis.localStorage?.setItem(storageKey, JSON.stringify(data))
  } catch {
    /* storage unavailable — no-op */
  }
}

function todayValues<T>(storageKey: string, today: string): Record<string, T> {
  const stored = read<T>(storageKey)
  return stored && stored.date === today ? { ...stored.values } : {}
}

function deleteEtude<T>(storageKey: string, etudeId: string, today: string): void {
  const values = todayValues<T>(storageKey, today)
  for (const key of Object.keys(values)) {
    if (parseKey(key).etudeId === etudeId) delete values[key]
  }
  write(storageKey, { date: today, values })
}

// --- practice time ----------------------------------------------------------

export interface SecondsEntry {
  etudeId: string
  level: number
  version: number
  seconds: number
}

/** Today's seconds aggregated per étude (across all levels/versions). */
export function getTodaySeconds(today: string = localDate()): Record<string, number> {
  const values = todayValues<number>(KEY, today)
  const out: Record<string, number> = {}
  for (const [key, secs] of Object.entries(values)) {
    const { etudeId } = parseKey(key)
    out[etudeId] = (out[etudeId] ?? 0) + secs
  }
  return out
}

/** Today's seconds broken out by (étude, level, version), for sync. */
export function getTodaySecondsByLevel(today: string = localDate()): SecondsEntry[] {
  const values = todayValues<number>(KEY, today)
  return Object.entries(values).map(([key, seconds]) => ({ ...parseKey(key), seconds }))
}

/** Add `secs` to a (étude, level, version) total for today. */
export function addSeconds(
  etudeId: string,
  secs: number,
  level: number,
  version: number,
  today: string = localDate()
): void {
  if (secs <= 0) return
  const values = todayValues<number>(KEY, today)
  const key = practiceKey(etudeId, level, version)
  values[key] = (values[key] ?? 0) + secs
  write(KEY, { date: today, values })
}

/** Clear one étude's practice time for today (all levels/versions). */
export function resetEtudeSeconds(etudeId: string, today: string = localDate()): void {
  deleteEtude<number>(KEY, etudeId, today)
}

/** Clear all practice time for today. */
export function resetAllSeconds(today: string = localDate()): void {
  write<number>(KEY, { date: today, values: {} })
}

// --- answer tally (accuracy) ------------------------------------------------

interface AnswerTally {
  answered: number
  correct: number
}

export interface AnswerEntry extends AnswerTally {
  etudeId: string
  level: number
  version: number
}

/** Today's answered/correct broken out by (étude, level, version), for sync. */
export function getTodayAnswersByLevel(today: string = localDate()): AnswerEntry[] {
  const values = todayValues<AnswerTally>(ANSWERS_KEY, today)
  return Object.entries(values).map(([key, tally]) => ({ ...parseKey(key), ...tally }))
}

/** Record one graded answer (answered +1, correct +1 if right). */
export function addAnswer(
  etudeId: string,
  correct: boolean,
  level: number,
  version: number,
  today: string = localDate()
): void {
  const values = todayValues<AnswerTally>(ANSWERS_KEY, today)
  const key = practiceKey(etudeId, level, version)
  const prev = values[key] ?? { answered: 0, correct: 0 }
  values[key] = {
    answered: prev.answered + 1,
    correct: prev.correct + (correct ? 1 : 0),
  }
  write(ANSWERS_KEY, { date: today, values })
}

/** Clear one étude's answer tally for today (all levels/versions). */
export function resetEtudeAnswers(etudeId: string, today: string = localDate()): void {
  deleteEtude<AnswerTally>(ANSWERS_KEY, etudeId, today)
}

/** Clear all answer tallies for today. */
export function resetAllAnswers(today: string = localDate()): void {
  write<AnswerTally>(ANSWERS_KEY, { date: today, values: {} })
}
