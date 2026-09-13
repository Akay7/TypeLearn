import { expect, test } from '@playwright/test'

import { mockBackend, sentenceOnScreen } from './fixtures'

const LOOPED = 'Noto Sans Thai Looped Variable'

test.describe('Thai renders in a looped face', () => {
  test('the sentence, the input, and the keycaps all use the bundled face', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const family = (locator) =>
      locator.evaluate((el) => getComputedStyle(el).fontFamily)

    // Not `toContain`: the looped face has to be the one the browser reaches
    // for first, with the sans stack behind it only as a fallback.
    expect(await family(page.locator('p[lang="th"]').first())).toMatch(new RegExp(`^["']?${LOOPED}`))
    expect(await family(page.locator('input[lang="th"]'))).toMatch(new RegExp(`^["']?${LOOPED}`))
    expect(await family(page.locator('button[lang="th"]').first())).toMatch(new RegExp(`^["']?${LOOPED}`))
  })

  test('the face is really loaded, and really used for the sentence', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)

    // A font-family naming a face that never arrived would satisfy the computed
    // style and still render loopless, so ask the browser whether it has the
    // face and can set this exact text in it.
    await expect
      .poll(
        () =>
          page.evaluate(
            ([face, text]) => document.fonts.check(`48px "${face}"`, text),
            [LOOPED, sentence],
          ),
        { message: 'the looped face should be loaded and cover the sentence' },
      )
      .toBe(true)
  })

  test('the interface keeps its own face', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const family = (locator) => locator.evaluate((el) => getComputedStyle(el).fontFamily)

    // The English chrome: the length hint, a control, the keyboard's legend.
    expect(await family(page.getByText(/symbols/))).not.toContain(LOOPED)
    expect(await family(page.getByRole('button', { name: 'Check' }))).not.toContain(LOOPED)
    expect(await family(page.getByText('little'))).not.toContain(LOOPED)
  })

  test('the placeholder is interface text, not Thai text', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    // The field is Thai, so it inherits the looped face — but the hint inside
    // it is the interface talking, and English in a Thai face reads as a slip.
    const placeholder = await page
      .locator('input[lang="th"]')
      .evaluate((el) => getComputedStyle(el, '::placeholder').fontFamily)

    expect(placeholder).not.toContain(LOOPED)
  })

  test('nothing is fetched from a font CDN', async ({ page }) => {
    const external = []
    page.on('request', (request) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) {
        external.push(request.url())
      }
    })

    await mockBackend(page)
    await page.goto('/')
    await page.locator('p[lang="th"]').first().waitFor()

    expect(external).toEqual([])
  })

  test('the font is served from the application\'s own origin', async ({ page }) => {
    const fonts = []
    page.on('response', (response) => {
      if (response.url().endsWith('.woff2')) {
        fonts.push({ url: response.url(), status: response.status() })
      }
    })

    await mockBackend(page)
    await page.goto('/')
    await page.locator('p[lang="th"]').first().waitFor()
    await page.waitForFunction(() => document.fonts.status === 'loaded')

    const thai = fonts.filter((f) => f.url.includes('thai'))
    expect(thai.length).toBeGreaterThan(0)
    for (const font of thai) {
      expect(font.url).toContain('localhost')
      expect(font.status).toBe(200)
    }
  })
})
