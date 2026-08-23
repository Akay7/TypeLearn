## 1. Looped Thai font

- [x] 1.1 Add `@fontsource-variable/noto-sans-thai-looped` to `src/frontend` with `npm install`, and confirm it lands in `package.json` dependencies (not devDependencies)
- [x] 1.2 Import the package in `src/style.css` (or `main.js`, whichever keeps the stylesheet self-contained) so Vite bundles the woff2 files and serves them from the app's own origin
- [x] 1.3 Declare `--thai` in `:root` — the looped family followed by the existing `--sans` stack as fallback — and add `:where([lang="th"]) { font-family: var(--thai); }`
- [x] 1.4 Verify in the browser that the sentence, the answer input, and the character keycaps all render looped, while English labels, the hint, and the legend keep the sans stack
- [x] 1.5 Check the keyboard's dotted circle (`◌`, U+25CC) on combining-mark keycaps: it should still render, from the fallback if the Thai face lacks it — note the outcome, and only style it separately if it reads badly next to the looped glyphs
- [x] 1.6 Confirm the network panel shows no request to `fonts.googleapis.com` or `fonts.gstatic.com` on load
- [x] 1.7 Settle the sentence weight at `text-5xl` in the looped face (design's first open question) and adjust `font-medium` if it reads heavy — kept at 500; 600 starts to close the loops

## 2. Audio plays before typing

- [x] 2.1 In `AudioPlayer.vue`, call `play()` from `onMounted` so the clip starts when the exercise is presented — no store state needed, the component is already keyed on `store.current.id`
- [x] 2.2 Add a local `blocked` ref: set it when `play()` rejects with `NotAllowedError`, clear it on a successful play, and keep logging the underlying error to the console
- [x] 2.3 Render a short "press play to hear it" prompt beside the control while `blocked` is true, sized so it does not push the layout around
- [x] 2.4 Pause the element in `onBeforeUnmount`, so advancing mid-clip never overlaps the previous exercise's audio with the new one's
- [x] 2.5 Verify by hand: a fresh page load plays the first clip or shows the prompt; after one manual play, later exercises autoplay with no prompt; advancing early cuts the previous clip off

## 3. The answer checks itself

- [x] 3.1 Add `isComplete(typed, target)` to `lib/checking.js` — code points on both sides, ends trimmed the same way `compare` does, true when the attempt is at least as long as the target
- [x] 3.2 Cover `isComplete` in `lib/__tests__/checking.test.js`: short answer, exact length, over length, trailing space, a target containing combining marks so the code-point count is exercised
- [x] 3.3 In `stores/exercise.js`, watch `typed`: clear `result`, then call `check()` when `current` exists and `isComplete` is true
- [x] 3.4 Remove the now-duplicated `result.value = null` from `append()` and `backspace()`, since the watcher covers every input path — including physical typing, which those two never saw
- [x] 3.5 Cancel any pending advance timer at the top of `check()`, so a correct answer that is then typed past does not advance on the timer the correct answer scheduled
- [x] 3.6 Add store-level tests for the new behaviour: typing the last character checks with no Enter; a wrong answer of full length reports incorrect; typing after a verdict clears it and re-checks at full length again; a correct answer still advances after the delay
- [x] 3.7 Verify Enter and the Check button still check at any length, including a short answer

## 4. The verdict holds its place

- [x] 4.1 In `AnswerInput.vue`, wrap the verdict in a container of constant height that renders whether or not a verdict exists
- [x] 4.2 Drop the "Expected" reveal from the incorrect branch — `SentenceView` displays the sentence at `text-5xl` throughout, so the reveal is a duplicate and the tallest variable element in the area
- [x] 4.3 Tune the reserved height so both verdicts fit without slack (design's second open question)
- [x] 4.4 Verify with the browser's element inspector that the input's and the keyboard's positions are byte-identical before a check, on a correct verdict, and on an incorrect one

## 5. Wrap up

- [x] 5.1 Run `npm run test` in `src/frontend` — existing `checking` and `layout` tests plus the new ones
- [x] 5.2 Walk the whole loop once by hand: load, hear the clip, type an answer wrong, see it judged without the page moving, correct it, hear the next clip start on its own
- [x] 5.3 Record the change in `specs/roadmap.md` — a Phase 2 usability entry and a decision-log row for the looped face and for automatic checking
- [x] 5.4 Run `openspec validate improve-practice-ux` and confirm it still passes before archiving

## 6. End-to-end tests in a browser

- [x] 6.1 Add `@playwright/test` and the Chromium browser to `src/frontend`, with a `playwright.config.js` that starts the dev server itself and an `npm run test:e2e` script
- [x] 6.2 Keep Vitest off the Playwright specs by pinning its `include` to `src/**/*.test.js` in `vite.config.js`
- [x] 6.3 Write `e2e/fixtures.js`: a stubbed GraphQL catalog, a synthesised WAV so no clip has to be committed, an autoplay refusal that rejects `play()` directly, and a helper that types through the on-screen keyboard
- [x] 6.4 `e2e/font.spec.js` — the looped face is first in the stack on all three Thai surfaces, is really loaded (`document.fonts.check`) and covers the sentence, is served from the app's own origin, is not used for English chrome or the placeholder, and no font CDN is contacted
- [x] 6.5 `e2e/audio.spec.js` — the clip plays with nothing pressed, replay rewinds, the refusal prompt appears and clears, the prompt does not move the play control, and the previous exercise's clip is stopped rather than left running
- [x] 6.6 `e2e/practice.spec.js` — the last character checks the answer on its own, a wrong full-length answer is judged, a short answer is not, Enter and Check still work, and the loop advances
- [x] 6.7 Assert layout stability by measuring: the input's and a key's bounding boxes are identical before a check, on incorrect, and on correct — and the sentence is not duplicated under the verdict
- [x] 6.8 Confirm the new tests fail against the pre-change code (reverted markup, no autoplay, no watcher) rather than passing vacuously
- [x] 6.9 Document `npm run test:e2e` in the README and record Playwright in the tech-stack

## 7. One screen, no scrolling

- [x] 7.1 Move the Check control onto the answer field's row, to its right, and let the field grow to fill the rest
- [x] 7.2 Put the length hint and the play control on one row, so two single-line elements cost one row instead of two
- [x] 7.3 Tighten the page's own spacing — `py-10` to `py-4`, the outer gap to 4, the section gap to 3 — and set the sentence's leading to `tight`, which is what a sentence of one or two lines wants
- [x] 7.4 Define `--board` in `style.css` and use it for both the keyboard's width and the answer row's max width, so the exercise reads as one column and the number lives in one place
- [x] 7.5 Measure the result at 1280x720, 1366x768, 1440x900, and 1024x640 with the longest sentence the catalog can hold, and confirm none of them scroll
- [x] 7.6 Add e2e coverage: the page does not scroll and the keyboard's last row is above the fold; Check is on the field's row and to its right; the answer row and the keyboard share both edges
- [x] 7.7 Confirm those tests fail against the roomy layout rather than passing vacuously
- [x] 7.8 Record the new requirement in the delta spec, and the reasoning in the design
