import { test, expect } from '@playwright/test'

// Tap the Rhythm lights up the note head you're supposed to play — as a claret
// glow overlay — during the count-in preview and "Hear it" playback, but NOT
// during the actual tapping bar. The glow is rendered only when a note is lit,
// so its presence/absence is a clean proxy for the cue being on/off.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/rhythm-tap')
})

test('note-head cue lights during count-in & Hear it, but not while tapping', async ({
  page,
}) => {
  test.setTimeout(45000)
  const card = page.getByRole('article')
  const glow = card.locator('span[style*="radial-gradient"]')

  // Max tempo → shorter count-in / sooner auto-finish (fill() rejects ranges).
  await card.locator('input[type=range]').evaluate((el: HTMLInputElement) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(el, '90')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })

  // Ready screen: no cue yet.
  await expect(glow).toHaveCount(0)

  await card.getByRole('button', { name: /^Begin$/ }).click()

  // Count-in: a note head lights up (preview playthrough).
  await expect(glow).toHaveCount(1, { timeout: 4000 })

  // Tapping bar begins → the cue is gone (no follow-the-dots during the test).
  await expect(card.getByText(/tap .* each note for its length/)).toBeVisible({
    timeout: 15000,
  })
  await expect(glow).toHaveCount(0)

  // Let the bar auto-finish (no taps needed) → results screen.
  await expect(card.getByText(/% accuracy/)).toBeVisible({ timeout: 15000 })
  await expect(glow).toHaveCount(0)

  // Hear it: the cue returns, synced to playback.
  await card.getByRole('button', { name: /^Hear it$/ }).click()
  await expect(glow).toHaveCount(1, { timeout: 4000 })
})

test('the duration-bars toggle hides the trace lanes (but keeps the note-head cue)', async ({
  page,
}) => {
  test.setTimeout(45000)
  const card = page.getByRole('article')
  const lanes = card.locator('div.relative.h-7') // count-in / you / expected lanes
  const glow = card.locator('span[style*="radial-gradient"]')

  await card.locator('input[type=range]').evaluate((el: HTMLInputElement) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(el, '90')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })

  // Hide the bars, then run.
  await card.getByRole('button', { name: 'Hidden', exact: true }).click()
  await card.getByRole('button', { name: /^Begin$/ }).click()

  // Count-in: no trace lanes, but the note-head cue still lights (independent aid).
  await expect(glow).toHaveCount(1, { timeout: 4000 })
  await expect(lanes).toHaveCount(0)

  // Tapping + results: still no lanes.
  await expect(card.getByText(/tap .* each note for its length/)).toBeVisible({
    timeout: 15000,
  })
  await expect(lanes).toHaveCount(0)
  await expect(card.getByText(/% accuracy/)).toBeVisible({ timeout: 15000 })
  await expect(lanes).toHaveCount(0)

  // Reveal again on the results screen → the you + expected lanes appear.
  await card.getByRole('button', { name: 'Shown', exact: true }).click()
  await expect(lanes).toHaveCount(2)
})
