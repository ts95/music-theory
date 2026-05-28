import { useEffect, useMemo } from 'react'
import type { Question } from '../contracts'
import Button from './Button'

interface QuestionCardProps {
  question: Question
  /** The choice index the user has selected, or null if unanswered. */
  selected: number | null
  onSelect: (choiceIndex: number) => void
  onNext: () => void
}

/** Fisher–Yates shuffle of [0, n). Returns the order of original indices. */
function shuffledOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

function choiceClasses(state: 'idle' | 'correct' | 'wrong' | 'muted'): string {
  switch (state) {
    case 'correct':
      return 'bg-emerald-50 ring-2 ring-emerald-500 text-emerald-900'
    case 'wrong':
      return 'bg-rose-50 ring-2 ring-rose-500 text-rose-900'
    case 'muted':
      return 'bg-white ring-1 ring-slate-200 text-slate-500'
    default:
      return 'bg-white ring-1 ring-slate-300 text-slate-800 hover:bg-indigo-50 hover:ring-indigo-400 active:bg-indigo-100'
  }
}

export default function QuestionCard({
  question,
  selected,
  onSelect,
  onNext,
}: QuestionCardProps) {
  // Shuffle once per presentation of a question, keyed to its id.
  const order = useMemo(
    () => shuffledOrder(question.choices.length),
    [question.id],
  )

  const answered = selected !== null
  const isCorrect = selected === question.answerIndex

  // Keyboard: number keys 1–N select; Enter advances once answered.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!answered && /^[1-9]$/.test(e.key)) {
        const pos = Number(e.key) - 1
        if (pos < order.length) onSelect(order[pos])
      } else if (answered && e.key === 'Enter') {
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, order, onSelect, onNext])

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
        {question.category}
      </p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">
        {question.prompt}
      </h2>

      <ul className="mt-6 space-y-3">
        {order.map((choiceIndex, pos) => {
          const isAnswer = choiceIndex === question.answerIndex
          const isChosen = choiceIndex === selected

          let state: 'idle' | 'correct' | 'wrong' | 'muted' = 'idle'
          if (answered) {
            if (isAnswer) state = 'correct'
            else if (isChosen) state = 'wrong'
            else state = 'muted'
          }

          return (
            <li key={choiceIndex}>
              <button
                type="button"
                disabled={answered}
                onClick={() => onSelect(choiceIndex)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium transition-colors disabled:cursor-default ${choiceClasses(state)}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                  {pos + 1}
                </span>
                <span className="flex-1">{question.choices[choiceIndex]}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {answered && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p
            className={`text-sm font-semibold ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {isCorrect
              ? 'Correct!'
              : `Not quite — the answer is ${question.choices[question.answerIndex]}.`}
          </p>
          <Button onClick={onNext} autoFocus>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
