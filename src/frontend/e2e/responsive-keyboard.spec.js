import { expect, test } from '@playwright/test'

import { LONGEST, clickThrough, mockBackend, sentenceOnScreen } from './fixtures'

// The board's rows total `--board` wide (see src/style.css), far past a phone
// viewport, and stay that size rather than shrinking keys below a tappable
// size (OnScreenKeyboard.vue) — so the panel scrolls sideways instead. These
// check that the fix actually holds: the page itself never grows wider than
// the viewport, and every key an exercise can ask for — including the ones
// that start off past the right edge — is still reachable by clicking.
test.describe('the keyboard board on a phone-sized viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the page itself does not scroll sideways', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    const overflowsPage = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflowsPage).toBe(false)
  })

  test('the longest sentence can still be typed key by key, off-screen keys included', async ({ page }) => {
    await mockBackend(page, [LONGEST])
    await page.goto('/')
    const sentence = await sentenceOnScreen(page)

    await clickThrough(page, sentence)

    await expect(page.getByText('✓ Correct')).toBeVisible()
  })
})
