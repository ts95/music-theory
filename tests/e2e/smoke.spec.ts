import { test, expect } from '@playwright/test'

// Smoke coverage for the core user flow: menu → étude → answer → grade →
// advance → summary. Intentionally not exhaustive — this is a regression net,
// not full per-étude coverage. Answering is keyboard-driven (the app binds
// number keys 1–N to pick a choice and Enter to advance) so the suite stays
// ahead of the sudden-death timer on timed question categories.

test.beforeEach(async ({ page }) => {
  // Start from clean SRS + practice-time state on every navigation, so the due
  // queue is deterministic. addInitScript runs before the app's own scripts.
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
})

test('home menu lists the études', async ({ page }) => {
  await expect(
    page.getByText('Spaced-repetition exercises — choose an étude'),
  ).toBeVisible()
  for (const title of [
    'Relative Minors',
    'Scales',
    'Scale Fingerings',
    'Chords by Degree',
    'Chord Recognition',
    'Progressions',
    'Intervals by Ear',
    'Progressions by Ear',
    'Melodic Dictation',
    'Rhythm Dictation',
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  }
})

test('answers a full session and reaches the summary', async ({ page }) => {
  await page.getByRole('button', { name: /Scales/ }).click()

  // The session header shows "<index> / <total>" — read total so the loop is
  // exactly bank-sized rather than a guessed cap.
  const counter = page.getByText(/^\s*\d+\s*\/\s*\d+\s*$/).first()
  await expect(counter).toBeVisible()
  const total = Number((await counter.textContent())!.split('/')[1].trim())
  expect(total).toBeGreaterThan(0)

  const nextButton = page.getByRole('button', { name: /^Next$/ })
  const feedback = page.getByText(/Just so\.|Not quite|Time's up/)

  for (let i = 0; i < total; i++) {
    await page.keyboard.press('1') // pick the first choice
    await expect(feedback).toBeVisible() // graded
    await expect(nextButton).toBeVisible()
    await page.keyboard.press('Enter') // advance
  }

  // After the last advance the session ends on the completion screen.
  await expect(
    page.getByRole('heading', { name: /Fine\.|Tacet\./ }),
  ).toBeVisible()
})
