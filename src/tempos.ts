/**
 * Remembers the practice tempo (BPM) last chosen for each (étude, level), in
 * localStorage, so the tap-along slider persists across visits. Keyed by
 * `etudeId\tlevel`; returns null when nothing is saved (callers supply a default).
 */
const KEY = 'music-theory-tempos'
const SEP = '\t'

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

/** The saved tempo for an (étude, level), or null if none. */
export function getSavedTempo(etudeId: string, level: number): number | null {
  const v = read()[`${etudeId}${SEP}${level}`]
  return typeof v === 'number' ? v : null
}

/** Persist the chosen tempo for an (étude, level). */
export function saveTempo(etudeId: string, level: number, tempo: number): void {
  try {
    const all = read()
    all[`${etudeId}${SEP}${level}`] = tempo
    globalThis.localStorage?.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable — no-op */
  }
}
