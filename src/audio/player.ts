import type { Playable } from '../contracts'

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
