# Translating TypeLearn

For translators, see the [Translating](../README.md#translating) section of the README.
This page is for developers changing interface text.

The interface text lives in `src/frontend/src/locales/`, one JSON file per
language. `en.json` is the source: every other language is translated from it,
and any string a language has not translated yet shows in English.

Keys are nested objects grouped by component (`settings` → `button` → `label`)
and looked up by their dotted path, `t('settings.button.label')`. Don't write a
flat `"settings.button.label"` key: Weblate writes the keys it adds nested, so a
file would end up mixing both shapes. `keys.test.js` fails on dotted keys.

Translations are done on [Hosted Weblate](https://hosted.weblate.org/engage/typelearn/). You don't
need to open a pull request to translate. Weblate commits the changes and opens
the pull request for you. To change the English wording or add a string, edit
`en.json` in a normal pull request. Weblate picks the change up once it merges.

A string that depends on a number gets one key per plural form, named the i18next
v4 way: `symbolCount_one` and `symbolCount_other` inside `sentence` in
`en.json`. Render it with `tPlural(key, count)` from `src/frontend/src/i18n.js`,
not `t`. The helper picks the form the active language needs, so on Weblate each
language gets its own plural forms, such as `_few` and `_many` for Russian.

## Adding a language

A new JSON file alone does nothing. The app only loads the languages it lists. To
add one, open a pull request that, under `src/frontend/src/`:

1. adds `locales/<code>.json` as an empty `{}`, unless a translator already
   started the language on Weblate and its file exists,
2. in `i18n.js`, imports that file, adds it to the catalogs passed to
   `createI18n`, and adds the code to `SUPPORTED_LANGUAGES`,
3. adds the language's own name for itself (e.g. "Deutsch") to `LANGUAGES` in
   `components/SettingsMenu.vue`, in the same position as in
   `SUPPORTED_LANGUAGES`, and to the expected list in
   `components/__tests__/SettingsMenu.test.js`,
4. imports the file in `locales/__tests__/keys.test.js` and adds it to
   `CATALOGS`, so its keys and placeholders are checked too.

Once it merges, Weblate lists the language for translators.
