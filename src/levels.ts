/**
 * Remembers the difficulty level last chosen for each étude, in localStorage, so
 * it persists across visits. Keyed by étude id; defaults to level 1.
 */
const KEY = 'music-theory-levels'

function read(): Record<string, number> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, number>
    }
  } catch {
    /* corrupt/unavailable — treat as empty */
  }
  return {}
}

/** The saved 1-based level for an étude (1 if none saved). */
export function getSavedLevel(etudeId: string): number {
  const v = read()[etudeId]
  return typeof v === 'number' && v >= 1 ? v : 1
}

/** Persist the chosen level for an étude. */
export function saveLevel(etudeId: string, level: number): void {
  try {
    const all = read()
    all[etudeId] = level
    globalThis.localStorage?.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable — no-op */
  }
}
