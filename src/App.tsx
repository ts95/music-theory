import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { Etude, Question, SrsData } from './contracts'
import { ETUDES, generateAllQuestions } from './questions'
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
import EtudeMenu from './components/EtudeMenu'
import Button from './components/Button'
import { isMuted, setMuted } from './audio/player'

export default function App() {
  const allQuestions = useMemo(() => generateAllQuestions(), [])
  const [data, setData] = useState<SrsData>(() => load())
  const [selectedEtudeId, setSelectedEtudeId] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(() => !isMuted())
  // Bumped on import so the session restarts against the new data.
  const [sessionKey, setSessionKey] = useState(0)
  const [notice, setNotice] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    setMuted(!next)
  }

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

  const ioButtons = (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        onClick={toggleSound}
        aria-pressed={soundOn}
        title={soundOn ? 'Sound on (hover a choice to hear it)' : 'Sound off'}
      >
        {soundOn ? '♪ Sound' : '♪̶ Muted'}
      </Button>
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
  )

  const noticeBanner = notice && (
    <p
      className={`ink mt-5 rounded-xl px-4 py-2.5 text-sm ring-1 ${
        notice.kind === 'ok'
          ? 'bg-correct/10 text-correct ring-correct/30'
          : 'bg-wrong/10 text-wrong ring-wrong/30'
      }`}
    >
      {notice.text}
    </p>
  )

  const selectedEtude =
    selectedEtudeId === null
      ? null
      : (ETUDES.find((e) => e.id === selectedEtudeId) ?? null)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        {selectedEtude === null ? (
          // ---- Home screen: table of contents -----------------------------
          <>
            <header className="mb-9">
              <div className="rise flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="marking text-accent">Études</p>
                  <h1 className="mt-2 font-display text-[2.75rem] font-medium leading-[0.95] tracking-[-0.02em] text-ink sm:text-5xl">
                    Music <span className="italic">Theory</span>
                  </h1>
                  <p className="mt-2 text-ink-2">
                    Spaced-repetition exercises — choose an étude
                  </p>
                </div>
                {ioButtons}
              </div>

              {/* Decorative five-line staff. */}
              <div
                className="rise staff-rule mt-6"
                style={{ animationDelay: '80ms' }}
              />

              {noticeBanner}
            </header>

            <main>
              <EtudeMenu
                etudes={ETUDES}
                allQuestions={allQuestions}
                data={data}
                onSelect={setSelectedEtudeId}
              />
            </main>
          </>
        ) : (
          // ---- Étude screen: scoped study session --------------------------
          <EtudeScreen
            etude={selectedEtude}
            allQuestions={allQuestions}
            data={data}
            setData={setData}
            sessionKey={sessionKey}
            onBack={() => setSelectedEtudeId(null)}
            ioButtons={ioButtons}
            noticeBanner={noticeBanner}
          />
        )}

        <footer className="marking mt-10 text-center text-ink-3">
          ♪ practice daily · progress saved on this device
        </footer>
      </div>
    </div>
  )
}

interface EtudeScreenProps {
  etude: Etude
  allQuestions: Question[]
  data: SrsData
  setData: (data: SrsData) => void
  sessionKey: number
  onBack: () => void
  ioButtons: ReactNode
  noticeBanner: ReactNode
}

function EtudeScreen({
  etude,
  allQuestions,
  data,
  setData,
  sessionKey,
  onBack,
  ioButtons,
  noticeBanner,
}: EtudeScreenProps) {
  const bank = useMemo(
    () => allQuestions.filter((q) => q.etudeId === etude.id),
    [allQuestions, etude.id],
  )

  const now = Date.now()
  const dueCount = bank.filter((q) =>
    isDue(getState(data, q.id) ?? initialState(now), now),
  ).length
  const studiedCount = bank.filter(
    (q) => (getState(data, q.id)?.reps ?? 0) > 0,
  ).length

  return (
    <>
      <header className="mb-9">
        <button
          type="button"
          onClick={onBack}
          className="marking rise text-ink-3 transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          ← All études
        </button>

        <div className="rise mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="marking text-accent">Étude · No. {etude.number}</p>
            <h1 className="mt-2 font-display text-[2.75rem] font-medium leading-[0.95] tracking-[-0.02em] text-ink sm:text-5xl">
              {etude.title}
            </h1>
            <p className="mt-2 text-ink-2">{etude.subtitle}</p>
          </div>
          {ioButtons}
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

        {noticeBanner}
      </header>

      <main className="rise" style={{ animationDelay: '200ms' }}>
        <ReviewSession
          key={`${etude.id}:${sessionKey}`}
          bank={bank}
          data={data}
          onDataChange={setData}
        />
      </main>
    </>
  )
}
