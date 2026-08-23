import { expect, test } from '@playwright/test'

import { LONGEST, SENTENCES, clickThrough, mockBackend, sentenceOnScreen } from './fixtures'

const field = (page) => page.locator('input[lang="th"]')

test.describe('the answer checks itself', () => {
  test('the last character checks the answer, with nothing else pressed', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await clickThrough(page, sentence)

    // No Enter, no Check: the keyboard clicks above are the whole interaction.
    await expect(page.getByText('✓ Correct')).toBeVisible()
  })

  test('a full-length answer that is wrong is judged without being asked', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(wrongAnswerFor(sentence))

    await expect(page.getByText('✗ Incorrect — try again')).toBeVisible()
  })

  test('nothing is said while the answer is still too short', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill([...sentence].slice(0, 3).join(''))

    await expect(page.getByText('✗ Incorrect — try again')).toBeHidden()
    await expect(page.getByText('✓ Correct')).toBeHidden()
  })

  test('typing again clears the verdict it described', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(wrongAnswerFor(sentence))
    await expect(page.getByText('✗ Incorrect — try again')).toBeVisible()

    await page.getByRole('button', { name: 'Backspace' }).click()

    await expect(page.getByText('✗ Incorrect — try again')).toBeHidden()
  })

  test('Enter still checks an answer that is nowhere near finished', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill([...sentence].slice(0, 2).join(''))
    await field(page).press('Enter')

    await expect(page.getByText('✗ Incorrect — try again')).toBeVisible()
  })

  test('the Check control still checks an answer that is nowhere near finished', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill([...sentence].slice(0, 2).join(''))
    await page.getByRole('button', { name: 'Check' }).click()

    await expect(page.getByText('✗ Incorrect — try again')).toBeVisible()
  })
})

test.describe('the exercise fits on one screen', () => {
  // The project's default viewport is 1280x720 — a laptop, and the size the
  // requirement names.
  test('nothing is below the fold, even for the longest sentence', async ({ page }) => {
    await mockBackend(page, [LONGEST])
    await page.goto('/')
    await page.waitForFunction(() => document.fonts.status === 'loaded')

    const { scrolls, keyboardBottom, viewport } = await page.evaluate(() => ({
      scrolls: document.documentElement.scrollHeight > window.innerHeight,
      keyboardBottom: document.querySelector('ul').getBoundingClientRect().bottom,
      viewport: window.innerHeight,
    }))

    expect(scrolls).toBe(false)
    // Not merely "the page does not scroll": the keyboard is the thing that
    // must not be below the fold, legend included.
    expect(keyboardBottom).toBeLessThanOrEqual(viewport)
  })

  test('the check control sits beside the field, not beneath it', async ({ page }) => {
    await mockBackend(page, [LONGEST])
    await page.goto('/')

    const input = await field(page).boundingBox()
    const check = await page.getByRole('button', { name: 'Check' }).boundingBox()

    // Same row: the control's middle is somewhere inside the field's height.
    const middle = check.y + check.height / 2
    expect(middle).toBeGreaterThan(input.y)
    expect(middle).toBeLessThan(input.y + input.height)

    // And to its right, not overlapping it.
    expect(check.x).toBeGreaterThanOrEqual(input.x + input.width)
  })

  test('the field lines up with the keys below it', async ({ page }) => {
    await mockBackend(page, [LONGEST])
    await page.goto('/')

    const row = await field(page).locator('..').boundingBox()
    const board = await page.getByRole('button', { name: 'Backspace' }).locator('../..').boundingBox()

    // One column, not two of different widths.
    expect(Math.round(row.x)).toBe(Math.round(board.x))
    expect(Math.round(row.x + row.width)).toBe(Math.round(board.x + board.width))
  })
})

test.describe('a verdict does not move the page', () => {
  // One exercise, so the deck wraps onto itself: what follows a correct answer
  // is the same sentence, and a measurement cannot be disturbed by a different
  // one wrapping onto a second line.
  const ONE = [SENTENCES[0]]

  /** Where the learner's two anchors are: the field, and a key on the board. */
  async function anchors(page) {
    return {
      input: await field(page).boundingBox(),
      key: await page.getByRole('button', { name: 'Backspace' }).boundingBox(),
    }
  }

  test('the input and the keyboard hold their positions across a check', async ({ page }) => {
    await mockBackend(page, ONE)
    await page.goto('/')

    const before = await anchors(page)

    await field(page).fill(wrongAnswerFor(ONE[0]))
    await expect(page.getByText('✗ Incorrect — try again')).toBeVisible()
    expect(await anchors(page)).toEqual(before)

    await field(page).fill(ONE[0])
    await expect(page.getByText('✓ Correct')).toBeVisible()
    expect(await anchors(page)).toEqual(before)
  })

  test('the space is already reserved before the first check', async ({ page }) => {
    await mockBackend(page, ONE)
    await page.goto('/')

    // Nothing has been checked yet, and the first verdict must fill space that
    // already exists rather than claiming new space.
    const untouched = await anchors(page)

    await field(page).fill(wrongAnswerFor(ONE[0]))
    await expect(page.getByText('✗ Incorrect — try again')).toBeVisible()

    expect(await anchors(page)).toEqual(untouched)
  })

  test('the expected sentence is not repeated under the verdict', async ({ page }) => {
    await mockBackend(page, ONE)
    await page.goto('/')

    await field(page).fill(wrongAnswerFor(ONE[0]))
    await expect(page.getByText('✗ Incorrect — try again')).toBeVisible()

    // It has been on screen at text-5xl the whole time; a second copy would be
    // both redundant and the tallest thing pushing the keyboard down.
    await expect(page.getByText(ONE[0], { exact: true })).toHaveCount(1)
  })
})

test.describe('the loop continues', () => {
  test('a correct answer brings the next exercise, empty and unjudged', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)
    await expect(page.getByText('✓ Correct')).toBeVisible()

    await expect(page.locator('p[lang="th"]').first()).not.toHaveText(sentence)
    await expect(field(page)).toHaveValue('')
    await expect(page.getByText('✓ Correct')).toBeHidden()
    await expect(page.getByText('✗ Incorrect — try again')).toBeHidden()
  })

  test('the keyboard points at the first character of the new sentence', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)
    await expect(page.locator('p[lang="th"]').first()).not.toHaveText(sentence)

    const next = await sentenceOnScreen(page)
    const highlighted = page.locator(`button[aria-label^="${[...next][0]},"]`)

    await expect(highlighted).toHaveClass(/ring-2/)
  })

  test('typing past a correct answer stays on the exercise instead of advancing', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    await field(page).fill(sentence)
    await field(page).fill(`${sentence}${[...sentence][0]}`)

    await expect(page.getByText('✗ Incorrect — try again')).toBeVisible()

    // The advance the correct answer scheduled was called off with it: being
    // carried away from a mistake still on screen is the bug this prevents.
    await page.waitForTimeout(1200)
    await expect(page.locator('p[lang="th"]').first()).toHaveText(sentence)
  })
})

/** The sentence with its last character swapped — same length, wrong answer. */
function wrongAnswerFor(sentence) {
  const chars = [...sentence]
  chars[chars.length - 1] = chars[chars.length - 1] === 'ก' ? 'ข' : 'ก'
  return chars.join('')
}
