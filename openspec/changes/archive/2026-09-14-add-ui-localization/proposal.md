## Why

TypeLearn's interface — settings, hints, status messages, button labels — is
English-only, regardless of the learner's own language. A learner who does not
read English fluently faces a language barrier before they even reach the Thai
they came to practice. The app already frames itself as language-agnostic (Thai
is "the first dataset"); its own chrome should not assume English is universal
either.

## What Changes

- Add a **Language** selector to the Settings menu (gear icon), alongside the
  existing virtual-keyboard and on-screen-keyboard controls.
- Support six interface languages: **English, French, German, Thai, Russian,
  Hungarian**.
- Translate the interface's own chrome — settings menu labels and
  descriptions, loading/error/empty states, the character-count hint, the
  Check button, the correct/incorrect verdicts, the on-screen keyboard's
  legend and finger names, and control `aria-label`s. This does **not**
  translate exercise content: the Thai target sentence and audio stay Thai no
  matter which interface language is selected, since that content is the
  thing being learned, not the chrome around it.
- Default the interface language to the browser's own language when it is one
  of the six supported, otherwise English; let the learner override that
  choice, and persist the override the same way other settings persist today
  (`localStorage`, best-effort).
- Introduce an i18n library (`vue-i18n`) and one message catalog per
  supported language.

## Capabilities

### New Capabilities
- `interface-localization`: the interface language setting, its default and
  persistence, and the requirement that the app's own chrome (as opposed to
  exercise content) render in the selected language.

### Modified Capabilities
_None._ The existing `typing-practice` spec's "Latin text is unaffected" font
scenario is about typeface choice (looped Thai face vs. system sans-serif),
which holds regardless of which language that Latin (or Cyrillic) text is in —
no requirement there changes. The Settings menu's existing controls
(virtual-keyboard override, on-screen-keyboard visibility) are not currently
described by any spec; this change does not alter their behavior, only adds a
new control alongside them and translates all three controls' labels.

## Impact

- **Frontend only** (`src/frontend/`): no backend, API, or corpus changes.
- New dependency: `vue-i18n`.
- Touches every component that renders interface text: `SettingsMenu.vue`,
  `SentenceView.vue`, `AnswerInput.vue`, `AudioPlayer.vue`,
  `OnScreenKeyboard.vue`, `App.vue`.
- New `stores/settings.js` field (`interfaceLanguage`) and a new
  `localStorage` key, following the existing pattern for the two settings
  already there.
- New message-catalog files, one per supported language.
