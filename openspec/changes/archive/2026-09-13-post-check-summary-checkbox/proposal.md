## Why

The "Post-check summary" setting in the settings menu is a plain on/off
switch, but it's rendered as a two-button radiogroup (`Enabled` / `Disabled`)
— the same pattern used for settings that have more than two, mutually
exclusive named states (like the virtual keyboard override's `Auto`/`On`/
`Off`). A single boolean is better represented as one checkbox: one control,
one click to toggle, and the state is legible at a glance instead of reading
which of two buttons is highlighted.

## What Changes

- The "Post-check summary" group in `SettingsMenu.vue` renders as a single
  checkbox (`role="checkbox"`, `aria-checked`) instead of a two-option
  `radiogroup`.
- Clicking the checkbox (or its label) toggles `showCompletionStats` directly,
  rather than choosing between an `Enabled` and a `Disabled` button.
- The virtual keyboard override and on-screen keyboard settings are
  unaffected — they keep their existing radiogroup rendering, since each
  still needs (or, for on-screen keyboard, is understood as) a named choice
  rather than a bare toggle.
- e2e coverage (`fixtures.js`, `completion-stats.spec.js`) is updated to
  interact with the setting as a checkbox.

No behavior of the underlying setting changes: it still defaults to on,
still persists the same way, and still controls the same post-check summary
described in `practice-stats` and `typing-practice`. This is a control-widget
change within `SettingsMenu.vue`, not a change to any specified behavior.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None — no spec-level behavior changes. This change is scoped entirely to
which UI control renders an already-specified boolean setting; the setting's
default, persistence, and effect are unchanged. `skip_specs: true` is set in
`.openspec.yaml` accordingly.

## Impact

- `src/frontend/src/components/SettingsMenu.vue` — render the
  `showCompletionStats` group as a checkbox instead of via the shared
  radiogroup template.
- `src/frontend/e2e/fixtures.js` — `disableCompletionStats` clicks a
  checkbox instead of a `Disabled` radio button.
- `src/frontend/e2e/completion-stats.spec.js` — any assertions against this
  setting's radio options are updated to checkbox equivalents.
- No changes to `src/frontend/src/stores/settings.js` — `showCompletionStats`
  keeps its current type and persistence.
