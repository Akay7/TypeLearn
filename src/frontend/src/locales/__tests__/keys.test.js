import { describe, expect, it } from 'vitest'

import deCatalog from '../de.json'
import enCatalog from '../en.json'
import frCatalog from '../fr.json'
import huCatalog from '../hu.json'
import ruCatalog from '../ru.json'
import thCatalog from '../th.json'

// The catalogs are nested objects (see the comment in i18n.js); every check
// below is about the dotted paths components look strings up by, so each
// catalog is flattened to those paths first.
function flatten(catalog, prefix = '') {
  return Object.fromEntries(
    Object.entries(catalog).flatMap(([key, value]) =>
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(flatten(value, `${prefix}${key}.`))
        : [[`${prefix}${key}`, value]],
    ),
  )
}

const CATALOGS = { en: enCatalog, fr: frCatalog, de: deCatalog, th: thCatalog, ru: ruCatalog, hu: huCatalog }

// en.json is the reference catalog (see the comment in i18n.js). The other
// locales are edited on Weblate, and a language is often only partly translated
// there, so a key that is missing or blank passes: it falls back to English.
// What does not pass is a translation that would break at runtime — a key en.json
// no longer has, or a placeholder that does not match the English one.
const en = flatten(enCatalog)
const OTHERS = Object.fromEntries(
  Object.entries(CATALOGS)
    .filter(([locale]) => locale !== 'en')
    .map(([locale, catalog]) => [locale, flatten(catalog)]),
)

// Plural forms (see tPlural in i18n.js) vary by language: English has '_one'
// and '_other', Russian adds '_few' and '_many'. Any CLDR form counts as
// belonging to en.json as long as English has the '_other' form of that key.
const PLURAL_FORM = /^(.+)_(zero|one|two|few|many|other)$/

// The en.json string a translation must match, or undefined if it has none.
function sourceOf(key) {
  if (key in en) return en[key]
  const plural = key.match(PLURAL_FORM)
  return plural ? en[`${plural[1]}_other`] : undefined
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort()
}

/** Every key, at every level, that has a dot in it. */
function dottedKeys(catalog, path = '') {
  return Object.entries(catalog).flatMap(([key, value]) => [
    ...(key.includes('.') ? [`${path}${key}`] : []),
    ...(value !== null && typeof value === 'object' ? dottedKeys(value, `${path}${key} → `) : []),
  ])
}

describe('locale catalogs', () => {
  it('en.json is a complete catalog of non-empty strings', () => {
    expect(Object.keys(en).length).toBeGreaterThan(0)
    for (const [key, value] of Object.entries(en)) {
      expect(typeof value, `en.json["${key}"]`).toBe('string')
      expect(value, `en.json["${key}"]`).not.toBe('')
    }
  })

  // A flat 'a.b' key would still resolve, but Weblate writes the keys it adds
  // nested — so a catalog that mixed both shapes would not stay consistent.
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}.json nests its keys instead of joining them with dots`, () => {
      expect(dottedKeys(catalog)).toEqual([])
    })
  }

  for (const [locale, catalog] of Object.entries(OTHERS)) {
    it(`${locale}.json has no key that en.json lacks`, () => {
      expect(Object.keys(catalog).filter((key) => sourceOf(key) === undefined)).toEqual([])
    })

    it(`${locale}.json uses the same placeholders as en.json`, () => {
      for (const [key, value] of Object.entries(catalog)) {
        expect(typeof value, `${locale}.json["${key}"]`).toBe('string')
        const source = sourceOf(key)
        if (value === '' || source === undefined) continue
        expect(placeholders(value), `${locale}.json["${key}"]`).toEqual(placeholders(source))
      }
    })
  }
})
