## Why

A learner checking an exercise gets a verdict and, if correct, is bounced
straight into the next sentence 900ms later — nothing tells them how much
they've actually done today, and the correct sentence's audio is never heard
again once it's been typed. Showing a running count of today's (and the last
week's) practice gives the learner a sense of progress the single-exercise
loop can't, and replaying the sentence right after a correct check reinforces
the sound-to-text mapping the app exists to teach. Neither needs a backend or
a database: it's derived entirely from what happens in the browser.

## What Changes

- Track, per calendar day, in browser storage only (no backend, no new DB
  entities): symbols typed correctly, total key presses (a wrong key
  followed by its correction counts as two), and exercises completed.
  Tracking runs unconditionally, independent of whether it is ever shown.
- After a correct check, show today's and the last 7 days' totals for those
  three counters, and replay the just-completed sentence's audio — in place
  of the now-answered input field and Check button, without moving the
  sentence, the hint row, or the keyboard (the existing "a verdict does not
  move the page" guarantee is narrowed accordingly: it still covers
  everything except the field itself, which is what the summary replaces).
- While that panel is showing, advancing to the next exercise waits for the
  learner (a "Next exercise" control, or Enter) instead of firing
  automatically — replacing the fixed 900ms auto-advance for this case.
- Add a settings toggle to turn this display off. With it off, checking a
  correct answer behaves exactly as it does today: the verdict shows and the
  next exercise loads automatically, with no panel and no replay.
- Give the existing play control a Pause state: while a clip is playing (the
  automatic first play, or a later replay), the control reads as Pause and
  stops playback in place rather than restarting it; playing again resumes
  from where it paused, or from the start once the clip has actually
  finished.

## Capabilities

### New Capabilities
- `practice-stats`: tracking correct-symbol, key-press, and
  exercise-completion counts per day in browser storage; showing today's and
  the last 7 days' totals after a correct check; replaying the completed
  sentence's audio alongside them; and the setting that turns this off.

### Modified Capabilities
- `typing-practice`: the "Correct answer" scenario and the "Advancing
  through exercises" scenario become conditional on the new setting —
  auto-advance stays the behavior when the stats display is off, and waits
  for the learner to continue when it is on. The "Audio playback"
  requirement gains a Pause state for the play control. "A verdict does not
  move the page" is narrowed: it no longer promises the answer field itself
  stays in place once a correct check replaces it with the summary — only
  that everything around it (sentence, hint, keyboard) still does.

## Impact

- Affected code (frontend only):
  - New `src/frontend/src/lib/stats.js` (day-bucketed counters, read/write
    against `localStorage`, 7-day retention) and its test file.
  - New `src/frontend/src/stores/stats.js` (Pinia store wrapping `lib/stats.js`,
    exposing today/last-7-days totals and record functions) and its test file.
  - New `src/frontend/src/components/CompletionStats.vue` (the panel: counts,
    audio replay, "Next exercise" control).
  - `src/frontend/src/stores/exercise.js`: records a key press and, when it
    matches the expected character, a correct symbol on every change to the
    typed answer; records a completed exercise on a correct check; only
    schedules the automatic advance when the new setting is off.
  - `src/frontend/src/stores/settings.js`: new `showCompletionStats` setting
    (boolean, default on), persisted the same way as the existing two.
  - `src/frontend/src/components/SettingsMenu.vue`: a third
    Enabled/Disabled group for the new setting (distinct labels from the
    existing two groups' Show/Hide and Auto/On/Off, so the e2e suite's
    label-based lookups stay unambiguous).
  - `src/frontend/src/components/AudioPlayer.vue`: tracks playing state and
    toggles the control between Play and Pause.
  - `openspec/specs/typing-practice/spec.md`: delta for the scenarios above.
  - `src/frontend/e2e/completion-stats.spec.js` (new) and small updates to
    `e2e/practice.spec.js`, `e2e/audio.spec.js`, and
    `e2e/virtual-keyboard.spec.js` — the new setting defaults to on, so
    several existing tests that check a correct answer need to either
    disable it first or assert the new default behavior instead (see
    design.md and tasks.md).
- No backend, API, schema, or dependency changes.
