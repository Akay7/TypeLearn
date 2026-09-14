import { expect, test } from '@playwright/test'

import { LONGEST, mockBackend, sentenceOnScreen } from './fixtures'

/** The lowest point any part of the exercise reaches, and the footer's box. */
async function layout(page) {
  return page.evaluate(() => ({
    contentBottom: Math.max(
      ...[...document.querySelector('main').children].map((el) => el.getBoundingClientRect().bottom),
    ),
    footer: document.querySelector('footer').getBoundingClientRect().toJSON(),
    scrolls: document.documentElement.scrollHeight > window.innerHeight,
  }))
}

test.describe('the footer', () => {
  test('links to the source code', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/Akay7/TypeLearn',
    )
  })

  // The laptop screen the "fits on one screen" requirement names: the footer
  // must not be what pushes the keyboard below the fold.
  test('fits under the longest exercise without scrolling the page', async ({ page }) => {
    await mockBackend(page, [LONGEST])
    await page.goto('/')
    await sentenceOnScreen(page)
    await page.waitForFunction(() => document.fonts.status === 'loaded')

    const { contentBottom, footer, scrolls } = await layout(page)

    expect(scrolls).toBe(false)
    expect(footer.top).toBeGreaterThanOrEqual(contentBottom)
  })

  test.describe('on a screen shorter than the exercise', () => {
    test.use({ viewport: { width: 1280, height: 560 } })

    test('sits below the keyboard legend instead of over it', async ({ page }) => {
      await mockBackend(page, [LONGEST])
      await page.goto('/')
      await sentenceOnScreen(page)
      await page.waitForFunction(() => document.fonts.status === 'loaded')

      const { contentBottom, footer, scrolls } = await layout(page)

      expect(scrolls).toBe(true)
      expect(footer.top).toBeGreaterThanOrEqual(contentBottom)
    })
  })

  test('follows the interface language', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await page.locator('button[aria-haspopup="true"]').click()
    await page.locator('#interface-language').selectOption('ru')

    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: 'Исходный код на GitHub' })).toBeVisible()
  })
})
