/**
 * Pure aggregation over the synced practice log (no React, no Supabase) — used by
 * the Practice History dashboard and unit-tested in isolation. Each input row is
 * one (day, étude) record from the `practice_time` table.
 */

export interface PracticeHistoryRow {
  day: string // 'YYYY-MM-DD'
  etude_id: string
  seconds: number
  answered: number
  correct: number
}

export interface EtudeDayStat {
  seconds: number
  answered: number
  correct: number
}

export interface DayStat {
  totalSeconds: number
  totalAnswered: number
  totalCorrect: number
  perEtude: Record<string, EtudeDayStat>
}

/** correct/answered as a 0–100 integer; 0 when nothing was answered. */
export function accuracyPct(correct: number, answered: number): number {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0
}

/** Group rows by calendar day, with a per-étude breakdown and day totals. */
export function aggregateByDay(rows: PracticeHistoryRow[]): Record<string, DayStat> {
  const out: Record<string, DayStat> = {}
  for (const r of rows) {
    const d = (out[r.day] ??= {
      totalSeconds: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      perEtude: {},
    })
    d.totalSeconds += r.seconds
    d.totalAnswered += r.answered
    d.totalCorrect += r.correct
    const e = (d.perEtude[r.etude_id] ??= { seconds: 0, answered: 0, correct: 0 })
    e.seconds += r.seconds
    e.answered += r.answered
    e.correct += r.correct
  }
  return out
}

export interface HistorySummary {
  totalSeconds: number
  totalAnswered: number
  totalCorrect: number
  /** Days with any practice *time* (a day with answers but no time is degenerate). */
  daysPracticed: number
}

export function summarize(byDay: Record<string, DayStat>): HistorySummary {
  let totalSeconds = 0
  let totalAnswered = 0
  let totalCorrect = 0
  let daysPracticed = 0
  for (const d of Object.values(byDay)) {
    totalSeconds += d.totalSeconds
    totalAnswered += d.totalAnswered
    totalCorrect += d.totalCorrect
    if (d.totalSeconds > 0) daysPracticed++
  }
  return { totalSeconds, totalAnswered, totalCorrect, daysPracticed }
}

/** Sunday-start week key (date-only, UTC) for a 'YYYY-MM-DD' day. */
function weekStartOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return date.toISOString().slice(0, 10)
}

export interface TrendPoint {
  weekStart: string
  accuracy: number
  answered: number
}

/**
 * Weekly accuracy series for the rows matching `filter` (scope = overall /
 * section / étude). One point per week that has answers, chronological.
 */
export function weeklyAccuracy(
  rows: PracticeHistoryRow[],
  filter: (row: PracticeHistoryRow) => boolean,
): TrendPoint[] {
  const byWeek: Record<string, { answered: number; correct: number }> = {}
  for (const r of rows) {
    if (!filter(r) || r.answered <= 0) continue
    const b = (byWeek[weekStartOf(r.day)] ??= { answered: 0, correct: 0 })
    b.answered += r.answered
    b.correct += r.correct
  }
  return Object.entries(byWeek)
    .map(([weekStart, b]) => ({
      weekStart,
      accuracy: accuracyPct(b.correct, b.answered),
      answered: b.answered,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

export interface EtudeAccuracy {
  correct: number
  answered: number
  accuracy: number
}

/** Lifetime accuracy per étude (for the ranked "what to work on" list). */
export function etudeAccuracy(
  rows: PracticeHistoryRow[],
): Record<string, EtudeAccuracy> {
  const out: Record<string, EtudeAccuracy> = {}
  for (const r of rows) {
    const e = (out[r.etude_id] ??= { correct: 0, answered: 0, accuracy: 0 })
    e.correct += r.correct
    e.answered += r.answered
  }
  for (const e of Object.values(out)) e.accuracy = accuracyPct(e.correct, e.answered)
  return out
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * One month of practice as CSV: a row per (day, étude) with ≥ 1 min of practice —
 * Date, Étude, Minutes, Answered, Correct, Accuracy %. Days with no qualifying
 * practice are omitted; sub-minute études are dropped to keep it compact.
 * Accuracy is blank for time-only (unanswered) études. `etudeLabel` resolves the
 * same descriptive labels used elsewhere. UTF-8 BOM + CRLF for Excel.
 */
export function monthCsv(
  byDay: Record<string, DayStat>,
  year: number,
  month0: number,
  etudeLabel: (id: string) => string,
): string {
  const lines = ['Date,Étude,Minutes,Answered,Correct,Accuracy %']
  const days = new Date(year, month0 + 1, 0).getDate()
  for (let d = 1; d <= days; d++) {
    const date = `${year}-${pad2(month0 + 1)}-${pad2(d)}`
    const stat = byDay[date]
    if (!stat) continue
    const entries = Object.entries(stat.perEtude)
      .filter(([, e]) => e.seconds >= 60)
      .map(([id, e]) => ({ label: etudeLabel(id), e }))
      .sort((a, b) => a.label.localeCompare(b.label))
    for (const { label, e } of entries) {
      const acc = e.answered > 0 ? String(accuracyPct(e.correct, e.answered)) : ''
      lines.push(
        [date, csvField(label), Math.round(e.seconds / 60), e.answered, e.correct, acc].join(','),
      )
    }
  }
  return '﻿' + lines.join('\r\n')
}
