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
