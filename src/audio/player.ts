import type { Playable, RhythmEvent, TimeSig } from '../contracts'
import { METERS, eventBeats } from '../rhythm'

/**
 * Hover-to-play audio. The only Tone.js consumer. Tone is dynamically imported
 * on first play so it stays out of the initial bundle, and the AudioContext is
 * started then (browsers require a user gesture — hovering/clicking counts).
 * A synthesized piano-ish PolySynth keeps it instant and fully offline.
 */

type ToneModule = typeof import('tone')

let Tone: ToneModule | null = null
let synth: InstanceType<ToneModule['PolySynth']> | null = null
// A separate, percussive "tick" for the rhythm-dictation count-in, so it reads
// as a metronome rather than part of the rhythm being dictated.
let clickSynth: InstanceType<ToneModule['MembraneSynth']> | null = null
let initPromise: Promise<void> | null = null

// setTimeout ids for scheduled note events + the leading debounce.
let scheduled: ReturnType<typeof setTimeout>[] = []
let debounce: ReturnType<typeof setTimeout> | null = null
// Bumped by stop()/play() so an in-flight async start can detect cancellation.
let generation = 0

const MUTE_KEY = 'music-theory-muted'
let muted = readMuted()

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    /* storage unavailable — fine */
  }
  if (muted) stop()
}

async function ensureSynth(): Promise<void> {
  if (synth) return
  if (!initPromise) {
    initPromise = (async () => {
      const T = await import('tone')
      await T.start()
      synth = new T.PolySynth(T.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.18, release: 1.1 },
        volume: -8,
      }).toDestination()
      // Dry, percussive woodblock "tick" — deliberately unlike the pitched notes.
      clickSynth = new T.MembraneSynth({
        pitchDecay: 0.006,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.02 },
        volume: -4,
      }).toDestination()
      Tone = T
    })()
  }
  await initPromise
}

/** Per-kind timing: gap between events (ms) and how long each is held (s). */
function timing(kind: Playable['kind']): { step: number; hold: number } {
  switch (kind) {
    case 'scale':
      return { step: 160, hold: 0.34 }
    case 'progression':
      return { step: 520, hold: 0.62 }
    case 'chord':
      return { step: 0, hold: 1.1 }
  }
}

function schedule(p: Playable): void {
  if (!Tone || !synth) return
  const { step, hold } = timing(p.kind)
  p.events.forEach((event, i) => {
    const freqs = event.map((midi) => Tone!.Frequency(midi, 'midi').toFrequency())
    const id = setTimeout(() => synth?.triggerAttackRelease(freqs, hold), i * step)
    scheduled.push(id)
  })
}

/** Play a choice's audio, replacing anything currently sounding. */
export function play(p: Playable): void {
  if (muted) return
  stop() // cancels prior playback and bumps `generation`
  const g = generation
  debounce = setTimeout(async () => {
    try {
      await ensureSynth()
      if (muted || g !== generation) return // hovered away / muted while loading
      schedule(p)
    } catch {
      /* audio unavailable (e.g. no AudioContext) — silently ignore */
    }
  }, 70)
}

/**
 * Play an ear-training prompt: an optional reference (block, ~0.9s) then a gap,
 * then the target. `style` sets target timing — melodic (notes in series) or
 * block (chords in series). Replaces any current playback; cancelable via stop().
 */
export function playEar(
  reference: number[][],
  target: number[][],
  style: 'melodic' | 'block',
  /** Fired as each target event sounds (for in-sync UI, e.g. solfège). */
  onStep?: (index: number) => void
): void {
  if (muted) return
  stop()
  const g = generation
  debounce = setTimeout(async () => {
    try {
      await ensureSynth()
      if (muted || g !== generation) return
      scheduleEar(reference, target, style, onStep)
    } catch {
      /* audio unavailable — ignore */
    }
  }, 70)
}

function scheduleEar(
  reference: number[][],
  target: number[][],
  style: 'melodic' | 'block',
  onStep?: (index: number) => void
): void {
  if (!Tone || !synth) return
  const fire = (event: number[], hold: number, at: number, cb?: () => void) => {
    const freqs = event.map((m) => Tone!.Frequency(m, 'midi').toFrequency())
    scheduled.push(
      setTimeout(() => {
        synth?.triggerAttackRelease(freqs, hold)
        cb?.()
      }, at)
    )
  }
  let t = 0
  reference.forEach((ev, i) => fire(ev, 0.9, i * 640))
  if (reference.length > 0) t = reference.length * 640 + 700 // gap before target
  const step = style === 'melodic' ? 460 : 640
  const hold = style === 'melodic' ? 0.5 : 0.72
  target.forEach((ev, i) => fire(ev, hold, t + i * step, () => onStep?.(i)))
  // A final tick so callers can clear any "current note" highlight.
  if (onStep) scheduled.push(setTimeout(() => onStep(-1), t + target.length * step))
}


const RHYTHM_PITCH = 72 // C5 — the rhythm notes (pitched, triangle)
const COUNT_PITCH = 'C6' // the count-in tick (percussive woodblock)

/**
 * Play a one-bar rhythm in `meter`: a one-bar count-in on the metre's felt beats
 * (4/4 → 4 quarters, 3/4 → 3 quarters, 6/8 → 2 dotted quarters), then the pattern
 * at `tempo` BPM on a single fixed pitch (rests silent). Metrically continuous.
 * Replaces any current playback; cancelable via stop().
 */
export function playRhythm(
  pattern: RhythmEvent[],
  meter: TimeSig,
  tempo = 92
): void {
  if (muted) return
  stop()
  const g = generation
  debounce = setTimeout(async () => {
    try {
      await ensureSynth()
      if (muted || g !== generation) return
      scheduleRhythm(pattern, meter, tempo)
    } catch {
      /* audio unavailable — ignore */
    }
  }, 70)
}

function scheduleRhythm(pattern: RhythmEvent[], meter: TimeSig, tempo: number): void {
  if (!Tone || !synth) return
  const beatMs = 60000 / tempo
  const { countIn, totalBeats } = METERS[meter]
  const fireNote = (holdSec: number, atMs: number) => {
    const freq = Tone!.Frequency(RHYTHM_PITCH, 'midi').toFrequency()
    scheduled.push(setTimeout(() => synth?.triggerAttackRelease(freq, holdSec), atMs))
  }
  const fireClick = (atMs: number) => {
    scheduled.push(setTimeout(() => clickSynth?.triggerAttackRelease(COUNT_PITCH, 0.05), atMs))
  }
  countIn.forEach((beat) => fireClick(beat * beatMs)) // count-in (distinct tick)
  let t = totalBeats * beatMs // the bar starts after one count-in bar
  for (let i = 0; i < pattern.length; i++) {
    const e = pattern[i]
    const beats = eventBeats(e)
    // A tied continuation isn't re-struck; the note that began the tie holds
    // through the whole chain.
    const continuation = i > 0 && !!pattern[i - 1].tie
    if (!e.rest && !continuation) {
      let held = beats
      let j = i
      while (pattern[j].tie && j + 1 < pattern.length) {
        j++
        held += eventBeats(pattern[j])
      }
      fireNote(Math.max(0.12, (held * beatMs * 0.8) / 1000), t)
    }
    t += beats * beatMs
  }
}

/** Stop all playback immediately. */
export function stop(): void {
  generation++
  if (debounce) {
    clearTimeout(debounce)
    debounce = null
  }
  for (const id of scheduled) clearTimeout(id)
  scheduled = []
  synth?.releaseAll()
}
