import { describe, expect, it } from 'vitest'

import de from '../de.json'
import en from '../en.json'
import fr from '../fr.json'
import hu from '../hu.json'
import ru from '../ru.json'
import th from '../th.json'

// en.json is the reference catalog (see the comment in i18n.js). The other
// locales are edited on Weblate, and a language is often only partly translated
// there, so a key that is missing or blank passes: it falls back to English.
// What does not pass is a translation that would break at runtime — a key en.json
// no longer has, or a placeholder that does not match the English one.
const OTHERS = { fr, de, th, ru, hu }

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

describe('locale catalogs', () => {
  it('en.json is a complete catalog of non-empty strings', () => {
    expect(Object.keys(en).length).toBeGreaterThan(0)
    for (const [key, value] of Object.entries(en)) {
      expect(typeof value, `en.json["${key}"]`).toBe('string')
      expect(value, `en.json["${key}"]`).not.toBe('')
    }
  })

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
