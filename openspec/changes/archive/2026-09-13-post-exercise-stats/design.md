## Context

`stores/exercise.js` owns the whole practice loop: `typed` is written to
directly by `AnswerInput.vue`'s `v-model` (physical keyboard) and by
`OnScreenKeyboard.vue` through `store.append(char)` / `store.backspace()`
(virtual keys) — both paths end up changing the same `typed` ref, which the
store already `watch`es to trigger automatic checking. `check()` sets
`result` and, on a correct answer, schedules `next()` after
`ADVANCE_DELAY_MS`. Nothing today records a keystroke, a correct character,
or a completion anywhere — see proposal.md for why that's worth doing.

The spec already commits the app to "a verdict does not move the page"
(`openspec/specs/typing-practice/spec.md`) — the input and keyboard must not
shift when a check resolves. The user's placement requirements sharpened
over the course of design: no modal/popup; nothing already on screen may
move; the summary should not compete for attention as a separate element
elsewhere on the page; and — settling it — the on-screen keyboard should be
left alone entirely (visible if the learner already has it on) and the
summary should take the place of the answer field itself, since that field
is what has nothing left to do once a correct answer has been typed into it.

`AnswerInput.vue` today renders two rows: the input field with the Check
button beside it, and beneath that a fixed-height (`h-8`) feedback row that
holds the plain "✓ Correct" / "✗ Incorrect" verdict. Both rows are already
sized by the same pill-button and text styling used throughout the app.

## Goals / Non-Goals

**Goals:**
- Track the three counters passively, in every session, regardless of the
  new setting's value.
- Show the summary and let the learner replay the sentence without moving
  the sentence, the on-screen keyboard, or anything above the answer field,
  without a modal/backdrop, and without adding a second visual element
  elsewhere on the page.
- Leave the on-screen keyboard exactly as it is — visible and interactive if
  the learner already has it on, untouched by this feature either way.
- Make "off" behave exactly like today: verdict, then automatic advance.

**Non-Goals:**
- A dedicated stats page, historical charts, or a breakdown by day beyond
  "today" and "last 7 days" — not asked for.
- Exact key-press accounting for exotic input paths (composition/IME
  candidate swaps, multi-character paste, select-and-retype). These are rare
  during dictation practice; the design counts the common case (one
  character appended or removed at a time) and accepts an approximate count
  otherwise (see Risks).
- Any server-side record of practice activity — explicitly browser-only per
  the proposal.

## Decisions

### Where the summary lives: it replaces the input row, not the keyboard
Three placements were tried and rejected before this one:
- **A modal/popup** — rejected outright by the user: it blocks the page and
  reads as an interruption rather than a between-exercises reward.
- **A panel fixed in the viewport's side gutter** — rejected by the user for
  putting new content in a place the learner isn't already looking, and for
  needing a wide-enough viewport to have a gutter to put it in at all (the
  project's own 1280×720 baseline leaves only ~136px of gutter once the
  app's actual 18px root font-size is accounted for — too tight to be
  workable without raising the effective minimum viewport for this feature
  alone).
- **Overlaying the on-screen keyboard's box** — rejected by the user in
  favor of leaving the keyboard alone entirely; the learner may want to keep
  looking at it (reviewing finger positions) between exercises, and hiding
  it added a dependency this design doesn't need.

Once an answer has been checked correct, the field it was typed into and the
Check button beside it have nothing left to do — that row, not the
keyboard, is what's idle. `AnswerInput.vue`'s answer-row (the input +
Check) and its feedback row below it are covered, for exactly as long as
the summary is showing, by:
- **A "Today" line**: a "▶ Play" button (`AudioPlayer.vue`, unchanged — same
  control and label the learner already saw once for this exercise), today's
  three counts (`symbolsCorrect`/`keysPressed`/`exercisesCompleted`) as a
  compact inline line, and a "Next exercise →" button.
- **A "Last 7 days" line**: the same three counts summed over the last 7
  days, in the same green the plain "✓ Correct" text already uses.

The first attempt at this had `CompletionStats.vue` *replace* the two rows
outright (`v-if`/`v-else`), reasoning that reusing the same pill-button
styling throughout the app would make the two states the same height without
any extra work. It doesn't: the input is `text-2xl` with `p-3` padding for
legibility while typing Thai, and the summary's controls are the app's usual
`text-base` pill buttons — a deliberately different, shorter scale, off by
roughly 10px once the app's actual 18px root font-size is factored in (see
Context). That 10px would show up as the whole column shifting under
`App.vue`'s `justify-center` depending on which state was showing — exactly
the movement this design exists to prevent, just relocated from the field's
own box (which the amended requirement above allows to change) to the
*surrounding* one (which it still may not).

The fix is the same reserved-space idiom the feedback row's own fixed `h-8`
already uses, one level up: `AnswerInput.vue`'s field-and-Check row and
feedback row stay mounted at all times, however tall they truly render —
`invisible` (not `v-if`) rather than removed once a correct check has
nothing left for them to do. `CompletionStats.vue` then renders
`position: absolute; inset: 0` over that same, still-reserved box
(`justify-between` between its two lines, so "Last 7 days" lands on the same
bottom edge the plain verdict occupies, whatever slack sits above it). No
pixel value is ever guessed: the box's real height comes from the field's
own rendered size, whatever that turns out to be, the same way it always
has.

This is deliberately not a modal: no backdrop, no focus trap, no
`role="dialog"`. It also touches nothing outside `AnswerInput.vue` — the
keyboard, wherever `SentenceView.vue` puts it, is completely unaffected.

### Scoping the pre-existing "a verdict does not move the page" guarantee
`typing-practice` already had a requirement, untouched by earlier drafts of
this design, that the input field occupies the *same position* through any
check — not just that its row's height stays fixed, but that the field
itself stays in place. Replacing that field with the summary keeps the row's
position and height fixed but not the field's identity, which is a real
narrowing of an existing guarantee, surfaced only once implementation
started reading that requirement's exact wording. Rather than quietly
violate it, the requirement is amended (see the `typing-practice` delta) to
state plainly that it covers the field only while it is still in play —
once a correct check replaces it with the summary, everything *around* the
field (sentence, hint, keyboard) still must not move, but the field's own
content changing is the point, not a violation.

This also means `showCompletionStats` defaulting to `true` changes the
*default* post-check experience for every learner, not just an opt-in
extra: out of the box, a correct check no longer shows a plain "✓ Correct"
and auto-advances — it shows the summary and waits. That default was
explicit in the original request and is kept, but it is a bigger behavioral
default change than "add an optional display" sounds like, and the existing
Playwright suite reflects the old default throughout (see Risks and Group 9
of tasks.md for the tests this touches).

### `AudioPlayer.vue`'s new behavior is verified in Playwright, not Vitest
The project has no precedent for mounting a `.vue` component in a Vitest
unit test — every existing `*.test.js` exercises a store or a plain `lib/`
module, and interactive component behavior (the play control, the settings
menu, the keyboard) is covered by the Playwright suite under `e2e/`
instead, including an `e2e/audio.spec.js` that already tests today's
rewind-and-play behavior end to end. The Play/Pause work follows that same
split: no new Vitest file, no new `@vue/test-utils`/`jsdom` dependency —
`e2e/audio.spec.js` gets the new Pause/resume scenarios, and its existing
"replaying restarts from the beginning" test is narrowed to the one case
that still restarts (the clip has already ended), matching the spec's
narrowed "Replaying" scenario.

### One interception point for every keystroke: the `typed` watcher
`stores/exercise.js` already has exactly one `watch(typed, ...)` that fires
regardless of whether the change came from `v-model` (physical keyboard) or
`append`/`backspace` (on-screen keyboard) — the same property this change
needs for counting every keystroke once, in one place, rather than
instrumenting both input paths separately. On each change:
- the key-press count increases by the magnitude of the length delta between
  old and new value (1 in the overwhelmingly common single-character
  append/backspace case);
- for each newly-appended character (new value longer than old), it's
  compared against the target sentence at that position — the same
  character-by-character comparison `nextExpected` in `lib/checking.js`
  already does — and counted as correct on a match.

This piggybacks on logic that already exists rather than adding a second
comparison path, and needs no change to `OnScreenKeyboard.vue` (it already
funnels through `typed` too).

Exercise completion is counted where `check()` already knows the answer was
correct, right next to where `result.value = 'correct'` is set today.

### Storage shape: one `localStorage` record per day, pruned to 7
`lib/stats.js` keeps a single JSON object at one `localStorage` key, e.g.
`{"2026-09-10": {"symbolsCorrect": 12, "keysPressed": 15,
"exercisesCompleted": 2}, "2026-09-12": {...}}`, keyed by the learner's local
`YYYY-MM-DD`. A single key (rather than one `localStorage` entry per day) is
read and written as one JSON blob, which keeps the day-rollover and 7-day sum
logic to plain object operations with no `localStorage` iteration. On every
write, entries older than 7 days are dropped, so the stored payload never
grows unbounded across months of use. This mirrors `stores/settings.js`'s
established pattern: reads and writes are wrapped in `try/catch`, falling
back to an in-memory-only day record when storage is unavailable (private
browsing, quota, disabled storage) rather than throwing.

`stores/stats.js` is a thin Pinia store over `lib/stats.js`: it exposes
`recordKeyPress(delta)`, `recordCorrectSymbols(n)`, `recordExerciseCompleted()`,
and computed `today` / `last7Days` totals `AnswerInput.vue` reads directly.
Splitting the pure day-bucketing/storage logic (`lib/stats.js`, easily
unit-tested against a mocked `localStorage` and a fixed date) from the
reactive store mirrors `lib/device.js` / `stores/settings.js`'s existing
split.

### Advance behavior gated in `check()`, not in the template
`check()` keeps scheduling `advanceTimer` for a correct answer only when
`settingsStore.showCompletionStats` is `false` — the exact behavior that
exists today, untouched. When the setting is `true`, `check()` does not
schedule an advance at all; `next()` is instead called by the new "Next
exercise" button (and on Enter while the summary is showing — replacing the
existing `@keyup.enter="store.check()"` binding on that state, since there
is nothing left to check). This keeps `stores/exercise.js` as the one place
that decides whether an advance happens, rather than splitting that decision
between the store and the template.

### Audio replay retriggers `SentenceView.vue`'s own `AudioPlayer.vue`, rather than mounting a second one
The first pass mounted `AudioPlayer.vue` a second time inside
`CompletionStats.vue`, `:key`ed by the completed exercise's id the same way
`SentenceView.vue` keys the first one. In practice that put two independent
`<audio>` elements for the same clip on the page at once — each with its own
Play/Pause button, so clicking the "wrong" one while the other was still
playing left both running together, and just having two controls for one
clip read as a mistake even before that. Fixed by keying
`SentenceView.vue`'s existing player on the exercise id *and* whether the
summary is showing for it (`` `${id}:${correct && showCompletionStats}` ``):
flipping that second part on a correct check destroys and recreates the one
component, which replays the clip through its own autoplay-on-mount the
same way a fresh exercise does — no second instance, no extra prop, and
`CompletionStats.vue` shows no control of its own at all. `store.current`
still refers to the completed exercise at this point (`next()` hasn't run
yet), so no extra state is needed to remember which clip to play.

### The play control gets a Pause state, everywhere `AudioPlayer.vue` appears
Once the summary's copy of the control autoplays the completed clip, a
learner mid-listen has no way to stop it short of leaving the page — the
same gap already existed for the original control's automatic first play,
just less noticeably. Rather than build a one-off stop button for the
summary's instance, `AudioPlayer.vue` itself gains a `playing` ref, updated
from the `<audio>` element's own `play`/`pause`/`ended` events (not just from
this component's own call to `.play()`), so it reflects reality even if
playback stops for a reason the component didn't initiate. The button reads
"⏸ Pause" while `playing` is true and "▶ Play" otherwise, and its click
handler branches on that state instead of always rewinding-then-playing:
- **Playing → click**: `audio.pause()`. Position is left where it was.
- **Not playing → click**: if the clip already reached its end (`audio.ended`),
  reset `currentTime` to 0 first (the existing rewind-before-play logic, kept
  for exactly this case); otherwise call `.play()` as-is, which resumes from
  the current position — covering both "never started" and "paused
  partway" without telling them apart explicitly.

This is a behavior change to the one existing control every exercise
already shows, not something scoped to the completion summary — there is
only the one mount of `AudioPlayer.vue` (in `SentenceView.vue`, see the
previous Decision), and it gets Pause for free the same as any other
exercise's.

### The new setting follows the existing two exactly
`showCompletionStats` (boolean, default `true`) is added to
`stores/settings.js` next to `virtualKeyboardOverride` and
`onScreenKeyboardVisible`, persisted the same fail-soft way, and given a
third Show/Hide group in `SettingsMenu.vue`'s existing `GROUPS` array — no
new UI pattern, just a third entry in a list that already renders each
group identically.

## Risks / Trade-offs

- **The default-on summary breaks a chunk of the existing Playwright suite**
  (roughly a dozen tests across `practice.spec.js`, `audio.spec.js`, and
  `virtual-keyboard.spec.js` that check a correct answer and then either
  look for the literal "✓ Correct" text or rely on the automatic advance) →
  each is updated in place rather than skipped: ones genuinely testing the
  base loop (keyboard shape, layout switching, finger guidance) gain a step
  that dismisses the summary via "Next exercise" or checking for it instead
  of the old text; ones specifically about the plain verdict or auto-advance
  keep asserting that behavior with the setting turned off first. See
  tasks.md Group 9.
- **Key-press counting is exact for single-character append/backspace and
  approximate otherwise** (e.g. a paste replacing a selection with several
  characters at once) → these paths are marginal for a dictation exercise
  typed character-by-character, and the delta-based count still produces a
  sane number rather than crashing or double-counting wildly; not worth a
  key-event listener that would have to be duplicated across the physical
  and on-screen input paths this design deliberately avoided touching.
- **Widening `AudioPlayer.vue`'s scope touches its existing behavior**
  (already covered by the "Audio playback" requirement and its scenarios,
  used on every exercise, not just this change's new summary) → the change
  is additive to the element's state (idle/playing/paused) rather than a
  rewrite, the existing rewind-before-play behavior is kept for the one case
  it still applies to (a clip that already ended), and the existing test
  coverage for autoplay and the blocked-autoplay prompt is re-run rather
  than replaced.
- **Six numbers is dense** → the first two passes tried prose: one line per
  window, either compact abbreviations (`"42 correct · 51 keys · 6 done"`,
  which didn't say *what* was correct or done) or the same numbers spelled
  out in full (`"42 symbols correct, 51 key presses, 6 exercises
  completed"`, clearer but repeating all three labels on both the "Today"
  and "Last 7 days" lines). A table says the same thing once: "Symbols
  correct" / "Key presses" / "Exercises completed" are column headings read
  once, "Today" and "Last 7 days" are row headings, and each cell is just
  its number — `CompletionStats.vue` renders this as one `<table>` (with
  real `<th scope="col">` / `<th scope="row">` headers, so a screen reader
  still announces what each number means). The Next button is a cell of the
  table itself, `rowspan`ning the two data rows, rather than a flex sibling
  beside it — placed next to the table instead, centering it against the
  whole block (header included) landed it in the gap between the two data
  rows rather than level with either; spanning just those two rows is what
  actually puts it in the same rows as the information. If real content
  still crowds a narrow desktop width, trimming further is a template-only
  follow-up, not a re-architecture.
- **`localStorage` can be unavailable or cleared** (private browsing, site
  data cleared, a different browser/device) → counts silently reset to zero
  in that session, same fail-soft posture `stores/settings.js` already takes
  for its two settings; no error surfaces to the learner.
- **A learner practicing across midnight mid-exercise** could have a
  completion counted against the day the check happened, not the day the
  exercise started → not observable to the learner as a bug (the count is
  attributed to *when the correct answer was checked*, which is a defensible
  and simple definition of "when it happened"), so no special-casing is
  added.

## Migration Plan

Additive, frontend-only, no persisted server data and no schema. Ships as a
normal frontend deploy; a learner's existing `localStorage` settings keys are
untouched, and the new stats key simply doesn't exist until the first
keystroke after this ships. Reverting the commit leaves no cleanup to do
beyond the unused `localStorage` key aging out under the 7-day prune.
