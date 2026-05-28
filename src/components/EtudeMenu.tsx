import type { Etude, Question, SrsData } from '../contracts'
import { getState, initialState, isDue } from '../srs'

interface EtudeMenuProps {
  etudes: Etude[]
  /** The full question bank; filtered per étude by etudeId. */
  allQuestions: Question[]
  data: SrsData
  onSelect: (etudeId: string) => void
}

/** A score "table of contents": one clickable row per étude. */
export default function EtudeMenu({
  etudes,
  allQuestions,
  data,
  onSelect,
}: EtudeMenuProps) {
  const now = Date.now()

  return (
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

        return (
          <li
            key={e.id}
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
                  <span
                    className={`font-mono ${due > 0 ? 'text-accent' : 'text-ink-3'}`}
                  >
                    {due}
                  </span>{' '}
                  due
                </span>
                <span className="marking mt-1 block text-ink-3">
                  <span className="font-mono text-ink-2">
                    {studied}/{total}
                  </span>{' '}
                  studied
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
        )
      })}
    </ul>
  )
}
