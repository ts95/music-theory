import { describe, it, expect } from 'vitest'
import type { RhythmEvent } from './contracts'
import { audibleSignature, onsets, patternBeats, scoreTaps } from './rhythm'

const Q: RhythmEvent = { dur: 'q' }
const QD: RhythmEvent = { dur: 'q', dots: 1 }
const E: RhythmEvent = { dur: '8' }
const H: RhythmEvent = { dur: 'h' }
const S: RhythmEvent = { dur: '16' }
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

describe('onsets', () => {
  it('returns one entry per struck note, at its beat, with value and hold', () => {
    expect(onsets([Q, Q, Q, Q])).toEqual([
      { beat: 0, beats: 1, hold: 1 },
      { beat: 1, beats: 1, hold: 1 },
      { beat: 2, beats: 1, hold: 1 },
      { beat: 3, beats: 1, hold: 1 },
    ])
  })

  it('skips rests and tied continuations; hold spans the tie', () => {
    // tie(Q),Q sounds as one 2-beat attack at beat 0; rest makes no attack.
    expect(onsets([tie(Q), Q, QR, Q])).toEqual([
      { beat: 0, beats: 1, hold: 2 },
      { beat: 3, beats: 1, hold: 1 },
    ])
  })
})

describe('scoreTaps', () => {
  // 4 quarter onsets at a slow tempo: ms 0, 500, 1000, 1500. Each quarter sounds
  // 500ms, so a tap must be held ≥ 350ms (HOLD_MIN 0.7) to count. perfect ±200ms.
  const expected = [0, 500, 1000, 1500].map((ms) => ({ ms, beats: 1, holdMs: 500 }))
  // Held long enough to satisfy the hold rule.
  const taps = (downs: number[], hold = 450) => downs.map((down) => ({ down, hold }))

  it('scores perfectly-timed, well-held taps 100%', () => {
    const r = scoreTaps(expected, taps([0, 500, 1000, 1500]))
    expect(r.accuracy).toBe(100)
    expect(r.extra).toBe(0)
  })

  it('still scores 100% when every tap is within the perfect window', () => {
    // A constant +60ms drift (inside the 80ms window) is still "right".
    const r = scoreTaps(expected, taps([60, 560, 1060, 1560]))
    expect(r.accuracy).toBe(100)
  })

  it('reports the signed offset (+ late / − early) per onset', () => {
    const r = scoreTaps(expected, taps([40, 460, 1000, 1500]))
    expect(r.perOnset[0].dtMs).toBe(40)
    expect(r.perOnset[1].dtMs).toBe(-40)
  })

  it('counts an onset with no nearby tap as missed (score 0)', () => {
    const r = scoreTaps(expected, taps([0, 500, 1500])) // nothing near 1000
    expect(r.perOnset[2].dtMs).toBeNull()
    expect(r.perOnset[2].score).toBe(0)
    // three of four onsets perfect → 75%.
    expect(r.accuracy).toBe(75)
  })

  it('penalises an extra (unmatched) tap by half an onset', () => {
    const r = scoreTaps(expected, taps([0, 250, 500, 1000, 1500])) // 250 matches nothing
    expect(r.extra).toBe(1)
    // 4/4 onsets perfect (sum 4) minus 0.5 extra, over 4 → 87.5% → 88%.
    expect(r.accuracy).toBe(88)
  })

  it('rejects a tap held too short, even when perfectly timed (the hold rule)', () => {
    // All four on the beat, but each released after only 100ms (< 400ms needed).
    const r = scoreTaps(expected, taps([0, 500, 1000, 1500], 100))
    expect(r.perOnset.every((o) => o.short)).toBe(true)
    expect(r.perOnset.every((o) => o.score === 0)).toBe(true)
    expect(r.accuracy).toBe(0)
  })

  it('accepts a tap held for ≥ 70% of the note even if released a touch early', () => {
    // Exactly the 70% threshold (350ms) passes; just under it fails.
    expect(scoreTaps([expected[0]], [{ down: 0, hold: 350 }]).perOnset[0].score).toBe(1)
    expect(scoreTaps([expected[0]], [{ down: 0, hold: 349 }]).perOnset[0].short).toBe(true)
  })

  it('tightens the window for faster notes', () => {
    // 175ms off: still perfect for a quarter (200ms window) but not for a
    // sixteenth (150ms window) — faster notes demand tighter timing.
    const sixteenth = [{ ms: 0, beats: 0.25, holdMs: 0 }]
    expect(scoreTaps(sixteenth, [{ down: 175, hold: 50 }]).perOnset[0].score).toBeLessThan(1)
    expect(scoreTaps([{ ms: 0, beats: 1, holdMs: 0 }], [{ down: 175, hold: 50 }]).perOnset[0].score).toBe(1)
  })

  it('does not let a single tap match two dense onsets', () => {
    // Two sixteenths 120ms apart; one tap near the first leaves the second missed.
    const dense = [
      { ms: 0, beats: 0.25, holdMs: 0 },
      { ms: 120, beats: 0.25, holdMs: 0 },
    ]
    const r = scoreTaps(dense, [{ down: 5, hold: 30 }])
    expect(r.perOnset[0].dtMs).toBe(5)
    expect(r.perOnset[1].dtMs).toBeNull()
  })

  it('uses S (sixteenth) shorthand consistently with onsets', () => {
    expect(onsets([S, S, S, S])).toEqual([
      { beat: 0, beats: 0.25, hold: 0.25 },
      { beat: 0.25, beats: 0.25, hold: 0.25 },
      { beat: 0.5, beats: 0.25, hold: 0.25 },
      { beat: 0.75, beats: 0.25, hold: 0.25 },
    ])
  })
})
