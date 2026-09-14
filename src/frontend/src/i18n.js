import { createI18n } from 'vue-i18n'

import de from './locales/de.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import hu from './locales/hu.json'
import ru from './locales/ru.json'
import th from './locales/th.json'

// The catalogs are plain JSON so Weblate (see "Translating" in the README) can
// read and write them. en.json is the reference: it holds every key, and every
// other locale is translated from it and falls back to it. Keys are nested
// objects grouped by the component that owns the text, and components look
// them up by dotted path: t('settings.button.label'). Never a flat
// 'settings.button.label' key: Weblate's i18next v4 format reads a dot as
// nesting, so while it re-saves an existing flat key as it found it, any key
// it adds to a translation is written nested — leaving a partly translated
// file half one shape and half the other.
//
// A translation may be incomplete — a volunteer translates some strings of a
// language and not the rest — and src/locales/__tests__/keys.test.js allows
// that, since the missing strings fall back to English.

// The six languages the interface is translated into. Keys here double as
// SUPPORTED_LANGUAGES in stores/settings.js — that store owns the persisted
// choice and its default, this module only owns the catalogs.
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'th', 'ru', 'hu']

// Weblate can write a string nobody has translated yet as "" instead of leaving
// the key out, and vue-i18n renders "" as it is: a blank button. Dropping blanks,
// at every level of nesting, makes those keys fall back to English, the same as
// keys that are missing.
function withoutBlanks(catalog) {
  return Object.fromEntries(
    Object.entries(catalog)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, typeof value === 'object' ? withoutBlanks(value) : value]),
  )
}

export const i18n = createI18n({
  // Composition-only: every component here already uses <script setup> and
  // reads the store through the Composition API, so the legacy $t-via-options
  // path buys nothing and legacy: false is what makes useI18n() usable at all.
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: Object.fromEntries(
    Object.entries({ en, fr, de, th, ru, hu }).map(([locale, catalog]) => [
      locale,
      withoutBlanks(catalog),
    ]),
  ),
})

// A string that depends on a number, such as "{count} symbols", is stored
// the way Weblate's i18next v4 format stores plurals: one key per CLDR plural
// category the language has, e.g. 'sentence.symbolCount_one', '_few',
// '_many' and '_other' for Russian, but only '_other' for Thai. vue-i18n's own
// "a | b | c" plurals would reach translators as one raw string instead of one
// field per form. A form the active language has not translated yet uses its
// '_other' form. If the language has neither, the English form for the number
// is used. The English form has to be picked by English's own rules, since
// English has no '_few' to fall back to.
export function tPlural(key, count) {
  const { t, te, locale } = i18n.global
  // te() with a locale checks that locale alone. Without one it would also
  // find the English form and report the active language as having it.
  const has = (form) => te(form, locale.value)
  const form = (lang) => `${key}_${new Intl.PluralRules(lang).select(count)}`
  const own = form(locale.value)
  const chosen = has(own) ? own : has(`${key}_other`) ? `${key}_other` : form('en')
  return t(chosen, { count })
}
