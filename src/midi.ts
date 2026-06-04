import { useEffect, useRef, useState } from 'react'

/**
 * Optional Web-MIDI input. Calls `onNoteOn(midi)` for every note-on from any
 * connected MIDI device, and (optionally) `onNoteOff(midi)` for every note-off,
 * and reports whether a device is connected. Degrades gracefully — if Web MIDI
 * is unsupported or permission is denied it simply does nothing, so the étude
 * stays fully playable by tap/click.
 *
 * Web MIDI isn't in the TS DOM lib here, so the API is typed structurally.
 */

interface MidiMessage {
  data?: Uint8Array | null
}
interface MidiInputLike {
  onmidimessage: ((e: MidiMessage) => void) | null
}
interface MidiAccessLike {
  inputs: { values(): IterableIterator<MidiInputLike> }
  onstatechange: (() => void) | null
}

export function useMidiInput(
  onNoteOn: (midi: number) => void,
  enabled = true,
  onNoteOff?: (midi: number) => void
): { connected: boolean; supported: boolean } {
  const [connected, setConnected] = useState(false)
  // Web MIDI is absent in Safari / all iOS-iPadOS browsers (WebKit). Knowing this
  // up front lets the UI say "not supported here" rather than "no device".
  const supported =
    typeof navigator !== 'undefined' &&
    typeof (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess ===
      'function'
  // Keep the latest callbacks without re-requesting MIDI access each render.
  const cb = useRef(onNoteOn)
  cb.current = onNoteOn
  const offCb = useRef(onNoteOff)
  offCb.current = onNoteOff

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return
    const request = (
      navigator as { requestMIDIAccess?: () => Promise<MidiAccessLike> }
    ).requestMIDIAccess
    if (typeof request !== 'function') return

    let access: MidiAccessLike | null = null
    let cancelled = false

    const onMessage = (e: MidiMessage) => {
      const data = e.data
      if (!data || data.length < 3) return
      const [status, note, velocity] = data
      const kind = status & 0xf0
      // note-on (0x90–0x9F) with non-zero velocity; a 0-velocity note-on is the
      // common "note-off" encoding, alongside the explicit note-off (0x80–0x8F).
      if (kind === 0x90 && velocity > 0) cb.current(note)
      else if (kind === 0x80 || (kind === 0x90 && velocity === 0)) offCb.current?.(note)
    }
    const wire = (a: MidiAccessLike) => {
      const inputs = Array.from(a.inputs.values())
      setConnected(inputs.length > 0)
      inputs.forEach((i) => {
        i.onmidimessage = onMessage
      })
    }

    request
      .call(navigator)
      .then((a) => {
        if (cancelled) return
        access = a
        wire(a)
        a.onstatechange = () => wire(a)
      })
      .catch(() => {
        /* permission denied or unavailable — tap still works */
      })

    return () => {
      cancelled = true
      if (access) {
        Array.from(access.inputs.values()).forEach((i) => {
          i.onmidimessage = null
        })
        access.onstatechange = null
      }
    }
  }, [enabled])

  return { connected, supported }
}
