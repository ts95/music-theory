/**
 * Pure SRS reconciliation — no client, no I/O, so it's unit-testable in
 * isolation. `sync.ts` owns the network; this owns the conflict resolution.
 */

import type { SrsData, SrsState } from '../contracts'

function mergeState(a: SrsState, b: SrsState): SrsState {
  // Most-recently-reviewed wins, so a fresh lapse is never overwritten by a
  // stale "I knew it". Deterministic tie-break on the later due date keeps the
  // merge symmetric regardless of argument order (matters for equal/legacy ts).
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  return a.dueAt >= b.dueAt ? a : b
}

/** Per-item union of two SRS blobs, keeping the more-recent state for each id. */
export function mergeSrs(local: SrsData, remote: SrsData): SrsData {
  const items: Record<string, SrsState> = { ...local.items }
  for (const [id, r] of Object.entries(remote.items)) {
    const l = items[id]
    items[id] = l ? mergeState(l, r) : r
  }
  return { version: local.version, items }
}
