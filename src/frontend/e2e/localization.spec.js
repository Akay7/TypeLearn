import { expect, test } from '@playwright/test'

import { mockBackend, sentenceOnScreen } from './fixtures'

// Not `getByRole(... { name: 'Settings' })`: this button's accessible name is
// itself translated, so a selector that only matches the English name would
// stop finding it the moment a test switches languages. `aria-haspopup`
// identifies it regardless of which language is active.
const settingsButton = (page) => page.locator('button[aria-haspopup="true"]')
const languageSelect = (page) => page.locator('#interface-language')

test.describe('choosing an interface language', () => {
  test('switches the menu and the rest of the interface, without a reload', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await expect(page.getByText('symbols')).toBeVisible()

    await settingsButton(page).click()
    await expect(page.getByText('Virtual keyboard')).toBeVisible()

    await languageSelect(page).selectOption('ru')

    await expect(page.getByText('Виртуальная клавиатура')).toBeVisible()
    await expect(page.getByText('символов')).toBeVisible()
  })

  test('leaves the Thai exercise sentence exactly as it was', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    const sentence = await sentenceOnScreen(page)

    await settingsButton(page).click()
    await languageSelect(page).selectOption('fr')

    await expect(page.locator('p[lang="th"]').first()).toHaveText(sentence)
  })

  test('persists across a reload', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await settingsButton(page).click()
    await languageSelect(page).selectOption('de')
    await expect(page.getByText('Virtuelle Tastatur')).toBeVisible()

    await page.reload()
    await sentenceOnScreen(page)

    await settingsButton(page).click()
    await expect(page.getByText('Virtuelle Tastatur')).toBeVisible()
    await expect(languageSelect(page)).toHaveValue('de')
  })
})

test.describe('the default interface language', () => {
  test('follows a supported browser language on first visit', async ({ browser }) => {
    // A fresh context: no stored preference, so the default this test is
    // about is the only thing that can be deciding the language.
    const context = await browser.newContext({ locale: 'fr-FR' })
    const page = await context.newPage()
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await settingsButton(page).click()
    await expect(page.getByText('Clavier virtuel')).toBeVisible()

    await context.close()
  })

  test('falls back to English for an unsupported browser language', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'ja-JP' })
    const page = await context.newPage()
    await mockBackend(page)
    await page.goto('/')
    await sentenceOnScreen(page)

    await settingsButton(page).click()
    await expect(page.getByText('Virtual keyboard')).toBeVisible()

    await context.close()
  })
})
