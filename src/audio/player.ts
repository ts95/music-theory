import type { Playable, RhythmEvent } from '../contracts'

/**
 * Hover-to-play audio. The only Tone.js consumer. Tone is dynamically imported
 * on first play so it stays out of the initial bundle, and the AudioContext is
 * started then (browsers require a user gesture — hovering/clicking counts).
 * A synthesized piano-ish PolySynth keeps it instant and fully offline.
 */

type ToneModule = typeof import('tone')

let Tone: ToneModule | null = null
let synth: InstanceType<ToneModule['PolySynth']> | null = null
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
  style: 'melodic' | 'block'
): void {
  if (muted) return
  stop()
  const g = generation
  debounce = setTimeout(async () => {
    try {
      await ensureSynth()
      if (muted || g !== generation) return
      scheduleEar(reference, target, style)
    } catch {
      /* audio unavailable — ignore */
    }
  }, 70)
}

function scheduleEar(
  reference: number[][],
  target: number[][],
  style: 'melodic' | 'block'
): void {
  if (!Tone || !synth) return
  const fire = (event: number[], hold: number, at: number) => {
    const freqs = event.map((m) => Tone!.Frequency(m, 'midi').toFrequency())
    scheduled.push(setTimeout(() => synth?.triggerAttackRelease(freqs, hold), at))
  }
  let t = 0
  reference.forEach((ev, i) => fire(ev, 0.9, i * 640))
  if (reference.length > 0) t = reference.length * 640 + 700 // gap before target
  const step = style === 'melodic' ? 460 : 640
  const hold = style === 'melodic' ? 0.5 : 0.72
  target.forEach((ev, i) => fire(ev, hold, t + i * step))
}

const BASE_BEATS: Record<RhythmEvent['dur'], number> = {
  h: 2,
  q: 1,
  '8': 0.5,
  '16': 0.25,
}
/** Duration of a rhythm event in beats (dots add half, then a quarter, …). */
function eventBeats(e: RhythmEvent): number {
  return BASE_BEATS[e.dur] * (2 - 1 / 2 ** (e.dots ?? 0))
}

const RHYTHM_PITCH = 72 // C5 — the rhythm notes
const COUNT_PITCH = 79 // G5 — the count-in clicks

/**
 * Play a one-bar rhythm: a 4-beat count-in, then the pattern at `tempo` BPM on a
 * single fixed pitch (rests are silent). Metrically continuous — the bar lands on
 * count 4+1. Replaces any current playback; cancelable via stop().
 */
export function playRhythm(pattern: RhythmEvent[], tempo = 92): void {
  if (muted) return
  stop()
  const g = generation
  debounce = setTimeout(async () => {
    try {
      await ensureSynth()
      if (muted || g !== generation) return
      scheduleRhythm(pattern, tempo)
    } catch {
      /* audio unavailable — ignore */
    }
  }, 70)
}

function scheduleRhythm(pattern: RhythmEvent[], tempo: number): void {
  if (!Tone || !synth) return
  const beatMs = 60000 / tempo
  const fire = (pitch: number, holdSec: number, atMs: number) => {
    const freq = Tone!.Frequency(pitch, 'midi').toFrequency()
    scheduled.push(setTimeout(() => synth?.triggerAttackRelease(freq, holdSec), atMs))
  }
  for (let i = 0; i < 4; i++) fire(COUNT_PITCH, 0.08, i * beatMs) // count-in
  let t = 4 * beatMs
  for (const e of pattern) {
    const beats = eventBeats(e)
    if (!e.rest) fire(RHYTHM_PITCH, Math.max(0.12, (beats * beatMs * 0.8) / 1000), t)
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
