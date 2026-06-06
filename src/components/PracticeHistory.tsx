import { useEffect, useMemo, useState } from 'react'
import { ETUDES } from '../questions'
import { formatMinutes, localDate } from '../time'
import { pullPracticeHistory } from '../supabase/sync'
import {
  accuracyByDay,
  accuracyPct,
  aggregateByDay,
  etudeAccuracy,
  monthCsv,
  summarize,
  trendDays,
  type PracticeHistoryRow,
} from '../practiceHistory'
import { PRACTICE_LABELS } from './EtudeMenu'
import Button from './Button'
import LineChart, { type ChartSeries } from './LineChart'

const ETUDE_SECTION: Record<string, string> = Object.fromEntries(
  ETUDES.map((e) => [e.id, e.section]),
)
const SECTIONS = [...new Set(ETUDES.map((e) => e.section))]
// Series colors drawn only from existing tokens (claret / gold / secondary ink).
const SECTION_COLORS = ['#7a2540', '#b08d57', '#5a5142']
const ACCENT = '#7a2540'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
type Scope = 'overall' | 'sections' | 'etude'
/** Accuracy trend window: the past two weeks, daily. */
const TREND_DAYS = 14

const pad = (n: number) => String(n).padStart(2, '0')
const dayStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const etudeLabel = (id: string) =>
  PRACTICE_LABELS[id] ?? ETUDES.find((e) => e.id === id)?.title ?? id
const levelLabel = (etudeId: string, level: number): string =>
  level === 0 ? '' : (ETUDES.find((e) => e.id === etudeId)?.levels?.[level - 1] ?? `Level ${level}`)

function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function monthLabel(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Trigger a client-side file download of `text`. */
function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Claret tint by minutes practiced — the calendar heatmap scale. */
function tintAlpha(minutes: number): number {
  if (minutes <= 0) return 0
  if (minutes < 5) return 0.12
  if (minutes < 15) return 0.28
  if (minutes < 30) return 0.45
  if (minutes < 60) return 0.65
  return 0.82
}

export default function PracticeHistory({
  onBack,
  signedIn,
}: {
  onBack: () => void
  signedIn: boolean
}) {
  const [rows, setRows] = useState<PracticeHistoryRow[] | null>(null)
  const [scope, setScope] = useState<Scope>('overall')
  const [pickedEtude, setPickedEtude] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const today = localDate()
  const [ty, tmRaw] = today.split('-').map(Number)
  const tm = tmRaw - 1 // 0-based month
  const [view, setView] = useState<{ y: number; m: number }>({ y: ty, m: tm })

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    void pullPracticeHistory().then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [signedIn])

  const byDay = useMemo(() => aggregateByDay(rows ?? []), [rows])
  const summary = useMemo(() => summarize(byDay), [byDay])
  const ranked = useMemo(() => {
    const acc = etudeAccuracy(rows ?? [])
    return ETUDES.map((e) => ({
      id: e.id,
      ...(acc[e.id] ?? { correct: 0, answered: 0, accuracy: 0 }),
    }))
      .filter((e) => e.answered > 0)
      .sort((a, b) => a.accuracy - b.accuracy)
  }, [rows])

  const effectiveEtude = pickedEtude ?? ranked[0]?.id ?? ETUDES[0].id

  // Daily accuracy over the past two weeks, on a date axis so an upward trajectory
  // reads clearly. The axis trims to the days actually practised when there's less
  // than two weeks of history. Days with no practice are gaps (null); the chart
  // bridges them so the line stays continuous.
  const trend = useMemo(() => {
    const data = rows ?? []
    const axis = trendDays(data, today, TREND_DAYS)
    const xLabels = axis.map(shortDate)
    const seriesFor = (
      label: string,
      color: string,
      filter: (r: PracticeHistoryRow) => boolean,
    ): ChartSeries => {
      const byDay = accuracyByDay(data, filter)
      return { label, color, values: axis.map((d) => byDay.get(d)?.accuracy ?? null) }
    }
    if (scope === 'overall') {
      return { xLabels, series: [seriesFor('Overall', ACCENT, () => true)] }
    }
    if (scope === 'etude') {
      return {
        xLabels,
        series: [seriesFor(etudeLabel(effectiveEtude), ACCENT, (r) => r.etude_id === effectiveEtude)],
      }
    }
    const series = SECTIONS.map((s, i) =>
      seriesFor(s, SECTION_COLORS[i % SECTION_COLORS.length], (r) => ETUDE_SECTION[r.etude_id] === s),
    )
    return { xLabels, series }
  }, [rows, scope, effectiveEtude, today])

  const trendHasData = trend.series.some((s) => s.values.some((v) => v != null))

  const firstDay = useMemo(
    () => (rows && rows.length ? rows.reduce((min, r) => (r.day < min ? r.day : min), rows[0].day) : today),
    [rows, today],
  )
  const [fy, fmRaw] = firstDay.split('-').map(Number)
  const firstIdx = fy * 12 + (fmRaw - 1)
  const todayIdx = ty * 12 + tm
  const viewIdx = view.y * 12 + view.m
  const stepMonth = (delta: number) => {
    const i = viewIdx + delta
    if (i < firstIdx || i > todayIdx) return
    setView({ y: Math.floor(i / 12), m: i % 12 })
    setSelectedDay(null)
  }

  const header = (
    <header className="mb-9">
      <button
        type="button"
        onClick={onBack}
        className="marking rise text-ink-3 transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        ← All études
      </button>
      <div className="rise mt-4" style={{ animationDelay: '40ms' }}>
        <p className="marking text-accent">History</p>
        <h1 className="mt-2 font-display text-[2.75rem] font-medium leading-[0.95] tracking-[-0.02em] text-ink sm:text-5xl">
          Practice <span className="italic">History</span>
        </h1>
        <p className="mt-2 text-ink-2">Time practiced and accuracy over time, since you signed in</p>
      </div>
      <div className="rise staff-rule mt-6" style={{ animationDelay: '80ms' }} />
    </header>
  )

  if (!signedIn) {
    return (
      <>
        {header}
        <div className="rise rounded-2xl border border-rule bg-card px-6 py-10 text-center">
          <p className="text-ink-2">
            Sign in (top right) to sync your practice across devices and see your history here.
          </p>
        </div>
      </>
    )
  }

  if (rows === null) {
    return (
      <>
        {header}
        <p className="marking rise text-ink-3">Loading…</p>
      </>
    )
  }

  if (rows.length === 0 || summary.totalSeconds === 0) {
    return (
      <>
        {header}
        <div className="rise rounded-2xl border border-rule bg-card px-6 py-10 text-center">
          <p className="text-ink-2">
            No practice recorded yet. Answer some questions while signed in and they’ll show up here.
          </p>
        </div>
      </>
    )
  }

  const overallAccuracy = accuracyPct(summary.totalCorrect, summary.totalAnswered)
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const lead = new Date(view.y, view.m, 1).getDay()
  const detail = selectedDay ? byDay[selectedDay] : null
  const monthPrefix = `${view.y}-${pad(view.m + 1)}-`
  const monthHasData = Object.entries(byDay).some(
    ([d, s]) => d.startsWith(monthPrefix) && s.totalSeconds > 0,
  )
  const exportMonth = () =>
    downloadCsv(
      `music-theory-${view.y}-${pad(view.m + 1)}.csv`,
      monthCsv(rows ?? [], view.y, view.m, etudeLabel, levelLabel),
    )

  return (
    <>
      {header}

      {/* Summary strip */}
      <dl className="rise flex items-stretch gap-6" style={{ animationDelay: '120ms' }}>
        {[
          { n: formatMinutes(summary.totalSeconds), label: 'total time' },
          { n: summary.daysPracticed, label: 'days practiced' },
          { n: `${overallAccuracy}%`, label: 'accuracy', accent: true },
        ].map((s, i) => (
          <div key={s.label} className="flex items-stretch gap-6">
            {i > 0 && <span className="w-px self-stretch bg-rule" />}
            <div>
              <dd className={`font-display text-2xl leading-none ${s.accent ? 'text-accent' : 'text-ink'}`}>{s.n}</dd>
              <dt className="marking mt-1.5 text-ink-3">{s.label}</dt>
            </div>
          </div>
        ))}
      </dl>

      {/* Accuracy trends */}
      <section className="rise mt-10" style={{ animationDelay: '160ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="marking text-ink-2">Accuracy over time · past 2 weeks</h2>
          <div className="inline-flex rounded-full border border-rule bg-card p-0.5">
            {(['overall', 'sections', 'etude'] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                aria-pressed={scope === s}
                className={`rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors ${
                  scope === s ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {s === 'etude' ? 'Étude' : s}
              </button>
            ))}
          </div>
        </div>

        {scope === 'sections' && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {trend.series.map((s) => (
              <span key={s.label} className="marking inline-flex items-center gap-1.5 text-ink-3">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4">
          {trendHasData ? (
            <LineChart
              xLabels={trend.xLabels}
              series={trend.series}
              ariaLabel="Accuracy over the past 2 weeks"
              connectGaps
            />
          ) : (
            <p className="text-sm text-ink-3">No answers in the past 2 weeks yet to chart a trend.</p>
          )}
        </div>

        {scope === 'etude' && (
          <ul className="mt-5 space-y-1.5">
            {ranked.map((e) => {
              const active = e.id === effectiveEtude
              const tone = e.accuracy < 60 ? 'text-wrong' : e.accuracy >= 85 ? 'text-correct' : 'text-ink'
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setPickedEtude(e.id)}
                    aria-pressed={active}
                    className={`flex w-full items-baseline justify-between gap-4 rounded-lg px-3 py-2 text-left transition-colors ${
                      active ? 'bg-card ring-1 ring-ink' : 'hover:bg-card'
                    }`}
                  >
                    <span className="text-sm text-ink-2">{etudeLabel(e.id)}</span>
                    <span className={`font-mono text-sm ${tone}`}>
                      {e.accuracy}% <span className="text-ink-3">· {e.answered}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Month calendar */}
      <section className="rise mt-10" style={{ animationDelay: '200ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="marking text-ink-2">Calendar</h2>
            <Button variant="secondary" onClick={exportMonth} disabled={!monthHasData}>
              Export CSV
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              disabled={viewIdx <= firstIdx}
              className="marking px-2 text-ink-3 transition-colors hover:text-ink disabled:opacity-30"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="font-display text-lg text-ink">{monthLabel(view.y, view.m)}</span>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              disabled={viewIdx >= todayIdx}
              className="marking px-2 text-ink-3 transition-colors hover:text-ink disabled:opacity-30"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="marking pb-1 text-center text-ink-3">
              {w}
            </div>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <div key={`lead-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const ds = dayStr(view.y, view.m, d)
            const stat = byDay[ds]
            const minutes = (stat?.totalSeconds ?? 0) / 60
            const alpha = tintAlpha(minutes)
            const future = ds > today
            const hasData = !!stat && stat.totalSeconds > 0
            const text = future
              ? 'text-ink-3 opacity-40'
              : alpha >= 0.45
                ? 'text-paper'
                : hasData
                  ? 'text-ink'
                  : 'text-ink-3'
            const acc = stat ? accuracyPct(stat.totalCorrect, stat.totalAnswered) : 0
            return (
              <button
                key={ds}
                type="button"
                disabled={!hasData}
                onClick={() => setSelectedDay(ds)}
                aria-label={
                  hasData
                    ? `${ds}: ${formatMinutes(stat!.totalSeconds)}${stat!.totalAnswered ? `, ${acc}% accuracy` : ''}`
                    : ds
                }
                className={`aspect-square rounded-md border text-sm transition-colors ${text} ${
                  selectedDay === ds ? 'border-ink ring-1 ring-ink' : 'border-rule'
                } ${hasData ? 'cursor-pointer hover:border-ink' : 'cursor-default'}`}
                style={{ backgroundColor: alpha > 0 ? `rgba(122,37,64,${alpha})` : undefined }}
              >
                {d}
              </button>
            )
          })}
        </div>

        {detail && selectedDay && (
          <div className="ink mt-5 rounded-2xl border border-rule bg-card px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-lg text-ink">{shortDate(selectedDay)}</p>
              <p className="marking text-ink-3">
                {formatMinutes(detail.totalSeconds)}
                {detail.totalAnswered > 0 && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span className="text-accent">
                      {accuracyPct(detail.totalCorrect, detail.totalAnswered)}%
                    </span>
                  </>
                )}
              </p>
            </div>
            <dl className="mt-3 space-y-1.5">
              {Object.entries(detail.perEtude)
                .sort((a, b) => b[1].seconds - a[1].seconds)
                .map(([id, e]) => (
                  <div key={id} className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-ink-2">{etudeLabel(id)}</dt>
                    <dd className="font-mono text-sm text-ink-2">
                      {formatMinutes(e.seconds)}
                      <span className="mx-1.5 text-ink-3">·</span>
                      {e.answered > 0 ? `${accuracyPct(e.correct, e.answered)}%` : '—'}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </section>
    </>
  )
}
