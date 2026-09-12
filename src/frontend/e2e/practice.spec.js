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
    // Backspace's panel: row > the fixed-width rows block > the horizontal
    // scroll container > the padded panel — four levels, since the board now
    // scrolls sideways below `--board` instead of shrinking (see
    // OnScreenKeyboard.vue).
    const board = await page.getByRole('button', { name: 'Backspace' }).locator('../../../..').boundingBox()

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

test.describe('the keyboard is one board', () => {
  /**
   * Every key of the keyboard, grouped by the row it sits in, with the board's
   * own width. Rounded, because a layout that is identical can still differ in
   * the last subpixel.
   */
  const boardShape = (page) =>
    page.evaluate(() => {
      const board = document.querySelector('button[lang="th"]').closest('div.flex-col')
      const box = (element) => {
        const rect = element.getBoundingClientRect()
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      }

      return {
        width: Math.round(board.getBoundingClientRect().width),
        rows: [...board.querySelectorAll(':scope > div')].map((row) =>
          [...row.querySelectorAll('button')].map(box),
        ),
      }
    })

  test('Shift changes what the keys type, not where they are', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await page.waitForFunction(() => document.fonts.status === 'loaded')

    const unshifted = await boardShape(page)
    await page.getByRole('button', { name: '⇧ Shift' }).first().click()
    const shifted = await boardShape(page)

    // Not only the key count: every key, including the modifiers. The shift
    // layer used to carry an eleventh key on the bottom row, which the right
    // Shift shrank to make room for — so the board reflowed under the fingers
    // aiming at it.
    expect(shifted).toEqual(unshifted)
  })

  test('a character Kedmanee lacks is reached by switching layout', async ({ page }) => {
    // The corpus carries `!` and no Thai keyboard has a key for it. The sentence
    // is shown as it was ingested, and the board switches to the Latin layout to
    // point at the key — which is what a Thai typist does.
    await mockBackend(page, ['ขอบคุณ!'])
    await page.goto('/')

    const sentence = await sentenceOnScreen(page)
    expect(sentence).toBe('ขอบคุณ!')

    // Thai while the Thai characters are being typed...
    await expect(page.getByRole('button', { name: /Keyboard layout/ })).toHaveText('ไทย')
    await clickThrough(page, 'ขอบคุณ')

    // ...and the Latin board once `!` is what is expected, with its key lit.
    await expect(page.getByRole('button', { name: /Keyboard layout/ })).toHaveText('EN')
    await expect(page.locator('button[aria-label^="!,"]')).toHaveClass(/ring-2/)

    await clickThrough(page, '!')
    await expect(page.getByText('✓ Correct')).toBeVisible()
  })

  test('the learner can switch layout themselves', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const control = page.getByRole('button', { name: /Keyboard layout/ })
    await expect(control).toHaveText('ไทย')

    await control.click()

    await expect(control).toHaveText('EN')
    await expect(page.locator('button[aria-label^="q,"]')).toBeVisible()
  })

  test('the board does not switch for punctuation Kedmanee carries', async ({ page }) => {
    // `?` is on both boards. The exercise's own wins, so the keyboard does not
    // move under a learner who is still typing Thai.
    await mockBackend(page, ['อะไรนะ?'])
    await page.goto('/')

    await clickThrough(page, 'อะไรนะ')

    await expect(page.getByRole('button', { name: /Keyboard layout/ })).toHaveText('ไทย')
  })

  test('the shift layer is really on screen', async ({ page }) => {
    // Guards the test above from passing because nothing happened at all.
    await mockBackend(page)
    await page.goto('/')

    const unshifted = await page.locator('button[lang="th"]').allTextContents()
    await page.getByRole('button', { name: '⇧ Shift' }).first().click()
    const shifted = await page.locator('button[lang="th"]').allTextContents()

    expect(shifted).not.toEqual(unshifted)
    expect(shifted).toContain('ฏ')
  })
})

test.describe('finger guidance', () => {
  // ด and เ are both left-index keys on the home row; ่ is the right-index
  // home key. Their aria-labels start with the character, a comma, then the
  // finger name and — for a home key — ", rest position".
  const key = (page, char) => page.locator(`button[aria-label^="${char},"]`)

  test('the two index fingers are shown in different colours', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const leftIndexTint = await key(page, 'ด').getAttribute('class')
    const rightIndexTint = await key(page, '่').getAttribute('class')

    const backgroundClasses = (classAttr) =>
      classAttr.split(' ').filter((name) => name.startsWith('bg-'))

    expect(backgroundClasses(leftIndexTint)).not.toEqual(backgroundClasses(rightIndexTint))
  })

  test('the two index fingers home keys are marked, and their other keys are not', async ({
    page,
  }) => {
    await mockBackend(page)
    await page.goto('/')

    await expect(key(page, 'ด')).toHaveAttribute('aria-label', /rest position/)
    await expect(key(page, '่')).toHaveAttribute('aria-label', /rest position/)

    // เ and ้ are the same two fingers' *other* home-row column — reached, not
    // rested on — so they carry no marker.
    await expect(key(page, 'เ')).not.toHaveAttribute('aria-label', /rest position/)
    await expect(key(page, '้')).not.toHaveAttribute('aria-label', /rest position/)
  })

  test('the legend explains both the index colours and the marker', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    await expect(page.getByText('left index')).toBeVisible()
    await expect(page.getByText('right index')).toBeVisible()
    await expect(page.getByText('rest position')).toBeVisible()
  })
})

/** The sentence with its last character swapped — same length, wrong answer. */
function wrongAnswerFor(sentence) {
  const chars = [...sentence]
  chars[chars.length - 1] = chars[chars.length - 1] === 'ก' ? 'ข' : 'ก'
  return chars.join('')
}
