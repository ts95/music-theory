/**
 * Cross-device sync over Supabase. All network side-effects for progress live
 * here — `srs/store.ts` and `time.ts` stay pure (localStorage only); the React
 * layer calls into this module at the existing write choke points.
 *
 * Two payloads, two strategies:
 *  - SRS progress: one JSONB blob per user. On sign-in we pull + per-item merge
 *    (keep the more-practiced state) so neither device loses progress, then push
 *    the unified set. Subsequent grades push a debounced blob.
 *  - Practice time: a permanent per-(day, étude) log. Each device pushes only the
 *    *new* seconds since it last synced (a baseline kept in localStorage) via the
 *    additive `add_practice_seconds` RPC, so concurrent devices SUM without
 *    double-counting, and a failed push simply retries next flush.
 */

import type { SrsData } from '../contracts'
import { coerceSrsData, save } from '../srs'
import { getTodaySeconds, localDate } from '../time'
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './client'
import { mergeSrs } from './merge'

/** The signed-in user's id, or null. Set by the React session effect. */
let userId: string | null = null
/** Current access token, cached for the keepalive hide-flush. Kept fresh. */
let accessToken: string | null = null

export function setSyncUserId(id: string | null): void {
  userId = id
}

export function setSyncAccessToken(token: string | null): void {
  accessToken = token
}

// --- SRS progress ---------------------------------------------------------

/**
 * Pull the cloud blob. `failed` distinguishes a real fetch error (don't trust
 * it as "no data") from a genuinely absent row, so callers never overwrite the
 * cloud with local just because a read hiccuped.
 */
async function pullSrs(): Promise<{ data: SrsData | null; failed: boolean }> {
  if (!supabase || !userId) return { data: null, failed: false }
  const { data, error } = await supabase
    .from('srs_state')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { data: null, failed: true }
  return { data: data ? coerceSrsData(data.data) : null, failed: false }
}

async function upsertSrs(data: SrsData): Promise<void> {
  if (!supabase || !userId) return
  await supabase
    .from('srs_state')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
}

let srsTimer: ReturnType<typeof setTimeout> | null = null
let pendingSrs: SrsData | null = null

/** Debounced read-merge-write of the SRS blob (called after each grade). */
export function pushSrs(data: SrsData): void {
  if (!supabase || !userId) return
  pendingSrs = data
  if (srsTimer) return
  srsTimer = setTimeout(() => {
    srsTimer = null
    void flushSrs()
  }, 2500)
}

/**
 * Merge the pending local blob against the *current* cloud blob before writing,
 * so a stale tab's push can't clobber newer progress from another device. On a
 * read failure the pending write is kept and retried rather than risking a
 * blind overwrite.
 */
async function flushSrs(): Promise<void> {
  if (!supabase || !userId || !pendingSrs) return
  const local = pendingSrs
  const { data: remote, failed } = await pullSrs()
  if (failed) {
    pushSrs(local) // reschedule; don't overwrite a cloud we couldn't read
    return
  }
  pendingSrs = null
  await upsertSrs(remote ? mergeSrs(local, remote) : local)
}

// --- Practice time --------------------------------------------------------

const BASELINE_KEY = 'music-theory-sync-baseline'

interface Baseline {
  date: string
  /** Integer seconds already pushed to the cloud today, per étude. */
  seconds: Record<string, number>
}

function readBaseline(today: string): Baseline {
  try {
    const raw = globalThis.localStorage?.getItem(BASELINE_KEY)
    if (raw) {
      const b = JSON.parse(raw) as Baseline
      if (b?.date === today && b.seconds) return b
    }
  } catch {
    /* corrupt/unavailable */
  }
  return { date: today, seconds: {} }
}

function writeBaseline(b: Baseline): void {
  try {
    globalThis.localStorage?.setItem(BASELINE_KEY, JSON.stringify(b))
  } catch {
    /* no-op */
  }
}

/** Push the seconds accrued since the last flush as additive deltas. */
export async function flushPractice(): Promise<void> {
  if (!supabase || !userId) return
  const today = localDate()
  const local = getTodaySeconds(today)
  const baseline = readBaseline(today)
  for (const [etudeId, secs] of Object.entries(local)) {
    const pushed = baseline.seconds[etudeId] ?? 0
    const delta = Math.floor(secs) - pushed
    if (delta <= 0) continue
    const { error } = await supabase.rpc('add_practice_seconds', {
      p_day: today,
      p_etude: etudeId,
      p_secs: delta,
    })
    if (!error) baseline.seconds[etudeId] = pushed + delta
  }
  writeBaseline(baseline)
}

/**
 * Best-effort practice flush for page-hide/close. Uses `keepalive` fetch (which,
 * unlike `sendBeacon`, can carry the auth headers Supabase's RLS needs) so the
 * request survives the page being backgrounded or torn down. Synchronous: it
 * fires the requests and returns without awaiting. Advances the baseline
 * optimistically so a bfcache restore + later flush won't double-count; the
 * trade is losing the seconds if a request genuinely fails — unrecoverable at
 * unload anyway, and strictly better than the awaited flush, which gets killed.
 */
export function flushPracticeBeacon(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !userId || !accessToken) return
  const today = localDate()
  const local = getTodaySeconds(today)
  const baseline = readBaseline(today)
  const endpoint = `${SUPABASE_URL}/rest/v1/rpc/add_practice_seconds`
  let dirty = false
  for (const [etudeId, secs] of Object.entries(local)) {
    const pushed = baseline.seconds[etudeId] ?? 0
    const delta = Math.floor(secs) - pushed
    if (delta <= 0) continue
    void fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_day: today, p_etude: etudeId, p_secs: delta }),
    }).catch(() => {})
    baseline.seconds[etudeId] = pushed + delta
    dirty = true
  }
  if (dirty) writeBaseline(baseline)
}

let practiceTimer: ReturnType<typeof setTimeout> | null = null

/** Coalesce frequent timer ticks into one flush every ~10 s. */
export function schedulePracticeFlush(): void {
  if (!supabase || !userId || practiceTimer) return
  practiceTimer = setTimeout(() => {
    practiceTimer = null
    void flushPractice()
  }, 10_000)
}

/** Today's cloud totals per étude (summed across all devices), for display. */
export async function pullPracticeToday(): Promise<Record<string, number>> {
  if (!supabase || !userId) return {}
  const { data, error } = await supabase
    .from('practice_time')
    .select('etude_id, seconds')
    .eq('user_id', userId)
    .eq('day', localDate())
  if (error || !data) return {}
  const out: Record<string, number> = {}
  for (const row of data) out[row.etude_id as string] = row.seconds as number
  return out
}

// --- Orchestration --------------------------------------------------------

/**
 * Run on sign-in: pull + merge SRS into local, push the unified set (this also
 * migrates a brand-new account's existing local progress up), and flush any
 * practice time this device accrued before signing in. Returns the merged SRS
 * data so the UI can adopt it.
 */
export async function syncOnSignIn(local: SrsData): Promise<SrsData> {
  if (!supabase || !userId) return local
  const { data: remote, failed } = await pullSrs()
  const merged = remote ? mergeSrs(local, remote) : local
  save(merged)
  // If the pull failed we can't safely push (we might clobber a cloud blob we
  // just couldn't read); adopt local, leave the cloud, retry on the next grade.
  if (!failed) await upsertSrs(merged)
  await flushPractice()
  return merged
}

/**
 * Clear a (or every) étude's practice-time sync state for today: drop the local
 * per-device baseline so accrual resumes from zero, and delete today's cloud
 * row(s) so the reset is reflected across devices. Without resetting the
 * baseline, a local reset would make the delta go negative and silently stop
 * syncing for the rest of the day.
 */
export function resetPracticeSync(etudeId?: string): void {
  const today = localDate()
  const baseline = readBaseline(today)
  if (etudeId) delete baseline.seconds[etudeId]
  else baseline.seconds = {}
  writeBaseline(baseline)
  void clearCloudPractice(today, etudeId)
}

async function clearCloudPractice(today: string, etudeId?: string): Promise<void> {
  if (!supabase || !userId) return
  let q = supabase
    .from('practice_time')
    .delete()
    .eq('user_id', userId)
    .eq('day', today)
  if (etudeId) q = q.eq('etude_id', etudeId)
  await q
}

/**
 * Flush everything pending and detach the user — call before signing out so the
 * last grade and the last few seconds of practice aren't lost to the debounce
 * timers (which would no-op once the user is null).
 */
export async function flushOnSignOut(): Promise<void> {
  if (srsTimer) {
    clearTimeout(srsTimer)
    srsTimer = null
  }
  if (practiceTimer) {
    clearTimeout(practiceTimer)
    practiceTimer = null
  }
  await flushSrs()
  await flushPractice()
  userId = null
  accessToken = null
}
