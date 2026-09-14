## 1. Dependency and i18n setup

- [x] 1.1 Add `vue-i18n` to `src/frontend/package.json` and verify `npm install` (or the project's package manager) succeeds with no peer-dependency warnings for Vue 3
- [x] 1.2 Create `src/frontend/src/locales/en.js` as the reference catalog, with one flat, dot-prefixed key per interface string currently hardcoded in `SettingsMenu.vue`, `SentenceView.vue`, `AnswerInput.vue`, `AudioPlayer.vue`, and `OnScreenKeyboard.vue`, and verify the file exports a plain object
- [x] 1.3 Create `src/frontend/src/i18n.js` calling `createI18n` with `legacy: false`, `en` as `fallbackLocale`, and the six locale catalogs registered as messages, and verify the app still builds with it wired into `main.js` (`app.use(i18n)`) even before other locales exist, by temporarily pointing every locale at the English catalog

## 2. Settings-store integration

- [x] 2.1 Add `interfaceLanguage` to `stores/settings.js` following the existing `virtualKeyboardOverride`/`onScreenKeyboardVisible` pattern: a `SUPPORTED_LANGUAGES` set (`en`, `fr`, `de`, `th`, `ru`, `hu`), a `typelearn.interfaceLanguage` `localStorage` key, and a best-effort load/save pair, and verify a unit test covering an unset key, a valid stored value, and an invalid/foreign stored value
- [x] 2.2 Implement the browser-language default: when no stored value exists, derive the initial `interfaceLanguage` from `navigator.language`'s base subtag if it is in `SUPPORTED_LANGUAGES`, else `'en'`, and verify a unit test covering a supported subtag (e.g. `fr-CA` → `fr`), an unsupported one, and a missing `navigator.language`
- [x] 2.3 Wire `interfaceLanguage` to vue-i18n's `locale` (e.g. via a `watch(interfaceLanguage, ..., { flush: 'sync' })` that sets the i18n instance's `locale.value`, mirroring the store's existing `flush: 'sync'` persistence watchers) and verify a unit/component test that changing `settings.interfaceLanguage` changes what `useI18n().locale.value` reads

## 3. Translate the interface chrome

- [x] 3.1 Replace the hardcoded strings in `SettingsMenu.vue` (`GROUPS` titles/labels/descriptions, the `Settings` aria-label) with `$t(...)`/`t(...)` calls against the keys from 1.2, and verify the menu still renders with English active and no key falls back to a raw key string
- [x] 3.2 Replace the hardcoded strings in `SentenceView.vue` (loading/error/empty states, the character-count hint) with translation calls, handling the character-count hint's interpolated number via vue-i18n's interpolation syntax, and verify each of the three states and the hint render correctly with English active
- [x] 3.3 Replace the hardcoded strings in `AnswerInput.vue` (placeholder, Check button, correct/incorrect verdicts) with translation calls, and verify with English active
- [x] 3.4 Replace the hardcoded aria-label in `AudioPlayer.vue` with a translation call, and verify with English active
- [x] 3.5 Replace the hardcoded strings in `OnScreenKeyboard.vue` (the finger legend's finger names, and any other on-screen text — not the layout's own keycap characters, which stay as the language being typed) with translation calls, and verify with English active
- [x] 3.6 Confirm no remaining component hardcodes interface text by grepping the touched files for the string literals removed in 3.1–3.5, and verify the grep returns nothing outside test files and the locale catalogs themselves

## 4. Language selector control

- [x] 4.1 Add a Language block to `SettingsMenu.vue` — a native `<select>` bound to `settings.interfaceLanguage`, listing all six languages by their own endonym (e.g. "Français", "Русский", "ไทย"), placed alongside the existing radiogroup controls, and verify it renders all six options and updates `settings.interfaceLanguage` on selection
- [x] 4.2 Verify selecting a language switches the rendered interface text immediately (no reload), by a component test that mounts a translated component, changes `settings.interfaceLanguage`, and asserts the rendered text changed

## 5. Translation catalogs for the remaining five languages

- [x] 5.1 Create `src/frontend/src/locales/{fr,de,th,ru,hu}.js`, each with exactly the same key set as `en.js`, and verify with a test (or small script) that asserts every locale file's keys match `en.js`'s keys exactly (no missing, no extra)
- [x] 5.2 Verify each locale renders without console warnings by mounting the app (or a representative component) once per locale in a test and asserting no vue-i18n "not found in messages" warning is emitted

## 6. Exercise-content isolation check

- [x] 6.1 Verify that changing `interfaceLanguage` never touches exercise data: a component/integration test that sets a non-English interface language, loads a Thai exercise, and asserts the rendered target sentence and `audioUrl` are unchanged from the English-interface case

## 7. Persistence and defaults

- [x] 7.1 Verify end-to-end (Playwright) that a chosen language persists across a reload, per the existing settings' persistence tests as a pattern to follow
- [x] 7.2 Verify end-to-end (Playwright, with the browser locale set) that a supported browser language is picked up as the default on first visit, and that an unsupported one falls back to English

## 8. Translation on Weblate

- [x] 8.1 Convert `src/frontend/src/locales/*.js` to flat `*.json` catalogs imported by `i18n.js`, and verify the unit suite still passes
- [x] 8.2 Drop empty strings from the catalogs in `i18n.js` so untranslated strings fall back to English, and relax the catalog test to allow missing/empty keys while rejecting keys `en.json` lacks and mismatched `{placeholder}` names
- [x] 8.3 Document the Hosted Weblate component settings (file mask, base file, format, check flags) and the steps to add a new language in the README
- [x] 8.5 Store `sentence.symbolCount` as CLDR plural keys (`_one`, `_few`, `_many`, `_other`) rendered through a `tPlural` helper, so the hint is grammatical in every language, and verify with a unit test covering Russian's one/few/many forms and a missing form falling back
- [ ] 8.4 Create the project and component on Hosted Weblate and apply for the Libre hosting plan (done by the maintainer in Weblate's UI)
