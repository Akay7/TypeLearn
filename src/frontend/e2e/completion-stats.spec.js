import { expect, test } from '@playwright/test'

import { SENTENCES, clickThrough, disableCompletionStats, mockBackend, sentenceOnScreen } from './fixtures'

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
    // elements. The row headers are the actual, specific claim.
    await expect(page.getByRole('rowheader', { name: 'Today' })).toBeVisible()
    await expect(page.getByRole('rowheader', { name: 'Last 7 days' })).toBeVisible()
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
  // A table row's own accessible name mixes in all its cells' text, which
  // makes matching by row label unreliable — filtering by the row-header
  // cell it actually contains, then reading its data cells by position
  // (symbols correct, key presses, exercises completed — the column order
  // in CompletionStats.vue), is exact instead.
  function rowCells(page, label) {
    return page.locator('tr').filter({ has: page.getByRole('rowheader', { name: label }) }).getByRole('cell')
  }

  test('reflect exactly what was typed for one correctly completed exercise', async ({ page }) => {
    await mockBackend(page, [SENTENCES[0]])
    await page.goto('/')

    await clickThrough(page, SENTENCES[0])

    const length = String([...SENTENCES[0]].length)
    const today = rowCells(page, 'Today')
    await expect(today.nth(0)).toHaveText(length)
    await expect(today.nth(1)).toHaveText(length)
    await expect(today.nth(2)).toHaveText('1')

    const last7Days = rowCells(page, 'Last 7 days')
    await expect(last7Days.nth(0)).toHaveText(length)
    await expect(last7Days.nth(1)).toHaveText(length)
    await expect(last7Days.nth(2)).toHaveText('1')
  })
})
