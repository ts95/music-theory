import { test, expect } from '@playwright/test'

// Melodic Dictation teaches intervals on a miss: the reveal adds an ascending
// scale ladder with the answer's degrees highlighted (claret), so you can see
// where the notes you should have heard sit in the scale. It's shown only on a
// wrong answer.

const SCALE_HEADING = 'The scale — your notes in claret'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/melodic-dictation')
})

test('a wrong answer reveals the scale with highlighted notes', async ({ page }) => {
  const card = page.getByRole('article').first()
  // "I don't know" is a guaranteed miss and reveals the answer.
  const idk = card.getByRole('button', { name: /I don.?t know/ })
  await expect(idk).toBeVisible()
  await idk.click()
  await expect(card.getByText(SCALE_HEADING)).toBeVisible()
  // The highlighted scale degrees are drawn in the claret accent (the scale
  // staff renders via lazy VexFlow, so wait for at least one to appear).
  await expect(card.locator('svg [fill="#7a2540"]').first()).toBeVisible()
})

test('a correct answer does not show the scale', async ({ page }) => {
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
      if (q && typeof q.answerIndex === 'number' && q.choices)
        return q.choices[q.answerIndex]
    }
    return null
  })
  expect(correct).toBeTruthy()
  await card
    .getByRole('button', { name: new RegExp(correct!.replace(/[-–]/g, '.?')) })
    .first()
    .click()
  await expect(card.getByText('Just so.')).toBeVisible()
  await expect(card.getByText(SCALE_HEADING)).toHaveCount(0)
})
