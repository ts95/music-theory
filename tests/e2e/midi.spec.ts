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

  // Tap with MIDI note-on/off — held ~60% of the beat, one tap per beat. No
  // pitch is chosen deliberately the same each time to prove pitch is ignored.
  await page.evaluate(
    async (b) => {
      for (let k = 0; k < 6; k++) {
        await window.fakeMidi.tap(60, b * 0.6)
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
