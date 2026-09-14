## Context

See proposal.md - Why. Today every string the frontend renders is a literal
in the `.vue` template: `SettingsMenu.vue` (menu titles, option labels and
descriptions, the "Settings" aria-label), `SentenceView.vue`
(loading/error/empty states, the character-count hint), `AnswerInput.vue`
(placeholder, Check button, verdicts), `AudioPlayer.vue` (aria-label), and
`OnScreenKeyboard.vue` (the finger legend). There is no i18n library in the
frontend today (`src/frontend/package.json` has none), and the two existing
settings (`virtualKeyboardOverride`, `onScreenKeyboardVisible`) each follow
the same small pattern in `stores/settings.js`: a `localStorage` key, a
best-effort load/save pair, and a `ref` wired to `watch(..., { flush: 'sync'
})`.

## Goals / Non-Goals

**Goals:**
- Translate the interface chrome into English, French, German, Thai,
  Russian, and Hungarian, switchable from the Settings menu.
- Reuse the existing settings-persistence pattern rather than inventing a new
  one.
- Keep exercise content (Thai sentences and audio) entirely outside this
  change — only the app's own chrome is translated.

**Non-Goals:**
- Translating exercise content or supporting non-Thai exercise corpora — out
  of scope; the corpus is Thai regardless of interface language.
- A translation-management pipeline (e.g. pulling from a TMS) — six
  hand-maintained catalogs are small enough to review as plain diffs.
- Localizing number/date formatting — the interface has none today (the only
  dynamic value is a character count, which reads the same in all six
  languages: as a number, no thousands separators at these string lengths).
- RTL layout — none of the six languages are RTL.

## Decisions

### Use vue-i18n
Vue's own ecosystem's standard choice; a hand-rolled `computed(() =>
messages[locale.value][key])` store would need to reimplement pluralization,
interpolation, and Composition API ergonomics (`useI18n()`, `$t` in
templates) that vue-i18n already provides, for no benefit given the app has
no other i18n requirement pulling toward a lighter custom solution.
**Alternative considered**: a bespoke `translations.js` map — rejected, more
code to maintain for less capability.

### One flat JSON catalog per language, keyed by short message IDs
`src/frontend/src/locales/{en,fr,de,th,ru,hu}.json`, each a flat object
(`{ "settings.title": "Settings", "sentence.loading": "Loading an
exercise…", ... }`) grouped by dot-prefixed component area. Flat with
namespacing prefixes rather than nested objects: easier to grep and diff
across six files, and vue-i18n accepts either. JSON rather than JS modules
so the catalogs can be translated on Hosted Weblate, which reads and writes
the files in the repository ("i18next JSON file v4" format, `en.json` as the
monolingual base). **Alternatives considered**: one JSON file per language
per component — rejected as more files than six languages' worth of strings
warrant; `.js` modules — rejected once the catalogs moved to Weblate, which
cannot parse them.

### Count-dependent strings use CLDR plural keys, not vue-i18n's pipe syntax
Languages differ in how many plural forms they have: Russian has three for
whole numbers ("1 символ", "2 символа", "5 символов"), and Thai has none. Such
strings are stored as one key per CLDR category (`sentence.symbolCount_one`,
`_few`, `_many`, `_other`), the layout Weblate's i18next v4 format shows as
one plural field per form. A small `tPlural(key, count)` helper in `i18n.js`
picks the key with `Intl.PluralRules` for the active locale. If that form is
not translated, it uses the locale's `_other` form, then English.
**Alternative considered**: vue-i18n's `"a | b | c"` plurals with custom
`pluralRules`. Rejected because Weblate would show translators one raw string
full of pipes, with no hint of which form goes where.

### Partial translations fall back to English
Volunteers on Weblate often translate part of a language. A key a locale
lacks, or holds as an empty string (how Weblate can write an untranslated
string), falls back to `en.json`: `i18n.js` drops empty strings before handing
the catalogs to vue-i18n, since vue-i18n would otherwise render them blank.
The catalog test therefore requires `en.json` to be complete, and for the
other locales rejects only what breaks at runtime: keys `en.json` lacks, and
`{placeholder}` names that differ from the English string.

### Language names are hardcoded per-language, not translated
The Language control lists each option in its own language ("Français",
"Русский", "ไทย") rather than translating "French"/"Russian"/"Thai" into
whichever language is currently active. This is the universal convention
(every OS and browser language picker does this) and avoids the pitfall of a
name that reads as "unhelpful" to a learner who does not yet read the active
language at all — the whole point of the picker.

### Locale detection reads `navigator.language`, matched by base subtag
`navigator.language` (e.g. `fr-CA`) is matched against the six supported
codes by its base subtag (`fr`) rather than requiring an exact match, since
none of the six catalogs are regional variants. Falls back to `'en'` when
the subtag isn't one of the six.

### Settings-store integration follows the existing two settings verbatim
A third field, `interfaceLanguage`, added to `stores/settings.js` with its
own `localStorage` key (`typelearn.interfaceLanguage`), its own
load/save pair following the existing try/catch-and-fall-back-silently
shape, and a `watch(..., { flush: 'sync' })`. The store sets vue-i18n's
`locale` ref as a side effect of `interfaceLanguage` changing (via the same
watcher, or a computed passed to `createI18n`), so the rest of the app keeps
reading one store for every setting rather than importing vue-i18n's
composable directly in every component. **Alternative considered**: let
components call `useI18n()` and read `locale` directly, bypassing the
settings store — rejected, since it would split "where does the current
language live" across two places (the store for persistence, vue-i18n for
runtime) instead of one.

### `SettingsMenu.vue`'s `GROUPS` data structure gains a language group built from `$t`
The `GROUPS` array's `title`/`label`/`description` strings become `$t(...)`
calls (or a computed that re-derives `GROUPS` when `locale` changes, since
vue-i18n messages are read reactively but a plain module-level constant
built once from them would not update). The Language control itself does not
fit the existing radiogroup-of-named-values shape as a third `GROUPS` entry
as cleanly as a `<select>` would — it is added as its own block using a
native `<select>` bound to `settings.interfaceLanguage`, consistent with the
proposal's "selectbox" framing, rather than forcing it through the
radio-button rendering built for two or three short options.

## Risks / Trade-offs

- **Catalogs can drift out of sync as new strings are added**
  → a new key only has to land in `en.json`; Weblate then offers it to
  translators, and until they translate it every other locale shows English.
  A test rejects keys in another locale that `en.json` no longer has, and
  placeholders that differ from the English string.
- **Translation quality**: these catalogs are written without native-speaker
  review in this change. → Acceptable for a first pass; flagged in
  proposal.md as translatable content that can be refined later without a
  spec or architecture change.
- **Bundle size**: six catalogs plus vue-i18n add to the JS bundle. → Small
  in absolute terms (a few hundred short strings × 6); not worth lazy-loading
  per-locale chunks at this scale.

## Migration Plan
No data migration. A learner with no stored `interfaceLanguage` gets the
browser-language default the first time this ships; existing
`localStorage` keys for the other two settings are untouched. Rollback is a
plain revert — no persisted state this change introduces is read by any
other feature.
