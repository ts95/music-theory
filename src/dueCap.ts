/**
 * Per-étude "batch" cap: at most DUE_CAP due exercises every WINDOW_MS, so no
 * single étude feels overwhelming. Tracks, per étude, how many due items have
 * been answered in the current rolling window (anchored at the first answer
 * after a reset); persisted to localStorage, lazily reset like time.ts.
 */
const KEY = 'music-theory-due-cap'
export const DUE_CAP = 10
const WINDOW_MS = 5 * 60 * 60 * 1000 // 5 hours

interface Window {
  start: number
  served: number
}

function read(): Record<string, Window> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, Window>
    }
  } catch {
    /* corrupt/unavailable — treat as empty */
  }
  return {}
}

function write(all: Record<string, Window>): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable — no-op */
  }
}

const expired = (w: Window | undefined, now: number): boolean =>
  !w || now - w.start >= WINDOW_MS

/** How many more due exercises this étude may serve in the current window. */
export function remainingDue(etudeId: string, now: number = Date.now()): number {
  const w = read()[etudeId]
  if (expired(w, now)) return DUE_CAP
  return Math.max(0, DUE_CAP - w!.served)
}

/** Record one answered due exercise (starting a fresh window if needed). */
export function recordDue(etudeId: string, now: number = Date.now()): void {
  const all = read()
  const w = expired(all[etudeId], now) ? { start: now, served: 0 } : all[etudeId]
  w.served += 1
  all[etudeId] = w
  write(all)
}

/** When the current window resets (epoch ms), or null if not in an active window. */
export function windowResetAt(
  etudeId: string,
  now: number = Date.now()
): number | null {
  const w = read()[etudeId]
  return expired(w, now) ? null : w!.start + WINDOW_MS
}
