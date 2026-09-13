import { expect, test } from '@playwright/test'

import { disableCompletionStats, mockBackend, sentenceOnScreen } from './fixtures'

const field = (page) => page.locator('input[lang="th"]')
const settingsButton = (page) => page.getByRole('button', { name: 'Settings' })
const option = (page, label) => page.getByRole('radio', { name: label })

/** Opens the settings menu and picks one of its Auto/On/Off options. */
async function chooseVirtualKeyboard(page, label) {
  await settingsButton(page).click()
  await option(page, label).click()
}

test.describe('phone-sized, touch-primary viewport', () => {
  // Small screen + no hover-capable pointer is exactly the phone
  // classification from lib/device.js.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the OS virtual keyboard is suppressed by default', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await expect(field(page)).toHaveAttribute('inputmode', 'none')
  })

  test('the settings menu forces it back on, without a reload', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)
    await expect(field(page)).toHaveAttribute('inputmode', 'none')

    await chooseVirtualKeyboard(page, 'On')

    await expect(field(page)).toHaveAttribute('inputmode', 'text')
  })

  test('choosing Auto again follows the device once more', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await chooseVirtualKeyboard(page, 'On')
    await expect(field(page)).toHaveAttribute('inputmode', 'text')

    await chooseVirtualKeyboard(page, 'Auto')
    await expect(field(page)).toHaveAttribute('inputmode', 'none')
  })

  test('the menu closes after a choice, and on Escape', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await chooseVirtualKeyboard(page, 'On')
    await expect(option(page, 'On')).toBeHidden()

    await settingsButton(page).click()
    await expect(option(page, 'Off')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(option(page, 'Off')).toBeHidden()
  })
})

test.describe('a non-touch viewport', () => {
  test('the OS virtual keyboard is left available by default', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await expect(field(page)).toHaveAttribute('inputmode', 'text')
  })

  test('the settings menu can still force it off', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await chooseVirtualKeyboard(page, 'Off')

    await expect(field(page)).toHaveAttribute('inputmode', 'none')
  })
})

test.describe('the on-screen keyboard, separately from the OS one', () => {
  test('Hide removes the board; a physical keyboard still works', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    // Only the final '✓ Correct' confirmation below cares about this setting.
    await disableCompletionStats(page)
    const sentence = await sentenceOnScreen(page)
    await expect(page.getByRole('button', { name: 'Backspace' })).toBeVisible()

    await settingsButton(page).click()
    await option(page, 'Hide').click()

    await expect(page.getByRole('button', { name: 'Backspace' })).toBeHidden()

    // The board is gone, but the field is a plain input — typing and
    // checking work exactly as they do with the board on screen.
    await field(page).fill(sentence)
    await field(page).press('Enter')
    await expect(page.getByText('✓ Correct')).toBeVisible()
  })

  test('Show brings it back', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await settingsButton(page).click()
    await option(page, 'Hide').click()
    await expect(page.getByRole('button', { name: 'Backspace' })).toBeHidden()

    await settingsButton(page).click()
    await option(page, 'Show').click()
    await expect(page.getByRole('button', { name: 'Backspace' })).toBeVisible()
  })
})
