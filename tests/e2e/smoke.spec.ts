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
    'Play the Scale',
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

test('Play the Scale: fingering hint flashes, any key hides it, taints the grade', async ({
  page,
}) => {
  await page.goto('/scale-play')

  const card = page.getByRole('article')
  const hintBtn = page.getByRole('button', { name: /show fingering/ })
  // A lit key is a highlight pill; with no notes played yet there are none.
  const litPills = card.locator('rect.fill-accent')
  await expect(litPills).toHaveCount(0)

  // Flash: the whole scale lights at once, and the button locks while shown.
  await hintBtn.click()
  await expect(card.getByRole('button', { name: /fingering shown/ })).toBeVisible()
  const litWhileShown = await litPills.count()
  expect(litWhileShown).toBeGreaterThan(1) // the full scale, not one played note

  // The lit pills (while shown) ARE the whole scale; read each pill's key MIDI
  // in ascending order so we can play the scale in pitch order.
  const midis = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('rect[data-midi]')] as SVGRectElement[]
    const lit = [...document.querySelectorAll('rect.fill-accent')] as SVGRectElement[]
    return lit
      .map((p) => {
        const px = Number(p.getAttribute('x'))
        let best: number | null = null
        let bestDx = Infinity
        for (const r of rects) {
          const dx = Math.abs(Number(r.getAttribute('x')) - px)
          if (dx < bestDx) {
            bestDx = dx
            best = Number(r.getAttribute('data-midi'))
          }
        }
        return best
      })
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)
  })
  expect(midis.length).toBeGreaterThan(1)

  // Play the scale in order, one key per step so React re-renders (and advances
  // the expected-note index) between presses — and the first press hides the
  // lingering hint. Each press is a real pointerdown via the key's data-midi.
  for (const m of midis) {
    await page.locator(`rect[data-midi="${m}"]`).first().dispatchEvent('pointerdown')
  }

  // A clean completion that peeked is graded as missed (not "Just so.").
  await expect(
    card.getByText(/the fingering hint counts it as missed/),
  ).toBeVisible()
  await expect(card.getByText('Just so.')).toHaveCount(0)
})
