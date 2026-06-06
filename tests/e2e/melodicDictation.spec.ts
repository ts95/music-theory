import { test, expect } from '@playwright/test'

// Melodic Dictation teaches on a miss: the reveal lets you HEAR the motif you
// were supposed to guess — reusing the "hear scale" playback to play the melody
// notes instead, with a synced solfège readout. Shown only on a wrong answer.

const HEAR_MELODY = /hear the melody/

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/melodic-dictation')
})

test('a wrong answer shows the scale readout and the hear-melody control above the staff', async ({
  page,
}) => {
  const card = page.getByRole('article').first()
  // "I don't know" is a guaranteed miss and reveals.
  const idk = card.getByRole('button', { name: /I don.?t know/ })
  await expect(idk).toBeVisible()
  await idk.click()

  const hearBtn = card.getByRole('button', { name: HEAR_MELODY })
  await expect(hearBtn).toBeVisible()

  // The readout shows the whole scale (≥ one octave: do→do = 8 syllables)…
  const cells = card.locator('button:has-text("hear the melody") + div span')
  expect(await cells.count()).toBeGreaterThanOrEqual(8)
  // …with the melody's notes marked in the accent colour (distinct from the rest).
  const members = card.locator('button:has-text("hear the melody") + div span.text-accent')
  expect(await members.count()).toBeGreaterThan(0)

  // The control sits above the staff.
  const btnBox = await hearBtn.boundingBox()
  const svgBox = await card.locator('svg').first().boundingBox()
  expect(btnBox!.y).toBeLessThan(svgBox!.y)
})

test('a correct answer does not offer to hear the melody', async ({ page }) => {
  const card = page.getByRole('article').first()
  // Read the correct choice from the card's React props, then click it.
  const correct = await page.evaluate(() => {
    const art = document.querySelector('article') as (HTMLElement & Record<string, unknown>) | null
    const key = art && Object.keys(art).find((k) => k.startsWith('__reactFiber$'))
    let f = (key ? (art as Record<string, { return?: unknown; memoizedProps?: { question?: { answerIndex?: number; choices?: string[] } } }>)[key] : null) as
      | { return?: unknown; memoizedProps?: { question?: { answerIndex?: number; choices?: string[] } } }
      | null
    for (let i = 0; f && i < 80; i++, f = f.return as typeof f) {
      const q = f.memoizedProps?.question
      if (q && typeof q.answerIndex === 'number' && q.choices) return q.choices[q.answerIndex]
    }
    return null
  })
  expect(correct).toBeTruthy()
  await card
    .getByRole('button', { name: new RegExp(correct!.replace(/[-–]/g, '.?')) })
    .first()
    .click()
  await expect(card.getByText('Just so.')).toBeVisible()
  await expect(card.getByRole('button', { name: HEAR_MELODY })).toHaveCount(0)
})
