## Why

On a phone, focusing the answer field pops up the OS's virtual keyboard on top
of the app's own on-screen Kedmanee keyboard — two keyboards fighting for the
same screen, with the OS one usually covering the on-screen one entirely. A
phone has no physical keyboard, so the virtual keyboard adds nothing the
on-screen board doesn't already provide, and should stay down. A tablet is a
harder case: some are typed on with a connected physical keyboard, but many
are not, and the app cannot reliably detect a connected one — so it must not
assume a tablet is keyboard-less the way a phone can be assumed to be. Because
that assumption can be wrong in both directions, the learner needs a manual
override.

## What Changes

- Suppress the OS virtual keyboard on the answer field when the device is
  classified as a phone (small viewport, touch-primary), since it has no
  physical keyboard and the on-screen board already covers typing.
- Leave the virtual keyboard available by default on tablets and larger
  touch devices, since a physical keyboard cannot be reliably detected and
  many tablets are typed on without one.
- Add a settings menu (a gear icon in the header) where the learner can force
  the virtual keyboard on or off, overriding the device-based default — for a
  tablet with a physical keyboard attached (force off) or a phone-sized
  device misclassified as a tablet, or vice versa (force either way). The
  choice persists across visits.
- Fix the on-screen keyboard so it no longer forces the page wider than a
  phone screen: it scrolls sideways below its full width instead of shrinking
  keys past a tappable size. This surfaced during verification — the settings
  control itself was unreachable on a real phone width until this was fixed.
- Add a second, independent setting in the same menu letting the learner hide
  the app's own on-screen keyboard entirely, for anyone typing on a physical
  keyboard they already know.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `typing-practice`: adds device-aware control over whether the OS virtual
  keyboard is allowed to appear when the answer field is focused, a
  learner-facing setting that overrides the device default, a requirement
  that the on-screen keyboard stays usable (not shrunk below a tappable size)
  on any viewport, and a setting to hide the on-screen keyboard entirely.

## Impact

- Affected code: `src/frontend/src/components/AnswerInput.vue` (the answer
  field's `inputmode`), a new `SettingsMenu.vue` component (header gear
  button + popover) replacing the answer field's earlier in-keyboard control,
  `OnScreenKeyboard.vue` (the board's panel now scrolls instead of a fixed
  width) and `SentenceView.vue` (conditionally renders the board), a settings
  Pinia store backed by `localStorage`, and a small device-classification
  helper under `src/frontend/src/lib/`.
- No backend, API, or data changes.
- No new dependencies expected — classification uses standard `matchMedia`
  queries already available in the target browsers.
