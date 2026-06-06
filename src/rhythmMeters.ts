/**
 * Remembers which time signatures the user has selected to practice for each
 * rhythm étude (étude, level), in localStorage, so a session only serves the
 * chosen meters. Keyed by `etudeId\tlevel`; a missing entry means "no choice
 * saved" and callers fall back to all of that level's available meters.
 *
 * Each entry carries an `updatedAt` so the cloud sync layer (`supabase/sync.ts`)
 * can reconcile two devices per key (last-write-wins). This module is pure —
 * localStorage only, no network — like `tempos.ts` / `levels.ts`.
 */
import type { TimeSig } from './contracts'

const KEY = 'music-theory-rhythm-meters'
const SEP = '\t'

/** One saved selection: the chosen meters plus when it was last changed. */
export interface RhythmMetersEntry {
  meters: TimeSig[]
  updatedAt: number
}

/** The whole store: per-`etudeId\tlevel` selection. Also the synced blob value. */
export type RhythmMetersStore = Record<string, RhythmMetersEntry>

function isEntry(v: unknown): v is RhythmMetersEntry {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as RhythmMetersEntry).meters) &&
    typeof (v as RhythmMetersEntry).updatedAt === 'number'
  )
}

function read(): RhythmMetersStore {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        const out: RhythmMetersStore = {}
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (isEntry(v)) out[k] = v
        }
        return out
      }
    }
  } catch {
    /* corrupt/unavailable — treat as empty */
  }
  return {}
}

function write(store: RhythmMetersStore): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(store))
  } catch {
    /* storage unavailable — no-op */
  }
}

/** The saved meter selection for an (étude, level), or null if none. */
export function getSavedMeters(etudeId: string, level: number): TimeSig[] | null {
  const e = read()[`${etudeId}${SEP}${level}`]
  return e ? e.meters : null
}

/** Persist the chosen meters for an (étude, level), stamped now. */
export function saveMeters(etudeId: string, level: number, meters: TimeSig[]): void {
  const store = read()
  store[`${etudeId}${SEP}${level}`] = { meters, updatedAt: Date.now() }
  write(store)
}

// --- Sync helpers ---------------------------------------------------------

/** The full local store, for the cloud push. */
export function getAllRhythmMeters(): RhythmMetersStore {
  return read()
}

/** Overwrite the local store (after a cloud merge has been computed). */
export function replaceAllRhythmMeters(store: RhythmMetersStore): void {
  write(store)
}

/**
 * Per-key union of two stores, keeping the more-recently-updated selection for
 * each (étude, level). Pure — mirrors `supabase/merge.ts`'s `mergeSrs`.
 */
export function mergeRhythmMeters(
  local: RhythmMetersStore,
  remote: RhythmMetersStore,
): RhythmMetersStore {
  const out: RhythmMetersStore = { ...local }
  for (const [k, r] of Object.entries(remote)) {
    const l = out[k]
    out[k] = !l || r.updatedAt > l.updatedAt ? r : l
  }
  return out
}
