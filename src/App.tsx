import { useMemo, useRef, useState } from 'react'
import type { SrsData } from './contracts'
import { generateAllQuestions } from './questions'
import {
  exportJson,
  getState,
  importJson,
  initialState,
  isDue,
  load,
  save,
} from './srs'
import ReviewSession from './components/ReviewSession'
import Button from './components/Button'

export default function App() {
  const bank = useMemo(() => generateAllQuestions(), [])
  const [data, setData] = useState<SrsData>(() => load())
  // Bumped on import so the session restarts against the new data.
  const [sessionKey, setSessionKey] = useState(0)
  const [notice, setNotice] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const now = Date.now()
  const dueCount = bank.filter((q) =>
    isDue(getState(data, q.id) ?? initialState(now), now),
  ).length
  const studiedCount = bank.filter(
    (q) => (getState(data, q.id)?.reps ?? 0) > 0,
  ).length

  function handleExport() {
    const json = exportJson(load())
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'music-theory-progress.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text()
      const imported = importJson(text)
      save(imported)
      setData(imported)
      setSessionKey((k) => k + 1)
      setNotice({ kind: 'ok', text: 'Progress imported.' })
    } catch (err) {
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Import failed.',
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Music Theory</h1>
              <p className="mt-1 text-slate-500">
                Keys &amp; relative minors — spaced repetition
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleExport}>
                Export
              </Button>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImportFile(file)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{dueCount}</span> due
            now · <span className="font-semibold text-slate-700">{bank.length}</span>{' '}
            total ·{' '}
            <span className="font-semibold text-slate-700">{studiedCount}</span>{' '}
            studied
          </p>

          {notice && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                notice.kind === 'ok'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {notice.text}
            </p>
          )}
        </header>

        <main>
          <ReviewSession
            key={sessionKey}
            data={data}
            onDataChange={setData}
          />
        </main>
      </div>
    </div>
  )
}
