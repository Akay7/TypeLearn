import { expect, test } from '@playwright/test'

import { LONGEST, SENTENCES, clickThrough, disableCompletionStats, mockBackend, sentenceOnScreen } from './fixtures'

const field = (page) => page.locator('input[lang="th"]')
const nextButton = (page) => page.getByRole('button', { name: 'Next exercise →' })
const settingsButton = (page) => page.getByRole('button', { name: 'Settings' })
const option = (page, label) => page.getByRole('radio', { name: label })

// The hint row's own Play/Pause control (`SentenceView.vue`) is the only
// one on screen even once the summary shows: it is retriggered to replay
// the completed clip rather than a second copy being mounted next to the
// summary (see that component's comment on `AudioPlayer`'s `:key`).
const audioControl = (page) => page.getByRole('button', { name: /Play|Pause/ })

test.describe('the post-check summary (on by default)', () => {
  test("replaces the input field and Check with today's counts and Next exercise, without duplicating the Play control", async ({
    page,
  }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)

    await expect(field(page)).toBeHidden()
    await expect(page.getByRole('button', { name: 'Check' })).toBeHidden()
    await expect(audioControl(page)).toBeVisible()
    await expect(audioControl(page)).toHaveCount(1)
    await expect(page.locator('audio')).toHaveCount(1)
    // Not `getByText('Today')`: the table's own `sr-only` caption also
    // contains the word ("today and over the last 7 days"), and `getByText`
    // matches case-insensitively, so that string alone resolves to two
    // elements. The column headers are the actual, specific claim.
    await expect(page.getByRole('columnheader', { name: 'Today' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Last 7 days' })).toBeVisible()
    await expect(nextButton(page)).toBeVisible()
  })

  test("Next exercise takes Check's exact position and size, not just its row", async ({ page }) => {
    // Check is centered on the answer field's own height, taller than the
    // button itself (a bigger typing target); Next exercise is pinned to
    // that same first-row height by other means (see CompletionStats.vue)
    // rather than being centered against the table, so this is worth
    // checking to the pixel rather than just "the same row" — a right
    // answer to "which row" can still be the wrong height within it.
    await mockBackend(page)
    await page.goto('/')

    const checkBox = await page.getByRole('button', { name: 'Check' }).boundingBox()

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)

    expect(await nextButton(page).boundingBox()).toEqual(checkBox)
  })

  test('does not move the sentence, the hint row, or the on-screen keyboard', async ({ page }) => {
    // One exercise, so there is nothing to wrap onto and disturb the
    // comparison — the summary holds the same exercise on screen until
    // "Next exercise" is pressed.
    await mockBackend(page, [SENTENCES[0]])
    await page.goto('/')

    async function anchors() {
      return {
        sentence: await page.locator('p[lang="th"]').first().boundingBox(),
        // Not anchored to the end: Vue's whitespace condensing turns the
        // newline before this paragraph's closing tag into a literal
        // trailing space in its text content (the same gotcha
        // `OnScreenKeyboard.vue` already documents for its own labels), so
        // nothing here actually ends in "symbols".
        hint: await page.getByText(/symbols/).boundingBox(),
        keyboard: await page.getByRole('button', { name: 'Backspace' }).boundingBox(),
      }
    }

    const before = await anchors()

    await field(page).fill(SENTENCES[0])
    await expect(nextButton(page)).toBeVisible()

    expect(await anchors()).toEqual(before)
  })

  test('the completed clip autoplays, and the control reads Pause while it does', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)

    await expect(audioControl(page)).toHaveText('⏸ Pause')
  })

  test('Next exercise advances to a fresh, empty answer row', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)
    await nextButton(page).click()

    await expect(field(page)).toBeVisible()
    await expect(field(page)).toHaveValue('')
    await expect(page.locator('p[lang="th"]').first()).not.toHaveText(sentence)
  })

  test('pressing Enter also advances', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)
    await page.keyboard.press('Enter')

    await expect(page.locator('p[lang="th"]').first()).not.toHaveText(sentence)
    // The field never lost focus across the swap (it is `invisible`, not
    // unmounted — see `AnswerInput.vue`), so the same Enter press also
    // reaches its own `@keyup.enter`. That must not check the fresh
    // exercise's still-empty answer and report it wrong.
    await expect(page.getByText('✗ Incorrect')).toBeHidden()
    await expect(field(page)).toHaveValue('')
  })

  test('the on-screen keyboard setting is unaffected by the summary', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    await settingsButton(page).click()
    await option(page, 'Hide').click()

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)

    // Hidden before the check and still hidden after — the summary neither
    // needs it nor brings it back.
    await expect(page.getByRole('button', { name: 'Backspace' })).toBeHidden()
    await expect(nextButton(page)).toBeVisible()
  })
})

test.describe('turning the summary off', () => {
  test('restores the plain verdict and immediate auto-advance', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await disableCompletionStats(page)

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)

    await expect(page.getByText('✓ Correct')).toBeVisible()
    await expect(nextButton(page)).toBeHidden()
    await expect(page.locator('p[lang="th"]').first()).not.toHaveText(sentence)
  })
})

test.describe('the counters', () => {
  // One row per counter, headed by its label, with Today's and the last 7
  // days' totals as its two data cells in that order (CompletionStats.vue).
  // A table row's own accessible name mixes in all its cells' text, so the
  // row is found by the row-header cell it contains instead.
  function counterCells(page, label) {
    return page.locator('tr').filter({ has: page.getByRole('rowheader', { name: label }) }).getByRole('cell')
  }

  test('reflect exactly what was typed for one correctly completed exercise', async ({ page }) => {
    await mockBackend(page, [SENTENCES[0]])
    await page.goto('/')

    await clickThrough(page, SENTENCES[0])

    const length = String([...SENTENCES[0]].length)
    for (const [label, expected] of [
      ['Symbols correct', length],
      ['Key presses', length],
      ['Exercises completed', '1'],
    ]) {
      const cells = counterCells(page, label)
      await expect(cells.nth(0)).toHaveText(expected)
      await expect(cells.nth(1)).toHaveText(expected)
    }
  })
})

// A phone's reserved answer box is about 330×100px, and the summary has to
// fit it without spilling onto the keyboard below — in every interface
// language, since the labels' lengths are what decides it. 360px is the
// narrowest width this is promised for.
test.describe('the summary on a phone-sized viewport', () => {
  const box = (page) => page.locator('table').locator('xpath=ancestor::div[contains(@class, "absolute")][1]')

  for (const locale of ['en', 'de', 'fr', 'hu', 'ru', 'th']) {
    test(`fits the answer row's reserved box at 360px (${locale})`, async ({ browser }) => {
      const context = await browser.newContext({ locale, viewport: { width: 360, height: 800 } })
      const page = await context.newPage()
      await mockBackend(page, [LONGEST])
      await page.goto('/')

      const sentence = await sentenceOnScreen(page)
      const check = await page.locator('input[lang="th"] + button').boundingBox()
      await page.locator('input[lang="th"]').fill(sentence)

      const next = box(page).getByRole('button')
      await expect(next).toBeVisible()
      expect(await next.boundingBox()).toEqual(check)

      const table = await page.locator('table').boundingBox()
      const reserved = await box(page).boundingBox()
      expect(table.x).toBeGreaterThanOrEqual(reserved.x)
      expect(table.y + table.height).toBeLessThanOrEqual(reserved.y + reserved.height)
      expect(table.x + table.width).toBeLessThanOrEqual(check.x)

      await context.close()
    })
  }
})

test.describe('the answer-row button on a phone-sized viewport', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('is a compact circle that leaves the field most of the row, and keeps its name', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    const check = await page.getByRole('button', { name: 'Check' }).boundingBox()
    const input = await field(page).boundingBox()
    expect(check.width).toBeLessThanOrEqual(56)
    expect(input.width).toBeGreaterThan(2 * check.width)
  })
})

// Next exercise is sized to fit either label, so a long translation neither
// overflows the pill nor makes Next a different size from Check.
test('the Next exercise label fits its button in a long-label language', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru', viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  await mockBackend(page)
  await page.goto('/')

  const check = await page.locator('input[lang="th"] + button').boundingBox()
  await page.locator('input[lang="th"]').fill(await sentenceOnScreen(page))

  const next = page.getByRole('button', { name: 'Следующее упражнение →' })
  await expect(next).toBeVisible()
  expect(await next.boundingBox()).toEqual(check)
  expect(await next.evaluate((button) => button.scrollWidth <= button.clientWidth)).toBe(true)

  await context.close()
})
