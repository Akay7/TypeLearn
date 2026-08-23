## 1. Test tooling

- [x] 1.1 Add `vitest` as a devDependency and a `"test": "vitest run"` script to `src/frontend/package.json`
- [x] 1.2 Confirm `npm run test` runs and reports zero test files without erroring

## 2. Pure logic modules

- [x] 2.1 Write `src/frontend/src/lib/layout.js` with `LAYERS` — base and shift, four Kedmanee rows each, every key `{ char, label }` and combining marks labelled with a leading U+25CC
- [x] 2.2 Build and export `KEY_INDEX`, a Map from character to `{ layer, row, col }`, plus a `keyFor(char)` lookup
- [x] 2.3 Write `src/frontend/src/lib/checking.js` with `compare(typed, target)` (NFC-normalized, typed answer trimmed) and `nextExpected(typed, target)` returning the next character or `null` when the typed answer is not a prefix
- [x] 2.4 Write `src/frontend/src/lib/__tests__/layout.test.js`: every entry round-trips through `keyFor`, no character appears on two keys, and the table covers the Thai consonants, vowels, tone marks, and symbols the corpus can contain
- [x] 2.5 Write `src/frontend/src/lib/__tests__/checking.test.js`: exact match, trailing-whitespace tolerance, internal spaces significant, divergence returns `null`, and a sentence with combining marks advances one code point at a time
- [x] 2.6 `npm run test` passes

## 3. Store

- [x] 3.1 Change `load()` to query `exercises { id sentence audioUrl difficulty }` with no `limit`, and store the result as a Fisher–Yates-shuffled `deck` with an `index`
- [x] 3.2 Make `current` a computed over `deck[index]`; keep `status` and its four values, with `empty` now meaning an empty deck
- [x] 3.3 Add `typed` and `result` state and the `append(char)` and `backspace()` actions, popping by code point rather than by UTF-16 unit
- [x] 3.4 Add `check()` — sets `result` from `compare()`, sends no request, writes no `Progress`
- [x] 3.5 Add `next()` — advances the index modulo the deck length, clears `typed`, `result`, and any pending advance timer
- [x] 3.6 On a correct result, schedule `next()` after a short delay and keep the timer handle so `next()` can clear it

## 4. Components

- [x] 4.1 Write `src/frontend/src/components/ThaiKeyboard.vue` rendering `LAYERS[layer]` as rows of keys styled per `specs/mission.md`, with a Shift key toggling `layer`
- [x] 4.2 Highlight the key holding `nextExpected(store.typed, store.current.sentence)` with `ring-2`, and highlight nothing when it is `null`
- [x] 4.3 Watch the next expected character and switch `layer` to the one holding it
- [x] 4.4 Give keys a backspace and call `append`/`backspace` on click, preventing default on `mousedown` so the input keeps focus
- [x] 4.5 Write `src/frontend/src/components/AnswerInput.vue` — an input `v-model`-bound to `store.typed`, a Check button, and Enter bound to `check()`
- [x] 4.6 Render the result in `AnswerInput.vue`: green "Correct", or red "Incorrect" with the expected sentence revealed
- [x] 4.7 Mount `AnswerInput` and `ThaiKeyboard` in `SentenceView.vue` beneath the audio player, and key `AudioPlayer` by the exercise id so it remounts on advance

## 5. Verify against the real catalog

- [x] 5.1 Query the live catalog and diff the set of characters in the 100 sentences against `KEY_INDEX`; anything unreachable is a missing key, so add it and extend the layout test
- [x] 5.2 Walk the design's acceptance list end to end in the browser: highlight, shift-layer auto-switch, divergence, backspace, correct auto-advance with a clean reset, incorrect reveal
- [x] 5.3 Confirm the network tab shows one GraphQL request for a whole session and none on check

## 6. Documentation

- [x] 6.1 Tick M6 and M7 in `specs/roadmap.md`
- [x] 6.2 Document `npm run test` in the README's frontend section
- [x] 6.3 Run `openspec validate --strict` on the change and fix anything it reports

## 7. Finger guidance

- [x] 7.1 Add `FINGERS` to `src/frontend/src/lib/layout.js` — the touch-typing finger per column of each row — and attach it to every key object
- [x] 7.2 Export `FINGER_NAMES` for the legend and for each key's tooltip and accessible name
- [x] 7.3 Tint each key in `ThaiKeyboard.vue` by its finger, mirroring the hands, and cover Shift, Backspace, and the space bar on the same scheme
- [x] 7.4 Redraw the next-key highlight in the page's own contrast, so it reads against every tint
- [x] 7.5 Add a legend naming the fingers beneath the keyboard
- [x] 7.6 Extend the layout tests: every key has a named finger, a position keeps its finger across layers, and the eight home keys sit under the right fingers

## 8. Guidance when the answer goes wrong

- [x] 8.1 Add `hasDiverged(typed, target)` to `src/frontend/src/lib/checking.js`, separating a wrong answer from a finished one and treating anything `compare()` accepts as on track
- [x] 8.2 Highlight the backspace key in `ThaiKeyboard.vue` whenever the answer has diverged, and only then
- [x] 8.3 Cover `hasDiverged` in the checking tests, including the finished-answer and trailing-space cases
- [x] 8.4 Extend the browser acceptance walk: a wrong character lights Backspace, a correct prefix puts it out, and a finished answer never lights it
