## Why

The app currently shows a sentence and plays its clip, then stops — there is nowhere to
type and nothing to check, so the core loop ends halfway through. M6 and M7 are the two
milestones that close it: an on-screen Thai keyboard with an input field, and a
client-side comparison that gives instant feedback and moves the learner on. After this
change the MVP's success criterion is met — open the app, hear the clip, type what you
heard, get feedback — and Phase 1 is complete.

Now, because everything M6 and M7 need already exists: the catalog is ingested, the
`exercises` query serves it with absolute audio URLs, and the Pinia store that was built
one milestone early was shaped for exactly these two consumers.

## What Changes

- **`ThaiKeyboard` component** rendering the Kedmanee layout — the standard Thai keyboard —
  in four rows, with a Shift layer for the characters that need it (ฅ ฆ ฑ ฒ ณ ฏ ฐ ฯ ๆ and
  the rest). Clicking a key appends its character to the typed answer.
- **Next-key highlight.** While the typed answer is a correct prefix of the target, the key
  bearing the next expected character is highlighted, and the displayed layer switches to
  whichever layer holds that key so the highlight is never hidden behind Shift.
- **Input field** bound to the same typed answer, so the physical keyboard (a learner with a
  Thai IME) and the on-screen keys drive one piece of state. Enter checks the answer.
- **Answer checking**, client-side and exact: a green "correct" or a red "incorrect" with the
  expected sentence revealed. No `Progress` row is written, and no request is sent.
- **Advancing.** On a correct answer the next exercise loads automatically. The store fetches
  the catalog once at startup and walks a shuffled deck, so advancing costs no round-trip and
  no exercise repeats within a session. The typed answer, the result, and the audio reset with
  each new exercise.
- **Vitest** for the frontend's pure logic — the layout lookup, the next-expected-character
  computation, and the comparison — extracted into `src/frontend/src/lib/` modules. The
  frontend has no test runner today; these are the pieces where Thai combining characters can
  go silently wrong.
- Out of scope: Skip and retry controls, a session summary, and layout switching, which
  `specs/roadmap.md` places in Phase 2. No backend change of any kind — `exercises` already
  serves the full catalog with no arguments.

## Capabilities

### New Capabilities

None. The behavior this change implements was specified up front by
`align-specs-with-reality` and already lives in the `typing-practice` spec.

### Modified Capabilities

- `typing-practice`: refine the on-screen keyboard requirement to name the Kedmanee layout and
  state how the Shift layer behaves under the next-key highlight; refine advancing to cover a
  deck that has been exhausted and the state that must reset between exercises; state that the
  input field and the on-screen keys are one piece of state rather than two.

## Impact

- **New**: `src/frontend/src/components/ThaiKeyboard.vue`, `AnswerInput.vue`,
  `src/frontend/src/lib/layout.js`, `src/frontend/src/lib/checking.js`, and their tests under
  `src/frontend/src/lib/__tests__/`.
- **Modified**: `src/frontend/src/stores/exercise.js` (deck, `next()`, typed answer, result),
  `src/frontend/src/components/SentenceView.vue` (mounts the input, keyboard, and result),
  `src/frontend/package.json` (`vitest` devDependency, `test` script), `README.md` (frontend
  test command), `specs/roadmap.md` (M6 and M7 checkboxes).
- **Unmodified**: the entire backend. The schema, models, and ingestion are untouched.
- **Dependencies**: `vitest` only, as a devDependency. No keyboard library — `specs/tech-stack.md`
  requires the keyboard be a custom component.
- **Roadmap**: completes M6 and M7, and with them Phase 1.
