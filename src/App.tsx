import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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
import AboutPage from './components/AboutPage'
import IntervalSongs from './components/IntervalSongs'
import { intervalSongBySemitones } from './intervalSongs'
import InfoBox from './components/InfoBox'
import { etudeReference } from './components/references'
import Button from './components/Button'
import { isMuted, setMuted } from './audio/player'
import { useConfirmTap } from './touch'
import { formatMinutes, getTodaySeconds, resetAllSeconds } from './time'
import { getSavedLevel, saveLevel } from './levels'
import { remainingDue } from './dueCap'
import { useEtudeTimer } from './useEtudeTimer'

// ---- URL routing: one clean path per étude (and /about) under the Vite base -
const BASE = import.meta.env.BASE_URL // "/music-theory/" in prod, "/" in dev

/** Single-segment routes: each étude id, the About page, the song index. */
const ROUTES = new Set<string>([
  ...ETUDES.map((e) => e.id),
  'about',
  'interval-songs',
])

/**
 * The route in the current URL — an étude id, "about", "interval-songs", or
 * "interval-songs/<semitones>" — or null for the home screen.
 */
function routeFromLocation(): string | null {
  let rest = window.location.pathname
  if (rest.startsWith(BASE)) rest = rest.slice(BASE.length)
  rest = rest.replace(/^\/+|\/+$/g, '')
  if (ROUTES.has(rest)) return rest
  const song = /^interval-songs\/(\d+)$/.exec(rest)
  if (song && intervalSongBySemitones(Number(song[1]))) return rest
  return null
}

/** Absolute path for a route (or the home screen when null). */
function pathForRoute(route: string | null): string {
  return route === null ? BASE : `${BASE}${route}`
}

export default function App() {
  const allQuestions = useMemo(() => generateAllQuestions(), [])
  const [data, setData] = useState<SrsData>(() => load())
  const [route, setRoute] = useState<string | null>(() => routeFromLocation())
  const [soundOn, setSoundOn] = useState(() => !isMuted())
  // Bumped on import so the session restarts against the new data.
  const [sessionKey, setSessionKey] = useState(0)
  // Force a re-read of today's practice time after a global reset.
  const [, refreshPractice] = useReducer((n: number) => n + 1, 0)
  const [notice, setNotice] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync the screen with the URL on browser back/forward.
  useEffect(() => {
    const onPop = () => setRoute(routeFromLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Reflect the current screen in the tab title.
  useEffect(() => {
    const etude = ETUDES.find((e) => e.id === route)
    document.title = etude
      ? `${etude.title} · Music Theory`
      : route === 'about'
        ? 'About · Music Theory'
        : route?.startsWith('interval-songs')
          ? 'Interval songs · Music Theory'
          : 'Music Theory'
  }, [route])

  /** Navigate to a route (étude id or "about"), or home when null. */
  function navigate(next: string | null) {
    if (next === route) return
    window.history.pushState(null, '', pathForRoute(next))
    setRoute(next)
  }

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

  // Import overwrites progress — on touch, tap once to arm, again to open the
  // file picker (mouse opens it in one click).
  const importTap = useConfirmTap(() => fileInputRef.current?.click())

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
      <Button variant="secondary" onClick={importTap.onClick}>
        {importTap.armed ? 'Confirm?' : 'Import'}
      </Button>
      <Button variant="secondary" onClick={() => navigate('about')}>
        About
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

  const selectedEtude = ETUDES.find((e) => e.id === route) ?? null
  const songRoute = route?.startsWith('interval-songs') ?? false
  const songSemitones = route?.includes('/')
    ? Number(route.split('/')[1])
    : null

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        {route === 'about' ? (
          // ---- About page --------------------------------------------------
          <AboutPage onBack={() => navigate(null)} />
        ) : songRoute ? (
          // ---- Interval-song reference pages -------------------------------
          <IntervalSongs semitones={songSemitones} onNavigate={navigate} />
        ) : selectedEtude === null ? (
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
                practiceSeconds={getTodaySeconds()}
                onSelect={navigate}
                onResetAll={() => {
                  resetAllSeconds()
                  refreshPractice()
                }}
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
            onBack={() => navigate(null)}
            onNavigate={navigate}
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
  onNavigate: (route: string | null) => void
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
  onNavigate,
  ioButtons,
  noticeBanner,
}: EtudeScreenProps) {
  // Difficulty level (for études that define `levels`); 1-based, remembered
  // per étude across visits.
  const [level, setLevelState] = useState(() => {
    const saved = getSavedLevel(etude.id)
    return etude.levels ? Math.min(saved, etude.levels.length) : 1
  })
  const setLevel = (n: number) => {
    setLevelState(n)
    saveLevel(etude.id, n)
  }
  const fullBank = useMemo(
    () => allQuestions.filter((q) => q.etudeId === etude.id),
    [allQuestions, etude.id],
  )
  const bank = useMemo(
    () => (etude.levels ? fullBank.filter((q) => q.level === level) : fullBank),
    [fullBank, etude.levels, level],
  )

  const now = Date.now()
  const dueCount = Math.min(
    bank.filter((q) => isDue(getState(data, q.id) ?? initialState(now), now)).length,
    remainingDue(etude.id, now),
  )
  const studiedCount = bank.filter(
    (q) => (getState(data, q.id)?.reps ?? 0) > 0,
  ).length
  // The question currently shown (from ReviewSession), so the timer can cap
  // counted time per exercise at 15 s.
  const [currentQid, setCurrentQid] = useState<string | null>(null)
  const { seconds: practiceSeconds, reset: resetPractice } = useEtudeTimer(
    etude.id,
    currentQid,
  )
  const resetToday = useConfirmTap(resetPractice)
  const reference = etudeReference(etude.id)

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

        {etude.levels && (
          <div
            className="rise mt-5 flex items-center gap-3"
            style={{ animationDelay: '110ms' }}
          >
            <span className="marking text-ink-3">Level</span>
            <div className="inline-flex rounded-full border border-rule bg-card p-0.5">
              {etude.levels.map((label, i) => {
                const n = i + 1
                const active = n === level
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setLevel(n)}
                    aria-pressed={active}
                    className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-ink text-paper'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <dl
          className="rise mt-5 flex items-stretch gap-6"
          style={{ animationDelay: '140ms' }}
        >
          {[
            { n: dueCount, label: 'due now', accent: true },
            { n: bank.length, label: 'total' },
            { n: studiedCount, label: 'studied' },
            { n: formatMinutes(practiceSeconds), label: 'today' },
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

        <button
          type="button"
          onClick={resetToday.onClick}
          className={`marking rise mt-3 transition-colors ${
            resetToday.armed ? 'text-wrong' : 'text-ink-3 hover:text-wrong'
          }`}
          style={{ animationDelay: '150ms' }}
        >
          {resetToday.armed ? 'tap to confirm' : 'reset today’s time'}
        </button>

        {noticeBanner}
      </header>

      <main className="rise" style={{ animationDelay: '200ms' }}>
        {reference && (
          <div className="mb-5">
            <InfoBox
              title={reference.title}
              defaultOpen={reference.defaultOpen}
              storageKey={`infobox:${etude.id}`}
            >
              {reference.body}
              {reference.link && (
                <button
                  type="button"
                  onClick={() => onNavigate(reference.link!.route)}
                  className="marking mt-3 inline-block text-accent transition-colors hover:text-ink"
                >
                  {reference.link.label}
                </button>
              )}
            </InfoBox>
          </div>
        )}
        <ReviewSession
          key={`${etude.id}:${level}:${sessionKey}`}
          bank={bank}
          etudeId={etude.id}
          data={data}
          onDataChange={setData}
          onQuestionChange={setCurrentQid}
        />
      </main>
    </>
  )
}
