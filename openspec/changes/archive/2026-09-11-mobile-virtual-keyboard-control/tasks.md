## 1. Device classification

- [x] 1.1 Add `src/frontend/src/lib/device.js` exporting a reactive
      `isPhone` (or equivalent composable) backed by `matchMedia` queries for
      `(max-width: 640px)` and `(hover: none) and (pointer: coarse)`, both
      required for a phone classification
- [x] 1.2 Add `src/frontend/src/lib/__tests__/device.test.js` mocking
      `window.matchMedia` and verify: both conditions true → phone; either
      false → not phone; a change event on the media query list updates the
      reactive value

## 2. Settings store

- [x] 2.1 Add `src/frontend/src/stores/settings.js`, a Pinia store holding
      `virtualKeyboardOverride` (`'auto' | 'on' | 'off'`, default `'auto'`)
      and a computed `virtualKeyboardEnabled` that resolves to the override
      when set, otherwise `!isPhone` from `lib/device.js`
- [x] 2.2 Persist `virtualKeyboardOverride` to `localStorage` on change and
      hydrate it from `localStorage` on store creation, with reads/writes
      wrapped so a failure (e.g. storage disabled) falls back to `'auto'`
      in memory instead of throwing
- [x] 2.3 Add `src/frontend/src/stores/__tests__/settings.test.js` and
      verify: default is `'auto'`; setting `'on'`/`'off'` updates
      `virtualKeyboardEnabled` regardless of a mocked `isPhone`; a persisted
      value is read back on a fresh store instance; a `localStorage` that
      throws on get/set does not crash store creation or a setting change

## 3. Suppress the virtual keyboard on the answer field

- [x] 3.1 In `AnswerInput.vue`, bind `:inputmode` on the field to
      `store.virtualKeyboardEnabled ? 'text' : 'none'` (reading the new
      settings store), and verify existing `v-model`, `@keyup.enter`, and
      focus-on-mount behavior in `AnswerInput.vue` are unchanged (existing
      component tests, if any, continue to pass; otherwise a quick manual
      check that typing and Enter-to-check still work)
- [x] 3.2 Verify manually in a touch-emulated mobile viewport (browser
      devtools device toolbar, or a real phone) that focusing the field no
      longer raises the OS virtual keyboard when classified as a phone with
      no override set

## 4. Override control

- [x] 4.1 ~~Add a control to `OnScreenKeyboard.vue`'s bottom bar~~ — superseded
      by task 6.2: e2e verification at phone width found the bottom-bar pill
      unreachable (overlapped by other elements), so the control lives in a
      new header settings menu instead (see design.md, "Settings control
      placement"). `settingsStore.virtualKeyboardOverride` and its three
      states (`auto`/`on`/`off`) are unchanged.
- [x] 4.2 Verify by keyboard/mouse interaction (Playwright, phone-width and
      desktop-width viewports) that choosing an option changes
      `virtualKeyboardEnabled` and that the change is reflected in
      `AnswerInput.vue`'s `inputmode` without a reload
      (`e2e/virtual-keyboard.spec.js`)

## 5. Spec and regression check

- [x] 5.1 Run the frontend test suite (`npm test` in `src/frontend/`) and
      verify all tests pass, including the new device/settings tests
- [x] 5.2 Walk each scenario in
      `openspec/changes/mobile-virtual-keyboard-control/specs/typing-practice/spec.md`
      against the running app (phone-emulated viewport, tablet-emulated
      viewport, and override on/off/auto) and confirm each holds — covered by
      the full e2e suite (44/44 passing) run in the Tilt dev pod, including
      `e2e/virtual-keyboard.spec.js` and `e2e/responsive-keyboard.spec.js`

## 6. The on-screen keyboard board fits a phone width

- [x] 6.1 In `OnScreenKeyboard.vue`, make the panel `w-full
      max-w-[var(--board)]` (was a fixed `w-[var(--board)]`) and wrap the
      rows + space bar in an `overflow-x-auto` container at their full,
      unshrunk width, so keys never shrink below their current tappable size
      — the panel adapts to the viewport, its contents scroll sideways below
      `--board`
- [x] 6.2 Move the virtual-keyboard override control out of
      `OnScreenKeyboard.vue`'s bottom bar into a new `SettingsMenu.vue`
      (a gear button in `App.vue`'s header, opening a small popover),
      positioned so it adds no height to the header row on any viewport
- [x] 6.3 Add `e2e/responsive-keyboard.spec.js` and verify at a phone-sized,
      touch-primary viewport: the page itself never scrolls sideways, and
      the longest catalog sentence can still be typed key-by-key through the
      on-screen keyboard, off-screen keys included
- [x] 6.4 Update `e2e/practice.spec.js`'s DOM-depth locator for the keyboard
      panel (one extra wrapper level from the new scroll container) and
      re-verify the existing "fits on one screen" / "field lines up with the
      keys" desktop-viewport assertions still pass

## 7. Learner can hide the on-screen keyboard

- [x] 7.1 Add `onScreenKeyboardVisible` (boolean, default `true`) to
      `stores/settings.js`, persisted to `localStorage` the same
      fail-soft way as `virtualKeyboardOverride`
- [x] 7.2 Add its test coverage to `stores/__tests__/settings.test.js`:
      defaults to shown, is read back by a fresh store instance, a broken
      `localStorage` doesn't crash a read or a write, and it is independent
      of `virtualKeyboardOverride`
- [x] 7.3 In `SentenceView.vue`, `v-if` `<OnScreenKeyboard>` on
      `settingsStore.onScreenKeyboardVisible`
- [x] 7.4 Add a second option group to `SettingsMenu.vue` ("On-screen
      keyboard": Show / Hide) reading and writing the new setting
- [x] 7.5 Add e2e coverage (`e2e/virtual-keyboard.spec.js`) that hiding
      removes the board while typing and checking still work (a physical
      keyboard into the plain `<input>`), and that showing it again brings
      it back
