import { describe, it, expect } from 'vitest'
import type { Question, RhythmEvent, TimeSig } from './contracts'
import {
  METERS,
  audibleSignature,
  onsets,
  patternBeats,
  questionMeter,
  scoreTaps,
} from './rhythm'
import { RHYTHM_LEVELS } from './questions/generators'

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

  it('uses a flat 200ms window regardless of note value', () => {
    // 190ms off is within the window for both a sixteenth and a quarter now;
    // 210ms off is just past it for both (no per-note tightening).
    const sixteenth = [{ ms: 0, beats: 0.25, holdMs: 0 }]
    const quarter = [{ ms: 0, beats: 1, holdMs: 0 }]
    expect(scoreTaps(sixteenth, [{ down: 190, hold: 50 }]).perOnset[0].score).toBe(1)
    expect(scoreTaps(quarter, [{ down: 190, hold: 50 }]).perOnset[0].score).toBe(1)
    expect(scoreTaps(quarter, [{ down: 210, hold: 50 }]).perOnset[0].score).toBeLessThan(1)
  })

  it('requires only 40% hold for quick notes (16th/32nd/triplet), 70% otherwise', () => {
    // A sixteenth sounding 100ms: 40ms (40%) passes; just under fails.
    const six = [{ ms: 0, beats: 0.25, holdMs: 100 }]
    expect(scoreTaps(six, [{ down: 0, hold: 40 }]).perOnset[0].score).toBe(1)
    expect(scoreTaps(six, [{ down: 0, hold: 39 }]).perOnset[0].short).toBe(true)
    // A thirty-second (beats 0.125) also needs only 40%.
    const t32 = [{ ms: 0, beats: 0.125, holdMs: 100 }]
    expect(scoreTaps(t32, [{ down: 0, hold: 40 }]).perOnset[0].score).toBe(1)
    // An eighth-note triplet (beats ≈ 0.33) now also needs only 40%.
    const trip = [{ ms: 0, beats: 1 / 3, holdMs: 100 }]
    expect(scoreTaps(trip, [{ down: 0, hold: 40 }]).perOnset[0].score).toBe(1)
    expect(scoreTaps(trip, [{ down: 0, hold: 39 }]).perOnset[0].short).toBe(true)
    // A quarter still needs 70%.
    const q = [{ ms: 0, beats: 1, holdMs: 100 }]
    expect(scoreTaps(q, [{ down: 0, hold: 69 }]).perOnset[0].short).toBe(true)
    expect(scoreTaps(q, [{ down: 0, hold: 70 }]).perOnset[0].score).toBe(1)
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

describe('RHYTHM_LEVELS pools', () => {
  // The music-correctness guardrail: a pattern that doesn't fill its bar plays,
  // grades, and renders wrong everywhere downstream.
  it('every pattern fills its bar exactly', () => {
    RHYTHM_LEVELS.forEach((def, i) => {
      for (const [meter, pool] of Object.entries(def.pools) as [TimeSig, RhythmEvent[][]][]) {
        for (const p of pool) {
          const key = p
            .map((e) => `${e.rest ? 'r' : ''}${e.triplet ? 't' : ''}${e.dur}${'.'.repeat(e.dots ?? 0)}`)
            .join(' ')
          expect
            .soft(patternBeats(p), `L${i + 1} ${meter} [${key}]`)
            .toBeCloseTo(METERS[meter].totalBeats, 5)
        }
      }
    })
  })

  // The staff renderer and the counting lane both group triplets three at a
  // time, of one written value per group.
  it('triplet members come in consecutive groups of three of one value', () => {
    RHYTHM_LEVELS.forEach((def, i) => {
      for (const [meter, pool] of Object.entries(def.pools) as [TimeSig, RhythmEvent[][]][]) {
        for (const p of pool) {
          for (let j = 0; j < p.length; j++) {
            if (!p[j].triplet) continue
            const group = p.slice(j, j + 3)
            expect.soft(group.length, `L${i + 1} ${meter} truncated triplet`).toBe(3)
            expect
              .soft(group.every((e) => e.triplet && e.dur === p[j].dur), `L${i + 1} ${meter} mixed triplet group at ${j}`)
              .toBe(true)
            j += 2
          }
        }
      }
    })
  })
})

describe('questionMeter', () => {
  const base = {
    id: 'x',
    etudeId: 'rhythm-dictation',
    category: 'c',
    prompt: 'p',
    choices: [],
    answerIndex: -1,
  }

  it('reads the meter from an ear (dictation) question', () => {
    const q = {
      ...base,
      ear: { kind: 'rhythm', meter: '6/8', tempo: 100, pattern: [Q] },
    } as Question
    expect(questionMeter(q)).toBe('6/8')
  })

  it('reads the meter from a tapAlong question', () => {
    const q = {
      ...base,
      etudeId: 'rhythm-tap',
      tapAlong: { meter: '5/4', tempo: 138, pattern: [Q] },
    } as Question
    expect(questionMeter(q)).toBe('5/4')
  })

  it('returns null for a non-rhythm question', () => {
    expect(questionMeter(base as Question)).toBeNull()
  })
})
