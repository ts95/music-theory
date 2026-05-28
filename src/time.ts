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
