import { expect, test } from '@playwright/test'

import { mockBackend } from './fixtures'

const settingsButton = (page) => page.getByRole('button', { name: 'Settings' })
const showTranslation = (page) => page.getByRole('checkbox', { name: 'Show translation' })
const field = (page) => page.locator('input[lang="th"]')

// One exercise, so the sentence on screen is known without reading it back.
const SENTENCE = ['สวัสดี']
const TRANSLATIONS = { 0: { en: 'Hello', fr: 'Bonjour' } }

async function turnOn(page) {
  await settingsButton(page).click()
  await showTranslation(page).click()
}

test('no translation is shown or fetched until the learner asks for one', async ({ page }) => {
  const requests = await mockBackend(page, SENTENCE, { translations: TRANSLATIONS })
  await page.goto('/')
  await expect(page.locator('p[lang="th"]')).toHaveText('สวัสดี')

  await expect(page.getByText('Hello')).toHaveCount(0)
  expect(requests.some((r) => r.query.includes('query Translations'))).toBe(false)
})

test('turned on, it shows the translation in the interface language and follows it', async ({
  page,
}) => {
  await mockBackend(page, SENTENCE, { translations: TRANSLATIONS })
  await page.goto('/')
  await turnOn(page)

  await expect(page.locator('button[lang="en"]')).toHaveText('Hello')

  // Choosing a setting closes the menu, so it is opened again for the next.
  await settingsButton(page).click()
  await page.locator('#interface-language').selectOption('fr')

  await expect(page.locator('button[lang="fr"]')).toHaveText('Bonjour')
  // The sentence itself never changes with the interface language.
  await expect(page.locator('p[lang="th"]')).toHaveText('สวัสดี')
})

test('the setting survives a reload', async ({ page }) => {
  await mockBackend(page, SENTENCE, { translations: TRANSLATIONS })
  await page.goto('/')
  await turnOn(page)
  await expect(page.locator('button[lang="en"]')).toHaveText('Hello')

  await page.reload()

  await expect(page.locator('button[lang="en"]')).toHaveText('Hello')
})

test('rating marks the choice and sends it', async ({ page }) => {
  const requests = await mockBackend(page, SENTENCE, { translations: TRANSLATIONS })
  await page.goto('/')
  await turnOn(page)
  const good = page.getByRole('button', { name: 'Good translation' })

  await good.click()

  await expect(good).toHaveAttribute('aria-pressed', 'true')
  const rating = requests.find((r) => r.query.includes('mutation Rate'))
  expect(rating.variables).toMatchObject({ id: 't0-en', value: 'UP' })
  // Rating is not typing.
  await expect(field(page)).toHaveValue('')
})

test('a suggestion is sent, confirmed, and never typed into the answer', async ({ page }) => {
  const requests = await mockBackend(page, SENTENCE, { translations: TRANSLATIONS })
  await page.goto('/')
  await turnOn(page)

  await page.getByRole('button', { name: 'Suggest a better translation' }).click()
  const box = page.getByRole('textbox', { name: 'Your translation' })
  await expect(box).toBeFocused()
  await box.pressSequentially('Hi there')
  await box.press('Enter')
  await box.pressSequentially('friend')
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByText('Thanks — it will appear after review.')).toBeVisible()
  const suggestion = requests.find((r) => r.query.includes('mutation Propose'))
  expect(suggestion.variables).toMatchObject({
    exerciseId: '0',
    language: 'en',
    text: 'Hi there\nfriend',
  })
  await expect(field(page)).toHaveValue('')
  await expect(page.getByText('✗ Incorrect — try again')).toHaveCount(0)
})

test('an exercise with no translation offers to suggest one', async ({ page }) => {
  await mockBackend(page, SENTENCE, { translations: {} })
  await page.goto('/')
  await turnOn(page)

  await expect(page.getByText('No translation yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Suggest a translation' })).toBeVisible()
})
