import type { RhythmEvent, TimeSig } from './contracts'

/** Per-meter facts in quarter-note beats (quarter = 1). */
export interface MeterInfo {
  /** Length of one bar in quarter-note beats: 4/4 = 4, 3/4 = 3, 6/8 = 6 eighths = 3. */
  totalBeats: number
  /** Count-in click onsets (one bar of the felt pulse), in quarter-note beats. */
  countIn: number[]
}

export const METERS: Record<TimeSig, MeterInfo> = {
  '4/4': { totalBeats: 4, countIn: [0, 1, 2, 3] }, // four quarter beats
  '3/4': { totalBeats: 3, countIn: [0, 1, 2] }, // three quarter beats
  '6/8': { totalBeats: 3, countIn: [0, 1.5] }, // two dotted-quarter beats
  '2/4': { totalBeats: 2, countIn: [0, 1] }, // two quarter beats
  '12/8': { totalBeats: 6, countIn: [0, 1.5, 3, 4.5] }, // four dotted-quarter beats
  '5/4': { totalBeats: 5, countIn: [0, 1, 2, 3, 4] }, // five quarter beats (felt 3+2)
  '2/2': { totalBeats: 4, countIn: [0, 2] }, // cut time — two half-note beats
}

const BASE_BEATS: Record<RhythmEvent['dur'], number> = {
  w: 4,
  h: 2,
  q: 1,
  '8': 0.5,
  '16': 0.25,
  '32': 0.125,
}

/** Duration of a rhythm event in quarter-note beats (dots add half, then a quarter, …). */
export function eventBeats(e: RhythmEvent): number {
  // A triplet eighth is ⅔ of a normal eighth (three fill one beat).
  if (e.triplet) return BASE_BEATS[e.dur] * (2 / 3)
  return BASE_BEATS[e.dur] * (2 - 1 / 2 ** (e.dots ?? 0))
}

/** Total length of a pattern in quarter-note beats (should equal the bar). */
export function patternBeats(pattern: RhythmEvent[]): number {
  return pattern.reduce((sum, e) => sum + eventBeats(e), 0)
}

/**
 * The struck notes of a pattern, in order. Rests and tied continuations make no
 * attack, so they're skipped — the same rule the player uses to decide what to
 * strike. Drives the tap-along étude: where a tap is expected, how tight the
 * timing window is, and how long the note must be held.
 *   - `beat`  — onset position in quarter-note beats from the bar start.
 *   - `beats` — the note's own written value (drives the timing window).
 *   - `hold`  — how long the note actually sounds, in beats: the note's value
 *               plus any tied continuations (drives the hold-duration check).
 */
export function onsets(
  pattern: RhythmEvent[]
): { beat: number; beats: number; hold: number }[] {
  const out: { beat: number; beats: number; hold: number }[] = []
  let beat = 0
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    const continuation = i > 0 && !!pattern[i - 1].tie
    if (!e.rest && !continuation) {
      let hold = eventBeats(e)
      let j = i
      while (pattern[j].tie && j + 1 < pattern.length) {
        j++
        hold += eventBeats(pattern[j])
      }
      out.push({ beat, beats: eventBeats(e), hold })
    }
    beat += eventBeats(e)
  }
  return out
}

/** A tapped note: its onset time (`down`, ms from the shared start) and how long
 *  it was held (`hold`, ms from press to release). */
export interface Tap {
  down: number
  hold: number
}

/** A tap must be held for at least this fraction of the note's sounding length
 *  to count as correct — so a quarter is sustained, not just clipped. */
export const HOLD_MIN = 0.7

/** The "perfect" half-window (ms) for a note of `beats` value: ~200 ms for a
 *  quarter or slower, tightening to ~150 ms for sixteenths/faster. Note-value
 *  based (tempo-independent), so a fast note demands tighter timing — but the
 *  whole range is forgiving (you only need the rhythm right, not metronomic). */
function perfectWindowMs(beats: number): number {
  return Math.max(150, Math.min(200, 133 + 67 * beats))
}

/**
 * Grade tapped onsets against the expected ones (all times in ms from a shared
 * start). Each expected onset gets a tolerance: full marks within its perfect
 * window, decaying linearly to zero at `missMs` (≈3× the perfect window, but
 * capped at 45% of the gap to the nearest neighbour so a tap can't match two
 * onsets in dense passages). Onsets are matched to their nearest unused tap;
 * leftover taps are `extra` and each costs half an onset. Accuracy is the mean
 * per-onset score (minus the extra-tap penalty), 0–100. Constants are tunable.
 *
 * A matched tap only counts as correct if it was also **held** for at least
 * `HOLD_MIN` of the note's sounding length (`holdMs`) — a clipped tap on the beat
 * scores 0 and is flagged `short`, so a quarter must be sustained, not just
 * struck.
 *
 * Per onset it reports the signed timing offset `dtMs` (+late / −early, null if
 * the onset was missed), whether the matched tap was `short`, and its 0–1
 * `score`, so the results screen can colour and annotate each note.
 */
export interface OnsetResult {
  /** Signed offset of the matched tap (+ late, − early); null if missed. */
  dtMs: number | null
  /** 0–1 timing score for this onset (1 = within the perfect window). */
  score: number
  /** True when a tap landed in time but was released too soon (held < HOLD_MIN). */
  short?: boolean
}

export function scoreTaps(
  expected: { ms: number; beats: number; holdMs: number }[],
  taps: Tap[]
): { accuracy: number; perOnset: OnsetResult[]; extra: number } {
  const n = expected.length
  if (n === 0) return { accuracy: taps.length === 0 ? 100 : 0, perOnset: [], extra: taps.length }

  const used = new Array(taps.length).fill(false)
  const perOnset: OnsetResult[] = []
  let sum = 0
  for (let i = 0; i < n; i++) {
    const e = expected[i]
    const prevGap = i > 0 ? e.ms - expected[i - 1].ms : Infinity
    const nextGap = i < n - 1 ? expected[i + 1].ms - e.ms : Infinity
    const gap = Math.min(prevGap, nextGap)
    const perfect = perfectWindowMs(e.beats)
    const miss = Math.min(perfect * 3, gap === Infinity ? perfect * 3 : 0.45 * gap)
    // A perfect window can't exceed the miss window (very dense rhythms).
    const p = Math.min(perfect, miss)

    let bestJ = -1
    let bestSigned = Infinity
    for (let j = 0; j < taps.length; j++) {
      if (used[j]) continue
      const signed = taps[j].down - e.ms
      if (Math.abs(signed) < Math.abs(bestSigned)) {
        bestSigned = signed
        bestJ = j
      }
    }
    if (bestJ >= 0 && Math.abs(bestSigned) <= miss) {
      used[bestJ] = true
      const d = Math.abs(bestSigned)
      const timing = d <= p ? 1 : 1 - (d - p) / (miss - p)
      // The tap landed in time, but must also be sustained for the note's length.
      const short = taps[bestJ].hold < HOLD_MIN * e.holdMs
      const score = short ? 0 : timing
      perOnset.push({ dtMs: Math.round(bestSigned), score, short })
      sum += score
    } else {
      perOnset.push({ dtMs: null, score: 0 }) // a missed onset
    }
  }
  const extra = used.filter((u) => !u).length
  const accuracy = Math.round(Math.max(0, (sum - 0.5 * extra) / n) * 100)
  return { accuracy, perOnset, extra }
}

/**
 * What a pattern actually SOUNDS like: the onset beat and held length of every
 * struck note. Rests advance time but make no sound; a tie holds its note through
 * the chain without re-striking (mirrors how `scheduleRhythm` plays it). Two
 * patterns with the same signature are indistinguishable by ear — e.g. a dotted
 * quarter vs a quarter tied to an eighth — so a rhythm-dictation question must
 * never offer both as choices.
 */
export function audibleSignature(pattern: RhythmEvent[]): string {
  const round = (n: number): number => Math.round(n * 1000) / 1000
  const attacks: string[] = []
  let beat = 0
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    const continuation = i > 0 && !!pattern[i - 1].tie
    if (!e.rest && !continuation) {
      let held = eventBeats(e)
      let j = i
      while (pattern[j].tie && j + 1 < pattern.length) {
        j++
        held += eventBeats(pattern[j])
      }
      attacks.push(`${round(beat)}:${round(held)}`)
    }
    beat += eventBeats(e)
  }
  return attacks.join(' ')
}
