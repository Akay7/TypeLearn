## 1. Day-bucketed counters (`lib/stats.js`)

- [x] 1.1 Add `src/frontend/src/lib/stats.js` exporting functions to read the
      single `localStorage` record (one JSON blob keyed by local
      `YYYY-MM-DD`), record a key press, record correct symbols, record a
      completed exercise, and compute `today` / `last7Days` totals; reads and
      writes wrapped in `try/catch` so unavailable storage falls back to an
      in-memory record instead of throwing
- [x] 1.2 In the same module, prune entries older than 7 days on every write,
      so the stored payload never grows past a week of days
- [x] 1.3 Add `src/frontend/src/lib/__tests__/stats.test.js` and verify: a
      fresh day starts at zero; recording increases the right counter only;
      `today` reflects only the current day; `last7Days` sums the current day
      plus the prior 6; a day older than 7 days is dropped after a write; a
      `localStorage` that throws on get/set does not crash a read or a record
      call

## 2. Stats store (`stores/stats.js`)

- [x] 2.1 Add `src/frontend/src/stores/stats.js`, a Pinia store wrapping
      `lib/stats.js` and exposing `recordKeyPress(delta)`,
      `recordCorrectSymbols(n)`, `recordExerciseCompleted()`, and reactive
      `today` / `last7Days` computed totals (`symbolsCorrect`, `keysPressed`,
      `exercisesCompleted` each)
- [x] 2.2 Add `src/frontend/src/stores/__tests__/stats.test.js` and verify:
      each record function updates the corresponding `today` and `last7Days`
      totals; a store created fresh reads existing `localStorage` data back
      correctly (mock `lib/stats.js` or seed `localStorage` directly,
      matching the pattern in `stores/__tests__/settings.test.js`)

## 3. New setting

- [x] 3.1 Add `showCompletionStats` (boolean, default `true`) to
      `src/frontend/src/stores/settings.js`, persisted to `localStorage` the
      same fail-soft way as the existing two settings
- [x] 3.2 Extend `src/frontend/src/stores/__tests__/settings.test.js`:
      defaults to `true`; a persisted value is read back by a fresh store
      instance; a `localStorage` that throws on get/set does not crash a
      read or a write; independent of the two existing settings
- [x] 3.3 Add a third group for `showCompletionStats` to `SettingsMenu.vue`'s
      `GROUPS` array, following the same shape as the existing two — labeled
      `Enabled`/`Disabled` rather than reusing `Show`/`Hide` (already the
      on-screen keyboard group's labels) or `On`/`Off` (already the virtual
      keyboard override group's), since `option(page, label)` in the e2e
      suite finds a radio by its accessible name alone and a repeated label
      across groups would make that ambiguous

## 4. Play/Pause on the audio control

- [x] 4.1 In `AudioPlayer.vue`, add a `playing` ref kept in sync with the
      `<audio>` element's own `play`, `pause`, and `ended` events (not only
      with this component's own calls to `.play()`/`.pause()`), and render
      the control's label as `▶ Play` / `⏸ Pause` based on it
- [x] 4.2 Change the control's click handler to branch on `playing`: if
      playing, call `audio.pause()`; if not, reset `currentTime` to 0 only
      when the clip has already ended (`audio.ended`), then call `.play()`
      — otherwise call `.play()` as-is so a paused-partway clip resumes
      instead of restarting
- [x] 4.3 In `e2e/audio.spec.js`, narrow the existing "replaying restarts
      from the beginning" test to the one case that still restarts: activate
      Play only after the clip has fired `ended` (e.g. seek near the end, or
      wait out its short duration) and assert `currentTime` resets near 0.
      This project has no precedent for mounting a `.vue` file in a Vitest
      unit test — component behavior is covered end to end in `e2e/` instead
      (see design.md) — so this and the next task extend that suite rather
      than adding a new unit-test file or dependency
- [x] 4.4 Add new cases to `e2e/audio.spec.js` verifying: the control reads
      "⏸ Pause" while the clip is playing (autoplay on load, and after a
      manual Play) and back to "▶ Play" once stopped; clicking Pause
      mid-playback stops the clip and leaves `currentTime` where it was;
      clicking Play again resumes from that `currentTime` instead of
      restarting
      (run against a system Chromium — see 10.3 — and passing)

## 5. Recording keystrokes and completions

- [x] 5.1 In `stores/exercise.js`'s existing `watch(typed, ...)`, before or
      alongside the existing reset-and-check logic: call
      `statsStore.recordKeyPress` with the magnitude of the length delta
      between the old and new value, and for each newly-appended character
      compare it against `current.value.sentence` at that position
      (character-by-character, the same comparison `nextExpected` in
      `lib/checking.js` already performs) to call
      `statsStore.recordCorrectSymbols` with the count of matches
- [x] 5.2 In `check()`, call `statsStore.recordExerciseCompleted()` when the
      answer is correct, alongside the existing `result.value = 'correct'`
- [x] 5.3 Add unit tests in `stores/__tests__/exercise.test.js` (or extend
      the existing test file for this store, if present — check first)
      verifying: typing one correct character records one key press and one
      correct symbol; typing one wrong character then backspacing it records
      two key presses and zero correct symbols; a correct check records one
      completed exercise; re-confirming an already-correct answer (pressing
      Check again during the pre-advance delay, with the setting off) does
      not count a second completion — caught during the spec walkthrough in
      Group 10, guarded in `check()` with a `wasAlreadyCorrect` check

## 6. Gate automatic advance on the new setting

- [x] 6.1 In `check()`, only schedule `advanceTimer` (the existing
      `setTimeout(next, ADVANCE_DELAY_MS)`) when
      `settingsStore.showCompletionStats` is `false`; when it is `true`, set
      `result.value = 'correct'` as today but do not schedule an advance
- [x] 6.2 Add/extend a test in `stores/__tests__/exercise.test.js` verifying:
      with the setting off, a correct check still auto-advances after the
      existing delay (regression check); with the setting on, a correct
      check does not schedule an advance and `next()` must be called
      explicitly

## 7. Completion summary, overlaying the answer field

- [x] 7.1 Add `src/frontend/src/components/CompletionStats.vue`: renders
      the overlay content for `AnswerInput.vue`'s answer-row and feedback
      row — an `<AudioPlayer :key="store.current.id"
      :src="store.current.audioUrl">` (Play/Pause-aware per Group 4),
      today's `symbolsCorrect` / `keysPressed` / `exercisesCompleted` from
      `useStatsStore()` as one compact inline line next to it, a "Next
      exercise →" button that calls `store.next()`, and the last 7 days'
      same three counts on a second line at the existing fixed `h-8` height
- [x] 7.2 In `AnswerInput.vue`: wrap the existing answer-row + feedback row
      in a `position: relative` container; when `store.result === 'correct'
      && settings.showCompletionStats`, add `invisible` to that wrapper
      (keeping it mounted, so it keeps reserving its real height — see
      design.md, "Where the summary lives", for why a straight `v-if`/`v-else`
      swap shifts the layout) and render `<CompletionStats>` in a sibling
      `position: absolute; inset: 0` layer over it; otherwise render the
      field and verdict exactly as today
- [x] 7.3 Since the field now stays mounted across exercises instead of
      remounting, its original mount-time `field.value?.focus()` no longer
      fires for a new exercise (or when the field becomes visible again
      after the summary): add a `watch` on `store.current?.id` that refocuses
      it, deferred one `nextTick` so it runs after Vue has actually removed
      `invisible` from the DOM — focusing a still-hidden element is a silent
      no-op

## 8. e2e coverage for the new summary (`e2e/completion-stats.spec.js`)

- [x] 8.1 Add a `disableCompletionStats(page)` helper to `e2e/fixtures.js`
      (opens Settings, clicks the `Disabled` option — mirrors
      `chooseVirtualKeyboard` in `virtual-keyboard.spec.js`), for the tests
      elsewhere in the suite that need the old default back
- [x] 8.2 Add `src/frontend/e2e/completion-stats.spec.js` and cover: a
      correct check with the setting on (default) replaces the input field
      and Check button with a Play control, an inline "Today" line, and a
      "Next exercise →" button, and replaces the feedback line with a "Last
      7 days" line; the sentence, hint row, and on-screen keyboard do not
      move (compare bounding boxes before/after, the same way
      `practice.spec.js`'s "a verdict does not move the page" suite does);
      the completed clip autoplays and the control reads Pause while it
      does; clicking "Next exercise" (or pressing Enter) advances to a
      fresh, empty answer row and restores the input field
- [x] 8.3 In the same file, cover: with the on-screen keyboard hidden
      (`Hide` in its own settings group) the keyboard stays hidden and the
      summary is unaffected by that setting; with completion-stats set to
      `Disabled`, a correct check shows the plain "✓ Correct" verdict and
      auto-advances exactly as before this change, with no summary
- [x] 8.4 Cover the counters themselves end to end: type one exercise
      correctly and assert the summary's "Today" line shows 1 completed
      exercise and a plausible correct-symbol/key-press count (exact
      numbers depend on catalog content typed via `clickThrough`, so assert
      the counts are consistent with the characters typed rather than
      hardcoding them)

## 9. Update the existing e2e suite for the new default

`showCompletionStats` defaults to `true`, so every existing Playwright test
that checks a correct answer now hits the summary instead of the plain
verdict + auto-advance it was written against (see design.md, "Scoping the
pre-existing... guarantee"). Fix each in place using the
`disableCompletionStats` helper from 8.1 where the test is genuinely about
something else, or updating the assertion where it's specifically about the
checked-and-advanced behavior itself.

- [x] 9.1 `e2e/practice.spec.js`, `describe('the answer checks itself')`:
      the one test asserting `getByText('✓ Correct')` visible (not the `✗
      Incorrect` ones, which are unaffected) calls `disableCompletionStats`
      first
- [x] 9.2 `e2e/practice.spec.js`, `describe('a verdict does not move the
      page')`: split `'the input and the keyboard hold their positions
      across a check'` — the incorrect-answer half is unchanged; the
      correct-answer half either calls `disableCompletionStats` first (to
      keep asserting the field itself doesn't move) or is rewritten to
      assert the sentence/hint/keyboard positions only, per the amended
      spec requirement — pick whichever keeps the test's original intent
      clearest
- [x] 9.3 `e2e/practice.spec.js`, `describe('the loop continues')`: all
      three tests call `disableCompletionStats` first, since they are
      specifically about the auto-advance loop this setting now gates
- [x] 9.4 `e2e/practice.spec.js`, `describe('the keyboard is one board')`:
      `'a character Kedmanee lacks is reached by switching layout'` calls
      `disableCompletionStats` first (it only uses `✓ Correct` as an
      end-of-test confirmation, unrelated to what it's testing)
- [x] 9.5 `e2e/audio.spec.js`: `'the previous clip does not run under the
      next exercise'` calls `disableCompletionStats` first, since it depends
      on the automatic advance carrying the exercise away while the clip is
      still running
- [x] 9.6 `e2e/virtual-keyboard.spec.js`: `'Hide removes the board; a
      physical keyboard still works'` calls `disableCompletionStats` first
      (it only uses `✓ Correct` as an end-of-test confirmation)

## 10. Spec and regression check

- [x] 10.1 Run the frontend test suite (`npm test` in `src/frontend/`) and
      verify all tests pass, including the new `lib/stats`, `stores/stats`,
      and updated `stores/settings`/`stores/exercise` tests
      (171/171 pass; `npm run build` also verified clean)
- [x] 10.2 Walk each scenario in
      `openspec/changes/post-exercise-stats/specs/practice-stats/spec.md`
      and the modified scenarios in
      `openspec/changes/post-exercise-stats/specs/typing-practice/spec.md`
      against the running app (completion-stats on and off, on-screen
      keyboard shown and hidden, play/pause/resume on both the main and
      summary audio controls) and confirm each holds
      (done as a code-level desk check, not a live browser walkthrough —
      this sandbox has no browser available; this pass is what found and
      fixed the answer-row height mismatch now described in design.md,
      "Where the summary lives", and the double-counted re-confirmed check
      in task 5.3. A real click-through in a normal dev environment is
      still worth doing before merging)
- [x] 10.3 Run the full e2e suite (`npm run test:e2e` in `src/frontend/`)
      and confirm everything passes, including Groups 8 and 9 above
      (Playwright's own browser download is still blocked by this sandbox's
      lack of network, but a system Chromium turned out to be installed —
      `playwright.config.js` gained an opt-in `PLAYWRIGHT_CHROMIUM_PATH` env
      var, unset by default, so the pod and a developer's machine are
      unaffected. Run twice for stability: 60/60 pass both times. This run
      is what caught three real bugs the code-level desk check in 10.2
      missed — none in the feature code itself, all in the new tests: an
      ambiguous `getByText('Today')` also matching the summary table's own
      `sr-only` caption; `/characters$/` anchored against a hint paragraph
      whose text actually ends in a Vue-whitespace-condensing trailing
      space, not the literal word (`OnScreenKeyboard.vue` already documents
      this exact gotcha for its own labels); and `responsive-keyboard.spec.js`
      — missed by Group 9's sweep — asserting the plain "✓ Correct" verdict
      that the now-default-on summary replaces)
