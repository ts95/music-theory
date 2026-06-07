/**
 * How to count a one-bar rhythm — the counting guide for the Tap the Rhythm
 * étude. Pure (no React); each function returns one syllable per `pattern` event
 * (aligned 1:1), or `null` where nothing is counted (a tied-continuation note, or
 * a rest in Kodály). Derived from each event's position/value — never hardcoded.
 */
import type { RhythmEvent, TimeSig } from './contracts'
import { METERS, eventBeats } from './rhythm'

export type CountSystem = 'traditional' | 'kodaly'

/** Felt-beat facts per metre: how many quarter-beats one felt beat spans, and
 *  whether the beat divides in three (compound). */
interface MeterFact {
  beatUnit: number
  compound: boolean
}
const METER_FACTS: Record<TimeSig, MeterFact> = {
  '4/4': { beatUnit: 1, compound: false },
  '3/4': { beatUnit: 1, compound: false },
  '2/4': { beatUnit: 1, compound: false },
  '5/4': { beatUnit: 1, compound: false },
  '2/2': { beatUnit: 2, compound: false }, // cut time — felt in two half-note beats
  '6/8': { beatUnit: 1.5, compound: true },
  '12/8': { beatUnit: 1.5, compound: true },
}

// Traditional sub-beat syllables, keyed by the onset's fraction-of-the-beat × 24
// (24 = lcm of 3/4/8, so it covers triplet thirds, sixteenths, and 32nds). Key 0
// is the beat itself → the beat number. Simple beat divides in 4 (e & a) with
// 32nd in-betweens "ta" and eighth-triplets "trip/let"; compound divides in 3
// (la li) with 16th in-betweens "ta".
const SIMPLE_SUB: Record<number, string> = {
  3: 'ta',
  6: 'e',
  8: 'trip',
  9: 'ta',
  12: '&',
  15: 'ta',
  16: 'let',
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

/** Position of `pos` (quarters from bar start) within its felt beat: the 1-based
 *  beat number and the sub-beat key (fraction × 24, rounded). */
function place(pos: number, beatUnit: number): { beat: number; key: number } {
  const beatIndex = Math.floor(pos / beatUnit + 1e-6)
  const within = Math.max(0, pos - beatIndex * beatUnit)
  return { beat: beatIndex + 1, key: Math.round((within / beatUnit) * 24) }
}

/** Traditional American counting: numbers on beats, `& / e / a` sub-beats,
 *  `trip/let` triplets, `la/li` in compound; rests parenthesised. */
function traditional(pattern: RhythmEvent[], meter: TimeSig): (string | null)[] {
  const { beatUnit, compound } = METER_FACTS[meter]
  const sub = compound ? COMPOUND_SUB : SIMPLE_SUB
  const out: (string | null)[] = []
  let pos = 0
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    if (i > 0 && pattern[i - 1].tie) {
      out.push(null) // held through a tie — not re-counted
      pos += eventBeats(e)
      continue
    }
    const { beat, key } = place(pos, beatUnit)
    const syl = key === 0 ? String(beat) : (sub[key] ?? '·')
    out.push(e.rest ? `(${syl})` : syl)
    pos += eventBeats(e)
  }
  return out
}

/** Kodály-style duration syllables: ta / ti(-ti) / ti-ka… / tri-o-la, etc.
 *  (Per-note, value-based; a documented simplification for 16ths in compound and
 *  for 32nds, which Kodály doesn't standardly name.) */
function kodaly(pattern: RhythmEvent[], meter: TimeSig): (string | null)[] {
  const { beatUnit } = METER_FACTS[meter]
  const out: (string | null)[] = []
  let pos = 0
  let trip = 0 // index within a run of triplet eighths → tri / o / la
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    const beats = eventBeats(e)
    if (i > 0 && pattern[i - 1].tie) {
      out.push(null)
      pos += beats
      continue
    }
    if (e.rest) {
      out.push(null)
      trip = 0
      pos += beats
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
        const within = Math.max(0, pos - Math.floor(pos / beatUnit + 1e-6) * beatUnit)
        syl = Math.round(within / 0.25) % 2 === 0 ? 'ti' : 'ka'
      }
    }
    out.push(syl)
    pos += beats
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
 * whole bar is subdivided to the finest level it uses, so a quarter-note beat
 * still shows the `&` you'd count through it: simple beats read `1 (e) & (a)`,
 * compound `1 la li`, and a triplet beat `1 trip let`. The beat number is the
 * on-beat token; the rest are off-beats. Always positional, so it's independent
 * of the per-note Kodály/Traditional choice.
 */
export function granularCounting(pattern: RhythmEvent[], meter: TimeSig): BeatCount[] {
  const { beatUnit, compound } = METER_FACTS[meter]
  const sub = compound ? COMPOUND_SUB : SIMPLE_SUB
  const feltBeats = Math.round(METERS[meter].totalBeats / beatUnit)

  // The bar's finest *non-triplet* subdivision (rests included — a 16th rest
  // still divides the beat), applied to every beat for a steady count; triplet
  // beats divide in three instead.
  const tripletBeat = new Array<boolean>(feltBeats).fill(false)
  let duple = 1
  let pos = 0
  for (const e of pattern) {
    const beatIndex = Math.floor(pos / beatUnit + 1e-6)
    if (e.triplet) {
      if (beatIndex >= 0 && beatIndex < feltBeats) tripletBeat[beatIndex] = true
    } else {
      duple = Math.max(duple, Math.round(beatUnit / eventBeats(e)))
    }
    pos += eventBeats(e)
  }

  const out: BeatCount[] = []
  for (let b = 0; b < feltBeats; b++) {
    const triplet = tripletBeat[b]
    const r = triplet ? 3 : Math.max(1, duple)
    const table = triplet ? SIMPLE_SUB : sub // trip/let live in SIMPLE_SUB
    const beatStart = b * beatUnit
    const tokens: BeatCount['tokens'] = []
    for (let j = 0; j < r; j++) {
      if (j === 0) {
        tokens.push({ label: String(b + 1), onBeat: true, pos: beatStart })
        continue
      }
      const key = Math.round((j * 24) / r)
      const syl = table[key]
      if (syl) tokens.push({ label: syl, onBeat: false, pos: beatStart + (key / 24) * beatUnit })
    }
    out.push({ beat: b + 1, tokens })
  }
  return out
}
