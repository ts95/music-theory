import type { Page } from '@playwright/test'

/**
 * A reusable in-browser fake of the slice of Web MIDI that `src/midi.ts`
 * consumes: `navigator.requestMIDIAccess()` → an access object exposing
 * `inputs.values()` and `onstatechange`, whose inputs deliver
 * `{ data: Uint8Array([status, note, velocity]) }` messages. It's shaped exactly
 * like the real API, so `useMidiInput` can't tell the difference — switching
 * between mocked and real MIDI is just "install it or don't".
 *
 * Install with `installFakeMidi(page)` BEFORE navigating (it uses
 * `addInitScript`, which runs ahead of the app on every load, so the mount
 * effect sees the patched navigator). Then drive it from the page via the
 * `window.fakeMidi` handle:
 *
 *   await installFakeMidi(page)
 *   await page.goto('/rhythm-tap')
 *   await page.evaluate(() => window.fakeMidi.tap(60, 120)) // a held tap
 */

/** The control surface exposed on `window.fakeMidi` in the browser. */
export interface FakeMidi {
  /** Fire a note-on (any pitch — the rhythm étude ignores which). */
  noteOn(note?: number, velocity?: number): void
  /** Fire a note-off. */
  noteOff(note?: number): void
  /** Press, hold for `holdMs`, then release — one rhythmic tap. */
  tap(note?: number, holdMs?: number): Promise<void>
  /** Hot-plug the device in / out, firing `statechange` like real hardware. */
  connect(): void
  disconnect(): void
}

declare global {
  interface Window {
    fakeMidi: FakeMidi
  }
}

// Runs in the browser. Self-contained (no external references) so it serializes
// cleanly through addInitScript.
function install() {
  const NOTE_ON = 0x90
  const NOTE_OFF = 0x80
  const input: { onmidimessage: ((e: { data: Uint8Array }) => void) | null } = {
    onmidimessage: null,
  }
  let present = true
  const access = {
    inputs: { values: () => (present ? [input] : [])[Symbol.iterator]() },
    onstatechange: null as (() => void) | null,
  }
  ;(navigator as { requestMIDIAccess?: () => Promise<unknown> }).requestMIDIAccess = () =>
    Promise.resolve(access)

  const send = (status: number, note: number, velocity: number) =>
    input.onmidimessage?.({ data: new Uint8Array([status, note, velocity]) })
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  window.fakeMidi = {
    noteOn: (note = 60, velocity = 100) => send(NOTE_ON, note, velocity),
    noteOff: (note = 60) => send(NOTE_OFF, note, 0),
    tap: async (note = 60, holdMs = 100) => {
      send(NOTE_ON, note, 100)
      await sleep(holdMs)
      send(NOTE_OFF, note, 0)
    },
    connect: () => {
      present = true
      access.onstatechange?.()
    },
    disconnect: () => {
      present = false
      access.onstatechange?.()
    },
  }
}

/** Install the fake before the app loads (call before `page.goto`). */
export async function installFakeMidi(page: Page): Promise<void> {
  await page.addInitScript(install)
}
