import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { Playable, Question } from '../contracts'
import { isMuted, play, playEar, playRhythm, stop } from '../audio/player'
import { useIsTouch, wasTouch } from '../touch'
import {
  INTERVAL_ROOTS,
  keySignatureSpec,
  noteToString,
  progressionTonics,
  realizeEar,
  solfege,
  voicedMidi,
} from '../theory'
import Staff from './Staff'
import RhythmStaff from './RhythmStaff'
import PianoKeyboard from './PianoKeyboard'
import CircleOfFifths from './CircleOfFifths'
import Button from './Button'

interface QuestionCardProps {
  question: Question
  /** The choice index the user has selected, or null if unanswered. */
  selected: number | null
  /** True when the answer timer expired before a choice was made. */
  timedOut?: boolean
  /** If set, the question must be answered within this many ms. */
  timeLimitMs?: number
  onSelect: (choiceIndex: number) => void
  /** The user gave up — graded as the strongest lapse (resurface soon). */
  onDontKnow: () => void
  onNext: () => void
  onTimeout: () => void
}

type ChoiceState = 'idle' | 'correct' | 'wrong' | 'muted' | 'armed'

// `selected` sentinel for "I don't know" (kept in sync with ReviewSession).
const DONT_KNOW = -1

/** Fisher–Yates shuffle of [0, n). Returns the order of original indices. */
function shuffledOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** Row container styling per state. */
function rowClasses(state: ChoiceState): string {
  switch (state) {
    case 'correct':
      return 'bg-correct/10 ring-2 ring-correct'
    case 'wrong':
      return 'bg-wrong/10 ring-2 ring-wrong'
    case 'muted':
      return 'bg-card/60 ring-1 ring-rule opacity-55'
    case 'armed':
      // Touch: tapped once, awaiting a confirming second tap.
      return 'bg-paper ring-2 ring-ink -translate-y-0.5'
    default:
      return 'bg-card ring-1 ring-rule hover:ring-ink hover:bg-paper hover:-translate-y-0.5'
  }
}

/** The engraved numeral badge styling per state. */
function badgeClasses(state: ChoiceState): string {
  switch (state) {
    case 'correct':
      return 'bg-correct text-card ring-correct'
    case 'wrong':
      return 'bg-wrong text-card ring-wrong'
    case 'muted':
      return 'text-ink-3 ring-rule'
    case 'armed':
      return 'bg-ink text-paper ring-ink'
    default:
      return 'text-ink-2 ring-rule group-hover:bg-ink group-hover:text-paper group-hover:ring-ink'
  }
}

export default function QuestionCard({
  question,
  selected,
  timedOut = false,
  timeLimitMs,
  onSelect,
  onDontKnow,
  onNext,
  onTimeout,
}: QuestionCardProps) {
  // Shuffle once per presentation of a question, keyed to its id.
  const order = useMemo(
    () => shuffledOrder(question.choices.length),
    [question.id],
  )

  const answered = selected !== null || timedOut
  const isCorrect = selected === question.answerIndex

  // Keep onTimeout in a ref so an ancestor re-render (e.g. the per-second
  // practice-time tick) that changes its identity doesn't restart the
  // countdown effect below — which would reset the deadline forever.
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  // Countdown timer (only for timed questions). The card remounts per question
  // (keyed by id), so this effect starts fresh each time.
  const [remaining, setRemaining] = useState(timeLimitMs ?? 0)
  useEffect(() => {
    if (timeLimitMs === undefined || answered) return
    const deadline = Date.now() + timeLimitMs
    const id = setInterval(() => {
      const rem = deadline - Date.now()
      if (rem <= 0) {
        clearInterval(id)
        setRemaining(0)
        onTimeoutRef.current()
      } else {
        setRemaining(rem)
      }
    }, 100)
    return () => clearInterval(id)
  }, [timeLimitMs, answered])

  const timed = timeLimitMs !== undefined
  const pct = timed ? Math.max(0, (remaining / timeLimitMs) * 100) : 0
  const urgent = timed && remaining <= 2000

  // Ear-training: realize the prompt from a random root (stable across replays
  // within this presentation; a fresh root next time the card mounts).
  const ear = question.ear
  const earIsInterval = ear?.kind === 'interval'
  const earIsRhythm = ear?.kind === 'rhythm'
  const earIsMelody = ear?.kind === 'melody'
  const rhythmMeter = ear?.kind === 'rhythm' ? ear.meter : '4/4'
  // Rhythm prompts are pitch-agnostic, so they pick no tonic and aren't realized.
  const [earRoot] = useState(() => {
    if (!ear || ear.kind === 'rhythm') return null
    const pool =
      ear.kind === 'interval' ? INTERVAL_ROOTS : progressionTonics(ear.mode)
    return pool[Math.floor(Math.random() * pool.length)]
  })
  const realized = useMemo(
    () =>
      ear && ear.kind !== 'rhythm' && earRoot ? realizeEar(ear, earRoot) : null,
    [ear, earRoot],
  )
  // The melody's scale (tonic..octave) as MIDI, for the "hear scale" hint and
  // its per-note hover playback.
  const scaleMidis = useMemo(() => {
    if (ear?.kind !== 'melody' || !earRoot) return null
    const scale = realizeEar(
      { kind: 'melody', mode: ear.mode, degrees: [0, 1, 2, 3, 4, 5, 6, 7] },
      earRoot,
    )
    return scale.target.map((ev) => voicedMidi(ev[0]))
  }, [ear, earRoot])
  // Key signature for the reveal staff — melody/progression are in a key (drawn
  // under its signature); intervals are relative-pitch, so no signature.
  const revealKeySignature =
    earRoot && (ear?.kind === 'melody' || ear?.kind === 'progression')
      ? keySignatureSpec(earRoot.note, ear.mode)
      : undefined
  // Optional interval "training wheels", revealed only on request and reset
  // each question (the card remounts per question id).
  const intervalSemis = ear?.kind === 'interval' ? ear.semitones : null
  const [revealQuality, setRevealQuality] = useState(false)
  // Melodic-dictation "hear scale" hint: null = not shown; -1 = shown, no note
  // lit; 0..7 = the scale degree currently sounding (for the solfège readout).
  const [scaleStep, setScaleStep] = useState<number | null>(null)

  // Touch answering: a tap arms a choice (selects + previews it) instead of
  // committing; a second tap on the armed choice confirms. Pressing and dragging
  // across the list re-arms each option under the finger (the hover-scrub
  // equivalent). `armed` is a choice index, or DONT_KNOW, or null. Mouse is
  // unaffected (single click answers). Resets per question via the key remount.
  const isTouch = useIsTouch()
  const [armed, setArmed] = useState<number | null>(null)
  const armedRef = useRef<number | null>(null)
  const pressingRef = useRef(false)

  function playPrompt() {
    if (ear?.kind === 'rhythm') {
      playRhythm(ear.pattern, ear.meter, ear.tempo)
      return
    }
    if (!realized) return
    const reference = earIsInterval
      ? []
      : realized.reference.map((ev) => ev.map(voicedMidi))
    const target = realized.target.map((ev) => ev.map(voicedMidi))
    playEar(reference, target, realized.style)
  }
  function playReference() {
    if (!realized) return
    playEar([], realized.reference.map((ev) => ev.map(voicedMidi)), realized.style)
  }
  // Hint (melody): play the whole scale from the tonic up to the octave, so you
  // can anchor each solfège syllable if you're struggling.
  function playScale() {
    if (!scaleMidis) return
    setScaleStep(-1)
    playEar([], scaleMidis.map((m) => [m]), 'melodic', (i) => setScaleStep(i))
  }
  // Hovering a syllable plays that scale note — but only while the scale itself
  // isn't mid-playback (scaleStep >= 0 means a note is currently sounding).
  const scaleIdle = scaleStep === -1
  function playScaleNote(degree: number) {
    if (!scaleMidis || !scaleIdle) return
    playEar([], [[scaleMidis[degree]]], 'melodic')
  }
  // Intervals only: sound both notes at once (one block event).
  function playHarmonic() {
    if (!realized) return
    const both = realized.target.flat().map(voicedMidi)
    playEar([], [both], 'block')
  }
  // Hint: walk up one semitone at a time from the lower note to the target, so
  // you can count the distance instead of guessing.
  function playWalkUp() {
    if (!earRoot || intervalSemis === null) return
    const base = voicedMidi(earRoot)
    const steps = Array.from({ length: intervalSemis + 1 }, (_, i) => [base + i])
    playEar([], steps, 'melodic')
  }
  // Hint: consonant intervals are stable/restful, dissonant ones tense — knowing
  // which roughly halves the options. (P4 grouped as a consonance here.)
  const isConsonant =
    intervalSemis !== null && [3, 4, 5, 7, 8, 9, 12].includes(intervalSemis)

  // ── Touch answering ──────────────────────────────────────────────────────
  const playableFor = (choiceIndex: number): Playable | undefined =>
    question.audio?.[question.choices[choiceIndex]]
  function arm(choiceIndex: number) {
    armedRef.current = choiceIndex
    setArmed(choiceIndex)
    const playable = choiceIndex >= 0 ? playableFor(choiceIndex) : undefined
    if (playable) play(playable)
  }
  /** The choice index under a touch point (or DONT_KNOW), via its data attr. */
  function choiceAtPoint(e: ReactPointerEvent): number | null {
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest('[data-choice]') as HTMLElement | null | undefined
    if (!el) return null
    const v = Number(el.dataset.choice)
    return Number.isNaN(v) ? null : v
  }
  // Touch-down arms the option (and previews it); a second down on the already-
  // armed option confirms. Dragging re-arms each option the finger crosses.
  function onListPointerDown(e: ReactPointerEvent) {
    if (answered || e.pointerType === 'mouse') return
    pressingRef.current = true
    const i = choiceAtPoint(e)
    if (i === null) return
    if (armedRef.current === i) onSelect(i)
    else arm(i)
  }
  function onListPointerMove(e: ReactPointerEvent) {
    if (answered || !pressingRef.current) return
    const i = choiceAtPoint(e)
    if (i !== null && i !== armedRef.current) arm(i)
  }
  const endPress = () => {
    pressingRef.current = false
  }
  // Click answers on mouse (touch is handled on pointer-down above).
  function onChoiceClick(choiceIndex: number) {
    if (!answered && !wasTouch()) onSelect(choiceIndex)
  }
  // "I don't know": same arm-then-confirm on touch; single click on mouse.
  function onDontKnowDown(e: ReactPointerEvent) {
    if (answered || e.pointerType === 'mouse') return
    if (armedRef.current === DONT_KNOW) onDontKnow()
    else arm(DONT_KNOW)
  }

  // Auto-play once when an ear question mounts (audio is already unlocked by the
  // click that opened the étude).
  useEffect(() => {
    if (!isMuted() && (realized || earIsRhythm)) playPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realized])

  // Keyboard: number keys 1–N select; 0 = "I don't know"; Enter advances.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!answered && /^[1-9]$/.test(e.key)) {
        const pos = Number(e.key) - 1
        if (pos < order.length) onSelect(order[pos])
      } else if (!answered && e.key === '0') {
        onDontKnow()
      } else if (answered && e.key === 'Enter') {
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, order, onSelect, onDontKnow, onNext])

  // Stop any lingering audio when this card unmounts (e.g. advancing).
  useEffect(() => () => stop(), [])

  return (
    <article className="relative overflow-hidden rounded-3xl border border-rule bg-card px-6 py-7 shadow-[0_22px_60px_-32px_rgba(33,28,21,0.5)] sm:px-9 sm:py-9">
      {/* Depleting countdown bar pinned to the top edge — a burning fuse. */}
      {timed && !answered && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-rule/40"
        >
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-wrong' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Faint engraved clef watermark for atmosphere. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-2 select-none font-display text-[12rem] leading-none text-ink/[0.04] sm:text-[15rem]"
      >
        𝄞
      </span>

      <p className="marking flex items-center gap-2 text-accent">
        <span className="h-px w-5 bg-accent/50" />
        {question.category}
        {timed && !answered && (
          <span
            className={`ml-auto font-mono text-sm font-semibold tabular-nums transition-colors ${urgent ? 'text-wrong' : 'text-ink-2'}`}
            aria-label="seconds remaining"
          >
            {Math.ceil(remaining / 1000)}s
          </span>
        )}
      </p>
      <h2 className="mt-3 font-display text-2xl font-medium leading-snug tracking-[-0.01em] text-ink sm:text-[1.7rem]">
        {question.prompt}
      </h2>

      {question.notation && !question.notation.onReveal && (
        <Staff
          groups={question.notation.groups}
          clef={question.notation.clef}
          keySignature={question.notation.keySignature}
        />
      )}

      {ear && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {earIsInterval ? (
              <>
                <Button onClick={playPrompt}>▶ Arpeggiated</Button>
                <Button variant="secondary" onClick={playHarmonic}>
                  ▶ Together
                </Button>
              </>
            ) : (
              <Button onClick={playPrompt}>▶ Play</Button>
            )}
            {!earIsRhythm && (
              <button
                type="button"
                onClick={playReference}
                className="marking text-ink-3 transition-colors hover:text-ink"
              >
                {earIsInterval ? 'hear lower note' : 'hear tonic'}
              </button>
            )}
            {ear?.kind === 'melody' && earRoot && (
              <button
                type="button"
                onClick={playScale}
                className="marking text-ink-3 transition-colors hover:text-ink"
              >
                ▶ hear {noteToString(earRoot.note)} {ear.mode} scale
              </button>
            )}
            {isMuted() && (
              <span className="marking text-wrong">♪ Sound is off</span>
            )}
          </div>
          {ear?.kind === 'melody' && scaleStep !== null && (
            // Solfège readout for the scale hint — each syllable lights as its
            // note sounds, so you can anchor the sound to the name.
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-sm">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                <span
                  key={d}
                  // Mouse hovers to hear a degree; touch taps it.
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse' && scaleIdle) playScaleNote(d)
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') stop()
                  }}
                  onClick={scaleIdle ? () => playScaleNote(d) : undefined}
                  className={`rounded px-2 py-1 transition-colors ${
                    d === scaleStep ? 'bg-accent text-paper' : 'text-ink-2'
                  } ${scaleIdle ? 'cursor-pointer hover:bg-rule/60' : ''}`}
                >
                  {solfege(ear.mode, d % 7)}
                </span>
              ))}
            </div>
          )}
          {earIsInterval && earRoot && (
            <p className="mt-3 text-ink-2">
              The lower note is{' '}
              <span className="font-mono text-ink">{noteToString(earRoot.note)}</span>.
            </p>
          )}
          {earIsInterval && !answered && (
            // Optional training wheels — kept subtle so they don't crowd the prompt.
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="marking text-ink-3">Hints</span>
              <button
                type="button"
                onClick={playWalkUp}
                className="marking text-ink-3 transition-colors hover:text-ink"
              >
                ▶ step up to it
              </button>
              {revealQuality ? (
                <span
                  className={`marking ${isConsonant ? 'text-correct' : 'text-wrong'}`}
                >
                  {isConsonant ? 'consonant — restful' : 'dissonant — tense'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setRevealQuality(true)}
                  className="marking text-ink-3 transition-colors hover:text-ink"
                >
                  consonant or dissonant?
                </button>
              )}
            </div>
          )}
          {earIsRhythm && (
            <p className="mt-3 text-ink-2">
              The clicks before the bar are a count-in — they set the tempo and
              the metre before the rhythm plays.
            </p>
          )}
          {ear?.kind === 'progression' && (
            <p className="mt-3 text-ink-2">
              The first chord you hear is the tonic — judge each chord relative
              to it.
            </p>
          )}
          {earIsMelody && earRoot && (
            <p className="mt-3 text-ink-2">
              The tonic — <span className="font-mono text-ink">do</span> — is{' '}
              <span className="font-mono text-ink">
                {noteToString(earRoot.note)}
              </span>{' '}
              here. Solfège names each note's step from it.
            </p>
          )}
        </>
      )}

      <ul
        className="mt-7 space-y-2.5 touch-none"
        onPointerDown={onListPointerDown}
        onPointerMove={onListPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
      >
        {order.map((choiceIndex, pos) => {
          const isAnswer = choiceIndex === question.answerIndex
          const isChosen = choiceIndex === selected

          let state: ChoiceState = 'idle'
          if (answered) {
            if (isAnswer) state = 'correct'
            else if (isChosen) state = 'wrong'
            else state = 'muted'
          } else if (armed === choiceIndex) {
            state = 'armed'
          }

          const choiceText = question.choices[choiceIndex]
          const playable = question.audio?.[choiceText]

          return (
            <li
              key={choiceIndex}
              className="ink"
              style={{ animationDelay: `${pos * 60}ms` }}
              // Mouse hover previews; touch preview is handled by the list's
              // pointer-down/move (drag-scrub) above.
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse' && playable) play(playable)
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') stop()
              }}
            >
              <button
                type="button"
                data-choice={choiceIndex}
                disabled={answered}
                onClick={() => onChoiceClick(choiceIndex)}
                className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 disabled:cursor-default ${rowClasses(state)}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium ring-1 transition-colors duration-200 ${badgeClasses(state)}`}
                >
                  {state === 'correct' ? '✓' : state === 'wrong' ? '✕' : pos + 1}
                </span>
                {question.rhythmChoices ? (
                  <span className="flex-1">
                    <RhythmStaff
                      pattern={question.rhythmChoices[choiceIndex]}
                      meter={rhythmMeter}
                    />
                  </span>
                ) : (
                  <span className="flex-1 whitespace-pre-wrap font-mono text-[1.02rem] leading-relaxed text-ink">
                    {choiceText}
                  </span>
                )}
                {state === 'armed' ? (
                  <span className="marking shrink-0 text-accent">tap again</span>
                ) : (
                  playable && (
                    <span
                      aria-hidden
                      className="shrink-0 text-ink-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    >
                      ♪
                    </span>
                  )
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {/* "I don't know" — an honest miss; reveals the answer and tells the SRS
          to bring this back soon. Shown until answered, or kept (red) if chosen. */}
      {(!answered || selected === DONT_KNOW) &&
        (() => {
          const dkArmed = !answered && armed === DONT_KNOW
          return (
            <button
              type="button"
              disabled={answered}
              onPointerDown={onDontKnowDown}
              onClick={() => {
                if (!answered && !wasTouch()) onDontKnow()
              }}
              className={`mt-2.5 flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all duration-200 disabled:cursor-default ${
                selected === DONT_KNOW
                  ? 'bg-wrong/10 ring-2 ring-wrong'
                  : dkArmed
                    ? 'bg-paper ring-2 ring-ink -translate-y-0.5'
                    : 'bg-card/50 ring-1 ring-rule hover:-translate-y-0.5 hover:bg-paper hover:ring-ink'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium ring-1 transition-colors duration-200 ${
                  selected === DONT_KNOW
                    ? 'bg-wrong text-card ring-wrong'
                    : dkArmed
                      ? 'bg-ink text-paper ring-ink'
                      : 'text-ink-3 ring-rule'
                }`}
              >
                {selected === DONT_KNOW ? '✕' : '0'}
              </span>
              <span
                className={`flex-1 ${selected === DONT_KNOW || dkArmed ? 'text-ink' : 'text-ink-2'}`}
              >
                I don’t know
              </span>
              {dkArmed && (
                <span className="marking shrink-0 text-accent">tap again</span>
              )}
            </button>
          )
        })()}

      {answered ? (
        <div className="mt-7 border-t border-rule pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-display text-lg italic">
              {isCorrect ? (
                <span className="text-correct">Just so.</span>
              ) : earIsRhythm ? (
                <span className="text-wrong">
                  {timedOut ? 'Time’s up' : 'Not quite'} — it’s the highlighted bar.
                </span>
              ) : (
                <span className="text-wrong">
                  {timedOut ? 'Time’s up — it’s' : 'Not quite — it’s'}{' '}
                  <span className="font-mono not-italic">
                    {question.choices[question.answerIndex]}
                  </span>
                  .
                </span>
              )}
            </p>
            <Button onClick={onNext} autoFocus>
              Next
            </Button>
          </div>
          {ear && realized && (
            <Staff
              groups={realized.target}
              keySignature={revealKeySignature}
              labels={
                earIsInterval
                  ? undefined
                  : earIsMelody
                    ? question.choices[question.answerIndex]
                        .split('–')
                        .map((s, i) =>
                          realized.target[i]
                            ? `${s} ${noteToString(realized.target[i][0].note)}`
                            : s,
                        )
                    : question.choices[question.answerIndex].split('–')
              }
            />
          )}
          {question.notation?.onReveal && (
            <Staff
              groups={question.notation.groups}
              clef={question.notation.clef}
              keySignature={question.notation.keySignature}
            />
          )}
          {!ear && question.keyboard && (
            <PianoKeyboard marks={question.keyboard.marks} />
          )}
          {!ear && question.circle && <CircleOfFifths major={question.circle.major} />}
          {!isCorrect && question.explanation && (
            <p className="ink mt-4 rounded-xl border border-rule bg-paper/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
              <span className="marking mr-1.5 text-accent">Remember</span>
              {question.explanation}
            </p>
          )}
        </div>
      ) : (
        <p className="marking mt-7 text-ink-3">
          {isTouch
            ? 'Tap to hear · tap again to answer'
            : `Keys 1–${order.length} to answer · 0 = don’t know · Enter for next`}
        </p>
      )}
    </article>
  )
}
