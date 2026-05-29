import type { TimeSig } from './contracts'

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
}
