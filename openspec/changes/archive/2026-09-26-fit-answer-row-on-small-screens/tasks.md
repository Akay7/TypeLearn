## 1. Shared answer-row button

- [x] 1.1 Add `AnswerRowButton.vue`: a `size-12` glyph circle below `md` with an `sr-only` label; a pill from `md` up, sized to the wider of `answer.check` / `stats.next`. Verify by building (`npm run build`).
- [x] 1.2 Use it for Check in `AnswerInput.vue` (give the field `min-w-0`). Verify `e2e/completion-stats.spec.js` "answer-row button on a phone-sized viewport" passes.

## 2. Summary layout

- [x] 2.1 In `CompletionStats.vue`, lay out the table and the Next button side by side in normal flow (drop `mr-48` and the absolute wrapper). Verify "Next exercise takes Check's exact position and size" still passes.
- [x] 2.2 Transpose the table (counter rows; Today / Last 7 days columns) and add the phone-only density rules (`text-[11px]`, `leading-tight`, `w-0` + `min-w-16` headings, `w-full`). Verify the six "fits the answer row's reserved box at 360px" tests pass.

## 3. Tests

- [x] 3.1 Update `e2e/completion-stats.spec.js`: Today / Last 7 days as column headers, counters read by row. Add 360px fit tests for all six locales, the compact-Check test, and the Russian long-label test. Verify `npm run test:e2e` passes (79 tests).
- [x] 3.2 Verify `npm run test` (unit) still passes.
