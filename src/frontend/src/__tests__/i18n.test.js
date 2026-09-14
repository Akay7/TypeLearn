import { beforeEach, describe, expect, it, vi } from 'vitest'

// A French catalog as Weblate leaves a half-done translation: some strings
// translated, one written out blank, the rest not there at all — including
// the '_one' form of a plural whose '_other' form is translated.
vi.mock('../locales/fr.json', () => ({
  default: {
    answer: { check: 'Vérifier' },
    sentence: { loading: '', symbolCount_other: '{count} caractères' },
  },
}))

// A language with no plural translated at all, not even '_other'.
vi.mock('../locales/hu.json', () => ({ default: {} }))

const { i18n, tPlural } = await import('../i18n')

beforeEach(() => {
  i18n.global.locale.value = 'en'
})

describe('a partially translated locale', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'fr'
  })

  it('uses the translations it has', () => {
    expect(i18n.global.t('answer.check')).toBe('Vérifier')
  })

  it('falls back to English for a blank translation instead of rendering it empty', () => {
    expect(i18n.global.t('sentence.loading')).toBe('Loading an exercise…')
  })

  it('falls back to English for a missing translation', () => {
    expect(i18n.global.t('sentence.empty')).toBe('No exercises are available yet.')
  })

  it("uses the language's own '_other' form for a plural form it has not translated", () => {
    expect(tPlural('sentence.symbolCount', 1)).toBe('1 caractères')
  })
})

describe('tPlural', () => {
  it('picks the English singular and plural', () => {
    expect(tPlural('sentence.symbolCount', 1)).toBe('1 symbol')
    expect(tPlural('sentence.symbolCount', 6)).toBe('6 symbols')
  })

  it("picks each of Russian's forms by the number's ending, not just by 1", () => {
    i18n.global.locale.value = 'ru'
    expect(tPlural('sentence.symbolCount', 1)).toBe('1 символ')
    expect(tPlural('sentence.symbolCount', 3)).toBe('3 символа')
    expect(tPlural('sentence.symbolCount', 5)).toBe('5 символов')
    expect(tPlural('sentence.symbolCount', 11)).toBe('11 символов')
    expect(tPlural('sentence.symbolCount', 21)).toBe('21 символ')
  })

  it('falls back to the English form English itself would use when a language has no forms', () => {
    i18n.global.locale.value = 'hu'
    expect(tPlural('sentence.symbolCount', 1)).toBe('1 symbol')
    expect(tPlural('sentence.symbolCount', 6)).toBe('6 symbols')
  })

  it("uses Thai's single form for every number", () => {
    i18n.global.locale.value = 'th'
    expect(tPlural('sentence.symbolCount', 1)).toBe('1 ตัวอักษร')
    expect(tPlural('sentence.symbolCount', 6)).toBe('6 ตัวอักษร')
  })
})
