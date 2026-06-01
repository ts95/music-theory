import { describe, expect, it } from 'vitest'
import {
  accuracyPct,
  aggregateByDay,
  etudeAccuracy,
  summarize,
  weeklyAccuracy,
  type PracticeHistoryRow,
} from './practiceHistory'

const rows: PracticeHistoryRow[] = [
  { day: '2026-05-04', etude_id: 'scales', seconds: 120, answered: 4, correct: 3 },
  { day: '2026-05-04', etude_id: 'chords', seconds: 60, answered: 2, correct: 1 },
  { day: '2026-05-06', etude_id: 'scales', seconds: 90, answered: 2, correct: 2 },
  { day: '2026-05-11', etude_id: 'scales', seconds: 30, answered: 1, correct: 0 },
]

describe('accuracyPct', () => {
  it('rounds correct/answered to a percent', () => {
    expect(accuracyPct(3, 4)).toBe(75)
    expect(accuracyPct(2, 3)).toBe(67)
  })
  it('is 0 when nothing was answered', () => {
    expect(accuracyPct(0, 0)).toBe(0)
  })
})

describe('aggregateByDay', () => {
  it('sums same-day rows into day totals and a per-étude breakdown', () => {
    const byDay = aggregateByDay(rows)
    expect(byDay['2026-05-04'].totalSeconds).toBe(180)
    expect(byDay['2026-05-04'].totalAnswered).toBe(6)
    expect(byDay['2026-05-04'].totalCorrect).toBe(4)
    expect(byDay['2026-05-04'].perEtude.scales).toEqual({
      seconds: 120,
      answered: 4,
      correct: 3,
    })
  })
  it('keeps distinct days separate', () => {
    const byDay = aggregateByDay(rows)
    expect(Object.keys(byDay).sort()).toEqual(['2026-05-04', '2026-05-06', '2026-05-11'])
  })
})

describe('summarize', () => {
  it('totals across days and counts days with practice time', () => {
    const s = summarize(aggregateByDay(rows))
    expect(s.totalSeconds).toBe(300)
    expect(s.totalAnswered).toBe(9)
    expect(s.totalCorrect).toBe(6)
    expect(s.daysPracticed).toBe(3)
  })
  it('does not count a day that has answers but no time', () => {
    const s = summarize(
      aggregateByDay([
        { day: '2026-05-04', etude_id: 'scales', seconds: 0, answered: 2, correct: 1 },
      ]),
    )
    expect(s.daysPracticed).toBe(0)
  })
})

describe('weeklyAccuracy', () => {
  it('buckets by Sunday-start week and applies the scope filter', () => {
    // 2026-05-04 (Mon) & 05-06 (Wed) share the week of Sun 2026-05-03;
    // 2026-05-11 (Mon) is the week of Sun 2026-05-10.
    const all = weeklyAccuracy(rows, () => true)
    expect(all.map((p) => p.weekStart)).toEqual(['2026-05-03', '2026-05-10'])
    // week 1: correct 3+1+2=6 of answered 4+2+2=8 -> 75%
    expect(all[0]).toMatchObject({ accuracy: 75, answered: 8 })
    // week 2: 0 of 1 -> 0%
    expect(all[1]).toMatchObject({ accuracy: 0, answered: 1 })
  })
  it('filters to a single étude scope', () => {
    const scales = weeklyAccuracy(rows, (r) => r.etude_id === 'scales')
    // week 1 scales: correct 3+2=5 of 4+2=6 -> 83%
    expect(scales[0]).toMatchObject({ weekStart: '2026-05-03', accuracy: 83 })
  })
  it('omits weeks with no answers', () => {
    const none = weeklyAccuracy(
      [{ day: '2026-05-04', etude_id: 'scales', seconds: 120, answered: 0, correct: 0 }],
      () => true,
    )
    expect(none).toEqual([])
  })
})

describe('etudeAccuracy', () => {
  it('computes lifetime accuracy per étude', () => {
    const e = etudeAccuracy(rows)
    // scales: correct 3+2+0=5 of 4+2+1=7 -> 71%
    expect(e.scales).toEqual({ correct: 5, answered: 7, accuracy: 71 })
    expect(e.chords).toEqual({ correct: 1, answered: 2, accuracy: 50 })
  })
})
