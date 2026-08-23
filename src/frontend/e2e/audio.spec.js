import { expect, test } from '@playwright/test'

import { mockBackend, refuseAutoplay, sentenceOnScreen } from './fixtures'

test.describe('the clip plays before the learner types', () => {
  test('plays on its own when the exercise is presented', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    // Nothing is clicked between load and this assertion: the point of the
    // change is that the learner hears the sentence before reading it.
    await expect
      .poll(() => page.evaluate(() => {
        const audio = document.querySelector('audio')
        return audio ? { paused: audio.paused, playing: audio.currentTime > 0 } : null
      }))
      .toMatchObject({ paused: false })
  })

  test('says nothing when autoplay works', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    await expect(page.getByText('Press play to hear it')).toBeHidden()
  })

  test('asks for a press when the browser refuses', async ({ page }) => {
    await refuseAutoplay(page)
    await mockBackend(page)
    await page.goto('/')

    await expect(page.getByText('Press play to hear it')).toBeVisible()
  })

  test('the prompt clears once the learner presses play', async ({ page }) => {
    await refuseAutoplay(page)
    await mockBackend(page)
    await page.goto('/')

    await expect(page.getByText('Press play to hear it')).toBeVisible()

    // The learner's press is exactly the interaction the browser was waiting
    // for, so from here playback is granted.
    await page.evaluate(() => {
      window.__blockAutoplay = false
    })
    await page.getByRole('button', { name: '▶ Play' }).click()

    await expect(page.getByText('Press play to hear it')).toBeHidden()
  })

  test('the prompt does not move the play control', async ({ page }) => {
    await refuseAutoplay(page)
    await mockBackend(page)
    await page.goto('/')

    const control = page.getByRole('button', { name: '▶ Play' })
    await expect(page.getByText('Press play to hear it')).toBeVisible()
    const asked = await control.boundingBox()

    await page.evaluate(() => {
      window.__blockAutoplay = false
    })
    await control.click()
    await expect(page.getByText('Press play to hear it')).toBeHidden()

    // The prompt appearing and disappearing must not shift the control the
    // learner is being asked to press.
    expect(await control.boundingBox()).toEqual(asked)
  })

  test('a refusal leaves the rest of the exercise alone', async ({ page }) => {
    await refuseAutoplay(page)
    await mockBackend(page)
    await page.goto('/')

    // The sentence, the field, and the keyboard are all still there: a clip
    // that would not start is not a broken exercise.
    await expect(page.locator('p[lang="th"]').first()).toBeVisible()
    await expect(page.locator('input[lang="th"]')).toBeFocused()
    await expect(page.getByRole('button', { name: 'Backspace' })).toBeVisible()
  })

  test('replaying restarts from the beginning', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    await expect.poll(() => page.evaluate(() => document.querySelector('audio').currentTime > 0)).toBe(true)

    await page.getByRole('button', { name: '▶ Play' }).click()
    const restarted = await page.evaluate(() => document.querySelector('audio').currentTime)

    // Rewound, not resumed — the whole clip is available again.
    expect(restarted).toBeLessThan(0.2)
  })

  test('the previous clip does not run under the next exercise', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')

    const first = await page.locator('audio').elementHandle()
    const sentence = await sentenceOnScreen(page)

    // Answer correctly and let the advance happen while the clip is still
    // running — two seconds of audio against a 900 ms advance.
    await page.locator('input[lang="th"]').fill(sentence)
    await expect(page.getByText('✓ Correct')).toBeVisible()
    await expect(page.locator('p[lang="th"]').first()).not.toHaveText(sentence)

    // The element the previous exercise played through was stopped on its way
    // out, and only one player is left on the page.
    expect(await first.evaluate((el) => el.paused)).toBe(true)
    expect(await page.locator('audio').count()).toBe(1)
    await expect(page.locator('audio')).not.toHaveJSProperty('src', await first.evaluate((el) => el.src))
  })
})
