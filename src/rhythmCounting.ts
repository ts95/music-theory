/**
 * How to count a one-bar rhythm — the counting guide for the Tap the Rhythm
 * étude. Pure (no React); each function returns one syllable per `pattern` event
 * (aligned 1:1), or `null` where nothing is counted (a tied-continuation note, or
 * a rest in Kodály). Derived from each event's position/value — never hardcoded.
 */
import type { RhythmEvent, TimeSig } from './contracts'
import { eventBeats } from './rhythm'

export type CountSystem = 'traditional' | 'kodaly'

/** Felt-beat lengths per metre, in quarter beats, in bar order. Uniform metres
 *  repeat one length; asymmetric metres mix them (7/8 = 2+2+3 eighths →
 *  [1, 1, 1.5]). */
const METER_FACTS: Record<TimeSig, number[]> = {
  '4/4': [1, 1, 1, 1],
  '3/4': [1, 1, 1],
  '2/4': [1, 1],
  '5/4': [1, 1, 1, 1, 1], // felt 3+2, but every beat is a quarter
  '2/2': [2, 2], // cut time — felt in two half-note beats
  '6/8': [1.5, 1.5],
  '12/8': [1.5, 1.5, 1.5, 1.5],
  '5/8': [1.5, 1], // 3+2 eighths — a long beat then a short one
  '7/8': [1, 1, 1.5], // 2+2+3 eighths — two short beats then a long one
}

/** A dotted-quarter-long felt beat divides in three (compound la/li); quarter-
 *  and half-note beats divide in two/four (simple e & a). Decided per beat, so
 *  an asymmetric metre mixes both kinds within one bar. */
const isCompound = (len: number): boolean => Math.abs(len - 1.5) < 1e-6

// Traditional sub-beat syllables, keyed by the onset's fraction-of-the-beat × 24
// (24 = lcm of 3/4/8, so it covers triplet thirds, sixteenths, and 32nds). Key 0
// is the beat itself → the beat number. Simple beat divides in 4 (e & a) with
// 32nd in-betweens "ta"; compound divides in 3 (la li) with 16th in-betweens
// "ta". (Triplet notes are labelled by their run — trip/let — not by this table.)
const SIMPLE_SUB: Record<number, string> = {
  3: 'ta',
  6: 'e',
  9: 'ta',
  12: '&',
  15: 'ta',
  18: 'a',
  21: 'ta',
}
const COMPOUND_SUB: Record<number, string> = {
  4: 'ta',
  8: 'la',
  12: 'ta',
  16: 'li',
  20: 'ta',
}

/** Where `pos` (quarters from bar start) falls: its felt beat (1-based), the
 *  sub-beat key (fraction of that beat × 24, rounded), and the beat's own
 *  start/length — found by walking the metre's felt-beat lengths. */
function place(
  pos: number,
  beats: number[]
): { beat: number; key: number; len: number; start: number } {
  let start = 0
  for (let i = 0; i < beats.length - 1; i++) {
    if (pos < start + beats[i] - 1e-6) {
      const within = Math.max(0, pos - start)
      return { beat: i + 1, key: Math.round((within / beats[i]) * 24), len: beats[i], start }
    }
    start += beats[i]
  }
  const len = beats[beats.length - 1]
  const within = Math.max(0, pos - start)
  return { beat: beats.length, key: Math.round((within / len) * 24), len, start }
}

/** The positional syllable at `pos`: the beat number on the beat, else the
 *  sub-beat syllable from the (per-beat simple/compound) table. */
function positional(pos: number, beats: number[]): { syl: string; onBeat: boolean } {
  const { beat, key, len } = place(pos, beats)
  if (key === 0) return { syl: String(beat), onBeat: true }
  const sub = isCompound(len) ? COMPOUND_SUB : SIMPLE_SUB
  return { syl: sub[key] ?? '·', onBeat: false }
}

/** Traditional American counting: numbers on beats, `& / e / a` sub-beats,
 *  `la/li` in compound; triplet runs count `(position) trip let` — run-relative,
 *  so it holds for quarter/half/16th-note triplets too; rests parenthesised. */
function traditional(pattern: RhythmEvent[], meter: TimeSig): (string | null)[] {
  const beats = METER_FACTS[meter]
  const out: (string | null)[] = []
  let pos = 0
  let trip = 0 // index within a run of triplet notes → (position) / trip / let
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    if (!e.triplet) trip = 0
    if (i > 0 && pattern[i - 1].tie) {
      out.push(null) // held through a tie — not re-counted
      if (e.triplet) trip++
      pos += eventBeats(e)
      continue
    }
    const syl =
      e.triplet && trip % 3 !== 0
        ? trip % 3 === 1
          ? 'trip'
          : 'let'
        : positional(pos, beats).syl
    if (e.triplet) trip++
    out.push(e.rest ? `(${syl})` : syl)
    pos += eventBeats(e)
  }
  return out
}

/** Kodály-style duration syllables: ta / ti(-ti) / ti-ka… / tri-o-la, etc.
 *  (Per-note, value-based; a documented simplification for 16ths in compound and
 *  for 32nds, which Kodály doesn't standardly name. A double-dotted note keeps
 *  its single-dot syllable.) */
function kodaly(pattern: RhythmEvent[], meter: TimeSig): (string | null)[] {
  const beats = METER_FACTS[meter]
  const out: (string | null)[] = []
  let pos = 0
  // Index within a run of triplet events → tri / o / la. Tied or rested triplet
  // members still advance it, so a gapped triplet ends on "la", not a fresh "tri".
  let trip = 0
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    const beat = eventBeats(e)
    if (i > 0 && pattern[i - 1].tie) {
      out.push(null)
      if (e.triplet) trip++
      else trip = 0
      pos += beat
      continue
    }
    if (e.rest) {
      out.push(null)
      if (e.triplet) trip++
      else trip = 0
      pos += beat
      continue
    }
    let syl: string
    if (e.triplet) {
      syl = ['tri', 'o', 'la'][trip % 3]
      trip++
    } else {
      trip = 0
      const dots = e.dots ?? 0
      if (e.dur === 'w') syl = 'ta-a-a-a'
      else if (e.dur === 'h') syl = dots ? 'ta-a-a' : 'ta-a'
      else if (e.dur === 'q') syl = dots ? 'ta-i' : 'ta'
      else if (e.dur === '8') syl = dots ? 'tim' : 'ti'
      else {
        // 16th / 32nd: alternate ti / ka by sixteenth-grid index within the beat.
        const within = pos - place(pos, beats).start
        syl = Math.round(within / 0.25) % 2 === 0 ? 'ti' : 'ka'
      }
    }
    out.push(syl)
    pos += beat
  }
  return out
}

/** One counting syllable per pattern event (aligned 1:1) in the chosen system. */
export function countSyllables(
  pattern: RhythmEvent[],
  meter: TimeSig,
  system: CountSystem
): (string | null)[] {
  return system === 'kodaly' ? kodaly(pattern, meter) : traditional(pattern, meter)
}

/** One felt beat's full count: its number plus every named sub-beat in it. */
export interface BeatCount {
  beat: number
  /** `pos` is the token's onset in quarter-beats from the bar start (for syncing
   *  a playhead to it); `onBeat` marks the beat numbers. */
  tokens: { label: string; onBeat: boolean; pos: number }[]
}

/**
 * The complete Traditional counting grid for a bar — every subdivision of every
 * felt beat, not just the ones a note lands on (the "how to count it" hint). The
 * whole bar is subdivided to the finest non-triplet level it uses, so a
 * quarter-note beat still shows the `&` you'd count through it: simple beats
 * read `1 (e) & (a)`, compound `1 la li`. Each notated triplet group of three
 * contributes three evenly-spaced tokens across its own span instead — `1 trip
 * let` for an eighth (or quarter/half) triplet, starting wherever the group
 * starts — so a half-note triplet's tokens stretch across the bar and a beat it
 * skips over simply shows no token. Always positional, so it's independent of
 * the per-note Kodály/Traditional choice.
 */
export function granularCounting(pattern: RhythmEvent[], meter: TimeSig): BeatCount[] {
  const beats = METER_FACTS[meter]

  // Triplet groups of three (the same grouping the staff's tuplet bracket uses)
  // with their span, plus the bar's finest non-triplet subdivision (rests
  // included — a 16th rest still divides the beat).
  const groups: { start: number; span: number }[] = []
  let finest = Infinity
  let pos = 0
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    if (e.triplet) {
      let span = 0
      for (let k = i; k < Math.min(i + 3, pattern.length); k++) span += eventBeats(pattern[k])
      groups.push({ start: pos, span })
      pos += span
      i += 2
    } else {
      finest = Math.min(finest, eventBeats(e))
      pos += eventBeats(e)
    }
  }

  const out: BeatCount[] = []
  let beatStart = 0
  for (let b = 0; b < beats.length; b++) {
    const len = beats[b]
    const sub = isCompound(len) ? COMPOUND_SUB : SIMPLE_SUB
    // Grid divisions for this beat at the bar's finest duple level (every beat
    // counts the same level — the steady-count rule).
    const r = finest === Infinity ? 1 : Math.max(1, Math.round(len / finest))
    const tokens: BeatCount['tokens'] = []
    for (let j = 0; j < r; j++) {
      const key = Math.round((j * 24) / r)
      const at = beatStart + (key / 24) * len
      // Grid points inside a triplet group give way to the group's own tokens.
      if (groups.some((g) => at > g.start - 1e-6 && at < g.start + g.span - 1e-6)) continue
      if (j === 0) tokens.push({ label: String(b + 1), onBeat: true, pos: at })
      else {
        const syl = sub[key]
        if (syl) tokens.push({ label: syl, onBeat: false, pos: at })
      }
    }
    // This beat's share of each triplet group's three tokens: the first reads as
    // its position (beat number / sub-beat syllable), the others trip / let.
    for (const g of groups) {
      for (let k = 0; k < 3; k++) {
        const at = g.start + (k * g.span) / 3
        if (at < beatStart - 1e-6 || at >= beatStart + len - 1e-6) continue
        if (k === 0) {
          const { syl, onBeat } = positional(at, beats)
          tokens.push({ label: syl, onBeat, pos: at })
        } else {
          tokens.push({ label: k === 1 ? 'trip' : 'let', onBeat: false, pos: at })
        }
      }
    }
    tokens.sort((a, z) => a.pos - z.pos)
    out.push({ beat: b + 1, tokens })
    beatStart += len
  }
  return out
}
