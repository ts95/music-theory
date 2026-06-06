/**
 * Pure aggregation over the synced practice log (no React, no Supabase) — used by
 * the Practice History dashboard and unit-tested in isolation. Each input row is
 * one (day, étude) record from the `practice_time` table.
 */

export interface PracticeHistoryRow {
  day: string // 'YYYY-MM-DD'
  etude_id: string
  level: number // 1-based difficulty; 0 = étude has no difficulty selector (also legacy/pre-versioning rows)
  version: number
  seconds: number
  answered: number
  correct: number
  /** BPM the session was practiced at, for études with a tempo (tap-along,
   *  rhythm-dictation); null/absent otherwise. */
  tempo?: number | null
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

/**
 * The `n` calendar days ending at (and including) `today`, as 'YYYY-MM-DD',
 * chronological. UTC date math, so it's stable regardless of the host timezone.
 * The accuracy trend uses this as a true time axis (a 2-week window = `n` 14).
 */
export function recentDays(today: string, n: number): string[] {
  const [y, m, d] = today.split('-').map(Number)
  const end = Date.UTC(y, m - 1, d)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(end)
    date.setUTCDate(date.getUTCDate() - i)
    out.push(date.toISOString().slice(0, 10))
  }
  return out
}

/**
 * The accuracy trend's day axis: the last `maxDays` days, but trimmed to start no
 * earlier than the first day with any answers — so a user with under two weeks of
 * history sees just the days they have, not a mostly-empty fortnight. Falls back
 * to the full window when there are no answers yet (the caller shows an empty
 * state in that case). The axis always ends at `today`.
 */
export function trendDays(
  rows: PracticeHistoryRow[],
  today: string,
  maxDays = 14,
): string[] {
  const full = recentDays(today, maxDays)
  let earliest: string | null = null
  for (const r of rows) {
    if (r.answered <= 0) continue
    if (earliest === null || r.day < earliest) earliest = r.day
  }
  if (earliest === null) return full
  return full.filter((d) => d >= earliest!)
}

export interface DayAccuracy {
  accuracy: number
  answered: number
}

/**
 * Per-day accuracy for the rows matching `filter` (scope = overall / section /
 * étude). Keyed by 'YYYY-MM-DD'; only days that have answers are present, so the
 * caller decides how to treat days with no practice (the trend plots them as a
 * gap on a fixed date axis). Aggregates all of a day's answers across levels.
 */
export function accuracyByDay(
  rows: PracticeHistoryRow[],
  filter: (row: PracticeHistoryRow) => boolean,
): Map<string, DayAccuracy> {
  const byDay: Record<string, { answered: number; correct: number }> = {}
  for (const r of rows) {
    if (!filter(r) || r.answered <= 0) continue
    const b = (byDay[r.day] ??= { answered: 0, correct: 0 })
    b.answered += r.answered
    b.correct += r.correct
  }
  const out = new Map<string, DayAccuracy>()
  for (const [day, b] of Object.entries(byDay)) {
    out.set(day, { accuracy: accuracyPct(b.correct, b.answered), answered: b.answered })
  }
  return out
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
 * One month of practice as CSV: a row per (day, étude, level, version) with ≥ 1
 * min of practice AND at least one correct answer — Date, Étude, Level, Version,
 * Tempo (BPM), Minutes, Answered, Correct, Accuracy %. The tempo column is blank
 * for études with no tempo. Sub-minute and no-correct-answer rows (incl. time-only
 * practice) are dropped to keep it compact. `etudeLabel` and `levelLabel` resolve
 * display names ('' level for unleveled). UTF-8 BOM + CRLF.
 */
export function monthCsv(
  rows: PracticeHistoryRow[],
  year: number,
  month0: number,
  etudeLabel: (id: string) => string,
  levelLabel: (etudeId: string, level: number) => string,
): string {
  const prefix = `${year}-${pad2(month0 + 1)}-`
  const out = rows
    .filter((r) => r.day.startsWith(prefix) && r.seconds >= 60 && r.correct >= 1)
    .map((r) => ({
      day: r.day,
      label: etudeLabel(r.etude_id),
      levelLabel: levelLabel(r.etude_id, r.level),
      level: r.level,
      version: r.version,
      tempo: r.tempo ?? '',
      minutes: Math.round(r.seconds / 60),
      answered: r.answered,
      correct: r.correct,
      accuracy: accuracyPct(r.correct, r.answered), // defined: filter ⇒ answered ≥ correct ≥ 1
    }))
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.label.localeCompare(b.label) ||
        a.level - b.level ||
        a.version - b.version,
    )
  const lines = ['Date,Étude,Level,Version,Tempo (BPM),Minutes,Answered,Correct,Accuracy %']
  for (const r of out) {
    lines.push(
      [
        r.day,
        csvField(r.label),
        csvField(r.levelLabel),
        r.version,
        r.tempo,
        r.minutes,
        r.answered,
        r.correct,
        r.accuracy,
      ].join(','),
    )
  }
  return '﻿' + lines.join('\r\n')
}
