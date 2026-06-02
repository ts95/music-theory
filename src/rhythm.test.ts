import { describe, it, expect } from 'vitest'
import type { RhythmEvent } from './contracts'
import { audibleSignature, patternBeats } from './rhythm'

const Q: RhythmEvent = { dur: 'q' }
const QD: RhythmEvent = { dur: 'q', dots: 1 }
const E: RhythmEvent = { dur: '8' }
const H: RhythmEvent = { dur: 'h' }
const QR: RhythmEvent = { dur: 'q', rest: true }
const tie = (e: RhythmEvent): RhythmEvent => ({ ...e, tie: true })

describe('audibleSignature', () => {
  it('treats a dotted quarter and a quarter tied to an eighth as identical', () => {
    // The reported bug: both are one attack lasting 1.5 beats.
    expect(audibleSignature([QD, Q])).toBe(audibleSignature([tie(Q), E, Q]))
  })

  it('treats a quarter tied to a quarter as a single half-note attack', () => {
    expect(audibleSignature([tie(Q), Q, Q])).toBe(audibleSignature([H, Q]))
  })

  it('distinguishes a re-struck note from a tied (held) one', () => {
    expect(audibleSignature([Q, Q, Q])).not.toBe(audibleSignature([tie(Q), Q, Q]))
  })

  it('distinguishes a rest from a sounded note at the same position', () => {
    expect(audibleSignature([Q, QR, Q])).not.toBe(audibleSignature([Q, Q, Q]))
  })

  it('ignores trailing rests (no audible attack)', () => {
    expect(audibleSignature([Q, QR, QR])).toBe(audibleSignature([Q]))
    // ...even though the written totals differ.
    expect(patternBeats([Q, QR, QR])).not.toBeCloseTo(patternBeats([Q]), 5)
  })
})
