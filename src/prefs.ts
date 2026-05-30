/**
 * Small remembered UI flags (booleans) in localStorage — e.g. whether an étude's
 * info box is collapsed. Keyed by an arbitrary string.
 */
const KEY = 'music-theory-ui'

function read(): Record<string, boolean> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, boolean>
    }
  } catch {
    /* corrupt/unavailable — treat as empty */
  }
  return {}
}

/** A remembered boolean flag, or `fallback` if none is stored. */
export function getBoolPref(key: string, fallback: boolean): boolean {
  const v = read()[key]
  return typeof v === 'boolean' ? v : fallback
}

/** Persist a boolean UI flag. */
export function setBoolPref(key: string, value: boolean): void {
  try {
    const all = read()
    all[key] = value
    globalThis.localStorage?.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable — no-op */
  }
}
