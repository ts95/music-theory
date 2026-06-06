import { describe, expect, it } from 'vitest'
import {
  accuracyByDay,
  accuracyPct,
  aggregateByDay,
  etudeAccuracy,
  monthCsv,
  recentDays,
  summarize,
  trendDays,
  type PracticeHistoryRow,
} from './practiceHistory'

const rows: PracticeHistoryRow[] = [
  { day: '2026-05-04', etude_id: 'scales', level: 1, version: 1, seconds: 120, answered: 4, correct: 3 },
  { day: '2026-05-04', etude_id: 'chords', level: 1, version: 1, seconds: 60, answered: 2, correct: 1 },
  { day: '2026-05-06', etude_id: 'scales', level: 1, version: 1, seconds: 90, answered: 2, correct: 2 },
  { day: '2026-05-11', etude_id: 'scales', level: 1, version: 1, seconds: 30, answered: 1, correct: 0 },
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
        { day: '2026-05-04', etude_id: 'scales', level: 1, version: 1, seconds: 0, answered: 2, correct: 1 },
      ]),
    )
    expect(s.daysPracticed).toBe(0)
  })
})

describe('recentDays', () => {
  it('returns the n days ending at today, inclusive and chronological', () => {
    expect(recentDays('2026-06-06', 14)).toEqual([
      '2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28',
      '2026-05-29', '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02',
      '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06',
    ])
  })
  it('crosses a month/year boundary correctly', () => {
    expect(recentDays('2026-01-01', 3)).toEqual(['2025-12-30', '2025-12-31', '2026-01-01'])
  })
})

describe('trendDays', () => {
  const mk = (day: string, answered = 1): PracticeHistoryRow => ({
    day, etude_id: 'scales', level: 1, version: 1, seconds: 60, answered, correct: 1,
  })

  it('returns the full window when history spans more than maxDays', () => {
    const rows14 = [mk('2026-05-20'), mk('2026-06-06')]
    expect(trendDays(rows14, '2026-06-06', 14)).toEqual(recentDays('2026-06-06', 14))
  })

  it('trims to the first practised day when history is under maxDays', () => {
    // First answers on 2026-06-04 → axis is just 06-04..06-06 (3 days).
    const rows = [mk('2026-06-04'), mk('2026-06-06')]
    expect(trendDays(rows, '2026-06-06', 14)).toEqual(['2026-06-04', '2026-06-05', '2026-06-06'])
  })

  it('collapses to a single day when only today has practice', () => {
    expect(trendDays([mk('2026-06-06')], '2026-06-06', 14)).toEqual(['2026-06-06'])
  })

  it('ignores days with no answers when finding the start', () => {
    // The 06-01 row has no answers, so the axis starts at the first answered day.
    const rows = [mk('2026-06-01', 0), mk('2026-06-05')]
    expect(trendDays(rows, '2026-06-06', 14)).toEqual(['2026-06-05', '2026-06-06'])
  })

  it('falls back to the full window when there are no answers', () => {
    expect(trendDays([], '2026-06-06', 14)).toEqual(recentDays('2026-06-06', 14))
  })
})

describe('accuracyByDay', () => {
  it('aggregates per day and applies the scope filter', () => {
    const all = accuracyByDay(rows, () => true)
    // 2026-05-04: correct 3+1=4 of answered 4+2=6 -> 67%
    expect(all.get('2026-05-04')).toEqual({ accuracy: 67, answered: 6 })
    // 2026-05-06: 2 of 2 -> 100%; 2026-05-11: 0 of 1 -> 0%
    expect(all.get('2026-05-06')).toEqual({ accuracy: 100, answered: 2 })
    expect(all.get('2026-05-11')).toEqual({ accuracy: 0, answered: 1 })
  })
  it('filters to a single étude scope', () => {
    const scales = accuracyByDay(rows, (r) => r.etude_id === 'scales')
    // 2026-05-04 scales only: 3 of 4 -> 75%
    expect(scales.get('2026-05-04')).toEqual({ accuracy: 75, answered: 4 })
  })
  it('omits days with no answers', () => {
    const none = accuracyByDay(
      [{ day: '2026-05-04', etude_id: 'scales', level: 1, version: 1, seconds: 120, answered: 0, correct: 0 }],
      () => true,
    )
    expect(none.size).toBe(0)
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

describe('monthCsv', () => {
  const label = (id: string): string =>
    ({ scales: 'Scale Recognition', chords: 'Chord Recognition' })[id] ?? id
  const lvl = (_id: string, level: number): string =>
    level === 0 ? '' : ['Easy', 'Medium', 'Hard'][level - 1] ?? `Level ${level}`
  const may: PracticeHistoryRow[] = [
    // same étude/day at two levels → two rows; also a second version of Easy.
    { day: '2026-05-04', etude_id: 'chords', level: 1, version: 1, seconds: 480, answered: 5, correct: 4 },
    { day: '2026-05-04', etude_id: 'chords', level: 3, version: 1, seconds: 240, answered: 3, correct: 1 },
    { day: '2026-05-04', etude_id: 'chords', level: 1, version: 2, seconds: 120, answered: 2, correct: 2 },
    { day: '2026-05-05', etude_id: 'scales', level: 0, version: 1, seconds: 120, answered: 4, correct: 3 }, // unleveled → blank
    { day: '2026-05-06', etude_id: 'chords', level: 1, version: 1, seconds: 30, answered: 2, correct: 1 }, // <1min → excluded
    { day: '2026-05-07', etude_id: 'chords', level: 2, version: 1, seconds: 180, answered: 4, correct: 0 }, // 0 correct → excluded
    { day: '2026-06-01', etude_id: 'scales', level: 0, version: 1, seconds: 300, answered: 3, correct: 3 }, // other month → excluded
  ]
  const lines = () => monthCsv(may, 2026, 4, label, lvl).replace(/^﻿/, '').split('\r\n')

  it('starts with the header and a BOM', () => {
    expect(monthCsv(may, 2026, 4, label, lvl).startsWith('﻿')).toBe(true)
    expect(lines()[0]).toBe('Date,Étude,Level,Version,Tempo (BPM),Minutes,Answered,Correct,Accuracy %')
  })

  it('splits a day/étude into per-(level, version) rows; blank level for unleveled', () => {
    expect(lines()).toEqual([
      'Date,Étude,Level,Version,Tempo (BPM),Minutes,Answered,Correct,Accuracy %',
      '2026-05-04,Chord Recognition,Easy,1,,8,5,4,80',
      '2026-05-04,Chord Recognition,Easy,2,,2,2,2,100',
      '2026-05-04,Chord Recognition,Hard,1,,4,3,1,33',
      '2026-05-05,Scale Recognition,,1,,2,4,3,75',
    ])
  })

  it('omits sub-minute, no-correct-answer, and other-month rows', () => {
    const body = lines().slice(1)
    expect(body.some((l) => l.startsWith('2026-05-06'))).toBe(false) // <1min
    expect(body.some((l) => l.startsWith('2026-05-07'))).toBe(false) // 0 correct
    expect(body.some((l) => l.startsWith('2026-06'))).toBe(false) // other month
  })

  it('returns header only for a month with no qualifying practice', () => {
    expect(monthCsv(may, 2026, 0, label, lvl).replace(/^﻿/, '')).toBe(
      'Date,Étude,Level,Version,Tempo (BPM),Minutes,Answered,Correct,Accuracy %',
    )
  })

  it('quotes labels containing commas', () => {
    const out = monthCsv(
      [{ day: '2026-05-04', etude_id: 'x', level: 0, version: 1, seconds: 120, answered: 1, correct: 1 }],
      2026,
      4,
      () => 'A, B',
      () => '',
    ).replace(/^﻿/, '')
    expect(out.split('\r\n')[1]).toBe('2026-05-04,"A, B",,1,,2,1,1,100')
  })

  it('emits the practised tempo (BPM) when present, blank otherwise', () => {
    const out = monthCsv(
      [
        { day: '2026-05-04', etude_id: 'rhythm-tap', level: 1, version: 1, seconds: 120, answered: 3, correct: 3, tempo: 90 },
        { day: '2026-05-04', etude_id: 'scales', level: 0, version: 1, seconds: 120, answered: 2, correct: 2 },
      ],
      2026,
      4,
      (id) => id,
      () => '',
    ).replace(/^﻿/, '')
    const body = out.split('\r\n').slice(1)
    expect(body).toContain('2026-05-04,rhythm-tap,,1,90,2,3,3,100')
    expect(body).toContain('2026-05-04,scales,,1,,2,2,2,100')
  })
})
