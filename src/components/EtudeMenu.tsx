import { Fragment } from 'react'
import type { Etude, Question, SrsData } from '../contracts'
import { getState, initialState, isDue } from '../srs'
import { formatMinutes } from '../time'
import { remainingDue, windowResetAt } from '../dueCap'

interface EtudeMenuProps {
  etudes: Etude[]
  /** The full question bank; filtered per étude by etudeId. */
  allQuestions: Question[]
  data: SrsData
  /** Seconds practiced today, keyed by étude id. */
  practiceSeconds: Record<string, number>
  onSelect: (etudeId: string) => void
}

/** A score "table of contents": one clickable row per étude. */
export default function EtudeMenu({
  etudes,
  allQuestions,
  data,
  practiceSeconds,
  onSelect,
}: EtudeMenuProps) {
  const now = Date.now()

  // Practice-time totals for today — per section, and overall. Minutes are
  // rounded, and the total is the sum of the rounded sections so they add up.
  const sectionSeconds = (s: string) =>
    etudes
      .filter((e) => e.section === s)
      .reduce((sum, e) => sum + (practiceSeconds[e.id] ?? 0), 0)
  const sectionMinutes: { section: string; minutes: number }[] = []
  for (const e of etudes) {
    if (sectionMinutes.some((x) => x.section === e.section)) continue
    sectionMinutes.push({
      section: e.section,
      minutes: Math.round(sectionSeconds(e.section) / 60),
    })
  }
  const totalMinutes = sectionMinutes.reduce((sum, x) => sum + x.minutes, 0)

  return (
    <>
      <ul className="space-y-3">
      {etudes.map((e, i) => {
        const questions = allQuestions.filter((q) => q.etudeId === e.id)
        const total = questions.length
        const due = questions.filter((q) =>
          isDue(getState(data, q.id) ?? initialState(now), now),
        ).length
        const studied = questions.filter(
          (q) => (getState(data, q.id)?.reps ?? 0) > 0,
        ).length
        const progress = total > 0 ? (studied / total) * 100 : 0

        // Cap the shown "due" to this étude's 5-hour batch allowance.
        const dueShown = Math.min(due, remainingDue(e.id, now))
        const cappedOut = due > 0 && dueShown === 0
        const resetAt = cappedOut ? windowResetAt(e.id, now) : null
        const hoursToReset = resetAt
          ? Math.max(1, Math.ceil((resetAt - now) / 3_600_000))
          : 0

        const showHeader = i === 0 || etudes[i - 1].section !== e.section
        return (
          <Fragment key={e.id}>
            {showHeader && (
              <li
                className="rise flex items-center gap-3 pt-4 first:pt-0"
                style={{ animationDelay: `${260 + i * 70}ms` }}
              >
                <span className="marking text-accent">{e.section}</span>
                <span className="h-px flex-1 bg-rule/70" />
              </li>
            )}
            <li
              className="rise"
              style={{ animationDelay: `${260 + i * 70}ms` }}
            >
              <button
              type="button"
              onClick={() => onSelect(e.id)}
              className="group flex w-full items-center gap-5 rounded-2xl border border-rule bg-card px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-paper hover:ring-1 hover:ring-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:px-7 sm:py-6"
            >
              <span className="font-display text-4xl font-medium leading-none text-ink-3 transition-colors duration-200 group-hover:text-accent sm:text-5xl">
                {e.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-medium leading-tight tracking-[-0.01em] text-ink sm:text-2xl">
                  {e.title}
                </span>
                <span className="mt-1 block text-sm text-ink-2">
                  {e.subtitle}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="marking block text-ink-3">
                  {cappedOut ? (
                    <>
                      next batch{' '}
                      <span className="font-mono text-ink-2">~{hoursToReset}h</span>
                    </>
                  ) : (
                    <>
                      <span
                        className={`font-mono ${dueShown > 0 ? 'text-accent' : 'text-ink-3'}`}
                      >
                        {dueShown}
                      </span>{' '}
                      due
                    </>
                  )}
                </span>
                <span className="marking mt-1 block text-ink-3">
                  <span className="font-mono text-ink-2">
                    {studied}/{total}
                  </span>{' '}
                  studied
                </span>
                <span className="marking mt-1 block text-ink-3">
                  <span className="font-mono text-ink-2">
                    {formatMinutes(practiceSeconds[e.id] ?? 0)}
                  </span>{' '}
                  today
                </span>
                {/* progress hairline (studied / total) */}
                <span className="mt-2 block h-px w-24 bg-rule">
                  <span
                    className="block h-px bg-accent"
                    style={{ width: `${progress}%` }}
                  />
                </span>
              </span>
            </button>
            </li>
          </Fragment>
        )
      })}
    </ul>

      <div
        className="rise mt-8 rounded-2xl border border-rule bg-card px-5 py-4 sm:px-7"
        style={{ animationDelay: `${260 + etudes.length * 70}ms` }}
      >
        <p className="marking text-ink-3">Practice today</p>
        <dl className="mt-3 space-y-1.5">
          {sectionMinutes.map(({ section, minutes }) => (
            <div
              key={section}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="text-sm text-ink-2">{section}</dt>
              <dd className="font-mono text-sm text-ink-2">{minutes} min</dd>
            </div>
          ))}
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-rule pt-2">
            <dt className="marking text-ink">Total</dt>
            <dd className="font-mono text-base text-accent">{totalMinutes} min</dd>
          </div>
        </dl>
      </div>
    </>
  )
}
