/**
 * Persistence for the SRS engine: localStorage load/save plus JSON
 * export/import. The only module allowed to touch localStorage.
 */

import type { SrsData, SrsState } from '../contracts'

export const STORAGE_KEY = 'music-theory-srs'
export const SCHEMA_VERSION = 1

function fresh(): SrsData {
  return { version: SCHEMA_VERSION, items: {} }
}

function isSrsState(value: unknown): value is SrsState {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.ease === 'number' &&
    typeof s.intervalDays === 'number' &&
    typeof s.reps === 'number' &&
    typeof s.dueAt === 'number'
  )
}

function isSrsData(value: unknown): value is SrsData {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  if (d.version !== SCHEMA_VERSION) return false
  if (typeof d.items !== 'object' || d.items === null) return false
  return Object.values(d.items).every(isSrsState)
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
    const parsed: unknown = JSON.parse(raw)
    return isSrsData(parsed) ? parsed : fresh()
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

/** Pretty-printed (2-space) JSON for download. */
export function exportJson(data: SrsData): string {
  return JSON.stringify(data, null, 2)
}

/** Parse + validate an imported JSON string. Throws on invalid shape/version. */
export function importJson(json: string): SrsData {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON: could not parse.')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid SRS data: expected an object.')
  }
  const d = parsed as Record<string, unknown>
  if (d.version !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported SRS version: expected ${SCHEMA_VERSION}, got ${String(d.version)}.`,
    )
  }
  if (typeof d.items !== 'object' || d.items === null) {
    throw new Error('Invalid SRS data: "items" must be an object.')
  }
  if (!Object.values(d.items).every(isSrsState)) {
    throw new Error('Invalid SRS data: one or more items are malformed.')
  }
  return parsed as SrsData
}

export function getState(data: SrsData, id: string): SrsState | undefined {
  return data.items[id]
}

/** Set an item's state, returning a new SrsData (immutable update). */
export function setState(data: SrsData, id: string, state: SrsState): SrsData {
  return { ...data, items: { ...data.items, [id]: state } }
}
