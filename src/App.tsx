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
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <header className="mb-9">
          <div className="rise flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="marking text-accent">Étude · No. 1</p>
              <h1 className="mt-2 font-display text-[2.75rem] font-medium leading-[0.95] tracking-[-0.02em] text-ink sm:text-5xl">
                Music <span className="italic">Theory</span>
              </h1>
              <p className="mt-2 text-ink-2">
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

          {/* Decorative five-line staff. */}
          <div
            className="rise staff-rule mt-6"
            style={{ animationDelay: '80ms' }}
          />

          <dl
            className="rise mt-5 flex items-stretch gap-6"
            style={{ animationDelay: '140ms' }}
          >
            {[
              { n: dueCount, label: 'due now', accent: true },
              { n: bank.length, label: 'total' },
              { n: studiedCount, label: 'studied' },
            ].map((s, i) => (
              <div key={s.label} className="flex items-stretch gap-6">
                {i > 0 && <span className="w-px self-stretch bg-rule" />}
                <div>
                  <dd
                    className={`font-display text-2xl leading-none ${s.accent ? 'text-accent' : 'text-ink'}`}
                  >
                    {s.n}
                  </dd>
                  <dt className="marking mt-1.5 text-ink-3">{s.label}</dt>
                </div>
              </div>
            ))}
          </dl>

          {notice && (
            <p
              className={`ink mt-5 rounded-xl px-4 py-2.5 text-sm ring-1 ${
                notice.kind === 'ok'
                  ? 'bg-correct/10 text-correct ring-correct/30'
                  : 'bg-wrong/10 text-wrong ring-wrong/30'
              }`}
            >
              {notice.text}
            </p>
          )}
        </header>

        <main
          className="rise"
          style={{ animationDelay: '200ms' }}
        >
          <ReviewSession key={sessionKey} data={data} onDataChange={setData} />
        </main>

        <footer className="marking mt-10 text-center text-ink-3">
          ♪ practice daily · progress saved on this device
        </footer>
      </div>
    </div>
  )
}
