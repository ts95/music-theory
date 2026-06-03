import { describe, it, expect } from 'vitest'
import type { RhythmEvent } from './contracts'
import { countSyllables } from './rhythmCounting'

const Q: RhythmEvent = { dur: 'q' }
const QD: RhythmEvent = { dur: 'q', dots: 1 }
const H: RhythmEvent = { dur: 'h' }
const E: RhythmEvent = { dur: '8' }
const ED: RhythmEvent = { dur: '8', dots: 1 }
const S: RhythmEvent = { dur: '16' }
const T: RhythmEvent = { dur: '8', triplet: true }
const QR: RhythmEvent = { dur: 'q', rest: true }
const tie = (e: RhythmEvent): RhythmEvent => ({ ...e, tie: true })

const trad = (p: RhythmEvent[], m: Parameters<typeof countSyllables>[1]) =>
  countSyllables(p, m, 'traditional')
const kod = (p: RhythmEvent[], m: Parameters<typeof countSyllables>[1]) =>
  countSyllables(p, m, 'kodaly')

describe('traditional counting', () => {
  it('numbers the beats in simple metres', () => {
    expect(trad([Q, Q, Q, Q], '4/4')).toEqual(['1', '2', '3', '4'])
    expect(trad([Q, Q, Q], '3/4')).toEqual(['1', '2', '3'])
    expect(trad([Q, Q, Q, Q, Q], '5/4')).toEqual(['1', '2', '3', '4', '5'])
  })

  it('marks off-beats with & and sixteenths with e / a', () => {
    expect(trad([E, E, E, E, E, E, E, E], '4/4')).toEqual(
      ['1', '&', '2', '&', '3', '&', '4', '&'],
    )
    expect(trad([S, S, S, S], '2/4')).toEqual(['1', 'e', '&', 'a'])
  })

  it('counts an eighth-note triplet as 1 trip let', () => {
    expect(trad([T, T, T, Q, Q, Q], '4/4')).toEqual(
      ['1', 'trip', 'let', '2', '3', '4'],
    )
  })

  it('inserts "ta" for 32nd-note in-betweens', () => {
    // four 32nds (½ beat) then an eighth, completing beat 1.
    const X: RhythmEvent = { dur: '32' }
    expect(trad([X, X, X, X, E, Q, Q, Q], '4/4')).toEqual(
      ['1', 'ta', 'e', 'ta', '&', '2', '3', '4'],
    )
  })

  it('counts compound metres in la / li on the felt beats', () => {
    expect(trad([E, E, E, E, E, E], '6/8')).toEqual(
      ['1', 'la', 'li', '2', 'la', 'li'],
    )
    expect(trad([QD, QD, QD, QD], '12/8')).toEqual(['1', '2', '3', '4'])
  })

  it('counts cut time in two (quarters are the off-beats)', () => {
    expect(trad([Q, Q, Q, Q], '2/2')).toEqual(['1', '&', '2', '&'])
  })

  it('parenthesises rests but still counts their position', () => {
    expect(trad([Q, QR, H], '4/4')).toEqual(['1', '(2)', '3'])
  })

  it('does not re-count a tied continuation', () => {
    expect(trad([tie(Q), Q, Q, Q], '4/4')).toEqual(['1', null, '3', '4'])
  })
})

describe('kodály counting', () => {
  it('names note values: ta / ti / ti-ka', () => {
    expect(kod([Q, Q, Q, Q], '4/4')).toEqual(['ta', 'ta', 'ta', 'ta'])
    expect(kod([E, E, E, E, E, E, E, E], '4/4')).toEqual(
      ['ti', 'ti', 'ti', 'ti', 'ti', 'ti', 'ti', 'ti'],
    )
    expect(kod([S, S, S, S], '2/4')).toEqual(['ti', 'ka', 'ti', 'ka'])
  })

  it('names longer notes and dotted figures', () => {
    expect(kod([H, H], '4/4')).toEqual(['ta-a', 'ta-a'])
    expect(kod([QD, E, Q, Q], '4/4')).toEqual(['ta-i', 'ti', 'ta', 'ta'])
    // dotted-eighth + sixteenth → tim-ka
    expect(kod([ED, S, Q, Q], '4/4')).toEqual(['tim', 'ka', 'ta', 'ta'])
  })

  it('names an eighth-note triplet tri-o-la', () => {
    expect(kod([T, T, T, Q, Q, Q], '4/4')).toEqual(
      ['tri', 'o', 'la', 'ta', 'ta', 'ta'],
    )
  })

  it('leaves rests and tied continuations blank', () => {
    expect(kod([Q, QR, H], '4/4')).toEqual(['ta', null, 'ta-a'])
    expect(kod([tie(Q), Q, Q, Q], '4/4')).toEqual(['ta', null, 'ta', 'ta'])
  })
})
