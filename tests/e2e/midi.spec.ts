import { test, expect } from '@playwright/test'
import { installFakeMidi } from './fakeMidi'

// Tap the Rhythm (No. 12) accepts optional MIDI input: tap *any* key(s), the
// pitch is irrelevant — only the rhythm is graded, plug & play. Driven through
// the reusable fake-MIDI device (tests/e2e/fakeMidi.ts), which is shaped exactly
// like the Web MIDI API the app consumes, so this exercises the real code path.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await installFakeMidi(page) // before goto: addInitScript runs ahead of the app
  await page.goto('/rhythm-tap')
})

test('Tap the Rhythm: a connected MIDI device taps the rhythm', async ({ page }) => {
  const card = page.getByRole('article')

  // The ready screen reflects the (fake) device, and hot-plugging updates it.
  await expect(card.getByText(/MIDI connected/)).toBeVisible()
  await page.evaluate(() => window.fakeMidi.disconnect())
  await expect(card.getByText(/plug in a MIDI keyboard/)).toBeVisible()
  await page.evaluate(() => window.fakeMidi.connect())
  await expect(card.getByText(/MIDI connected/)).toBeVisible()

  // The tempo sets the beat length we space taps by.
  const tempo = Number(await card.locator('input[type=range]').inputValue())
  const beat = 60000 / tempo

  await card.getByRole('button', { name: /^Begin$/ }).click()

  // Wait out the count-in: the caption flips once the tapping bar begins.
  await expect(card.getByText(/tap .* each note for its length/)).toBeVisible({
    timeout: 15000,
  })

  // Tap with MIDI note-on/off — held ~60% of the beat, one tap per beat. The
  // same pitch each time proves pitch is ignored; F (65) avoids the A/B/C
  // transport shortcuts that act once the bar auto-finishes onto the results.
  await page.evaluate(
    async (b) => {
      for (let k = 0; k < 6; k++) {
        await window.fakeMidi.tap(65, b * 0.6)
        await new Promise((r) => setTimeout(r, b * 0.4))
      }
    },
    beat,
  )

  // The run grades and reaches the results screen (accuracy shown).
  await expect(card.getByText(/% accuracy/)).toBeVisible({ timeout: 10000 })

  // The MIDI taps registered: the "you" trace lane has at least one mark — i.e.
  // note-on/off drove the same press/release path Space does. Tap marks are the
  // only lane elements with an inline width (markStyle), unlike the gridlines.
  const youMarks = card.locator('div.relative.h-7').first().locator('div[style*="width"]')
  expect(await youMarks.count()).toBeGreaterThan(0)
})

test('Tap the Rhythm: MIDI transport shortcuts — C begin/next, B retry, A hear', async ({
  page,
}) => {
  test.setTimeout(45000)
  const card = page.getByRole('article')
  await expect(card.getByText(/MIDI connected/)).toBeVisible()

  // Max tempo → shorter count-ins, faster test (fill() rejects range inputs).
  const slider = card.locator('input[type=range]')
  await slider.evaluate((el: HTMLInputElement) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(el, '90')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const beat = 60000 / Number(await slider.inputValue())

  const begun = card.getByText(/tap .* each note for its length/)
  const graded = card.getByText(/% accuracy/)
  const beginBtn = card.getByRole('button', { name: /^Begin$/ })

  // Tap through the bar and reach the results screen.
  const tapThrough = async () => {
    await page.evaluate(async (b) => {
      for (let k = 0; k < 6; k++) {
        await window.fakeMidi.tap(65, b * 0.6) // F — not a transport shortcut
        await new Promise((r) => setTimeout(r, b * 0.4))
      }
    }, beat)
    await expect(graded).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(600) // let the 500ms transport-shortcut grace elapse
  }

  // READY: middle C begins — no Begin click.
  await page.evaluate(() => window.fakeMidi.noteOn(60))
  await expect(beginBtn).toBeHidden()
  await expect(begun).toBeVisible({ timeout: 15000 })
  await tapThrough()

  // DONE: A (any octave) plays it back — stays on the results screen.
  await page.evaluate(() => window.fakeMidi.noteOn(57))
  await expect(graded).toBeVisible()

  // DONE: B retries — back to the count-in / tapping phase.
  await page.evaluate(() => window.fakeMidi.noteOn(59))
  await expect(graded).toBeHidden()
  await expect(begun).toBeVisible({ timeout: 15000 })
  await tapThrough()

  // DONE: C advances to the next exercise (a fresh ready screen).
  await page.evaluate(() => window.fakeMidi.noteOn(60))
  await expect(beginBtn).toBeVisible({ timeout: 10000 })
})
