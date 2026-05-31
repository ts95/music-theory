/**
 * Persistence for the SRS engine: localStorage load/save plus JSON
 * export/import. The only module allowed to touch localStorage.
 */

import type { SrsData, SrsState } from '../contracts'

export const STORAGE_KEY = 'music-theory-srs'
export const SCHEMA_VERSION = 2

const MS_PER_DAY = 86_400_000

function fresh(): SrsData {
  return { version: SCHEMA_VERSION, items: {} }
}

/** The pre-v2 per-item shape (no `updatedAt`). */
function isV1State(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.ease === 'number' &&
    typeof s.intervalDays === 'number' &&
    typeof s.reps === 'number' &&
    typeof s.dueAt === 'number'
  )
}

function isSrsState(value: unknown): value is SrsState {
  return isV1State(value) && typeof (value as SrsState).updatedAt === 'number'
}

/**
 * Coerce any stored/imported blob to current-version `SrsData`, or null if it's
 * unrecognizable. v1 → v2 reconstructs each item's last-review time from
 * `dueAt − intervalDays` (exactly the `now` at which it was graded).
 */
function migrate(value: unknown): SrsData | null {
  if (typeof value !== 'object' || value === null) return null
  const d = value as Record<string, unknown>
  if (typeof d.items !== 'object' || d.items === null) return null
  const entries = Object.entries(d.items as Record<string, unknown>)

  if (d.version === SCHEMA_VERSION) {
    return entries.every(([, s]) => isSrsState(s)) ? (value as SrsData) : null
  }
  if (d.version === 1) {
    if (!entries.every(([, s]) => isV1State(s))) return null
    const items: Record<string, SrsState> = {}
    for (const [id, s] of entries) {
      const v1 = s as Omit<SrsState, 'updatedAt'>
      items[id] = { ...v1, updatedAt: v1.dueAt - v1.intervalDays * MS_PER_DAY }
    }
    return { version: SCHEMA_VERSION, items }
  }
  return null
}

/** Validate/upgrade an arbitrary value to current `SrsData`, or null if invalid. */
export function coerceSrsData(value: unknown): SrsData | null {
  return migrate(value)
}

/** Read + parse localStorage. Never throws; returns fresh data on any problem. */
export function load(): SrsData {
  let raw: string | null
  try {
    raw = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return fresh()
  }
  if (raw === null) return fresh()
  try {
    return migrate(JSON.parse(raw)) ?? fresh()
  } catch {
    return fresh()
  }
}

/** Write data to localStorage. No-ops if storage is unavailable. */
export function save(data: SrsData): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage unavailable (e.g. private mode) — degrade gracefully
  }
}

export function getState(data: SrsData, id: string): SrsState | undefined {
  return data.items[id]
}

/** Set an item's state, returning a new SrsData (immutable update). */
export function setState(data: SrsData, id: string, state: SrsState): SrsData {
  return { ...data, items: { ...data.items, [id]: state } }
}
