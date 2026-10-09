## Why

On a phone the answer row doesn't work. The Check button has a fixed pill width of about 200px, which leaves the answer field roughly a third of a 360px row. After a correct answer, the post-check summary can't be read: the stats table is pushed off the left edge of the screen by a margin sized for a laptop, its column headings are cut off, and it runs under the Next exercise button. Separately, in Russian and Hungarian the Next exercise label is wider than its fixed-width pill on every screen size, so the text spills past the button's edge.

## What Changes

- Below the `md` breakpoint (768px), Check and Next exercise become one compact 48px circle showing a glyph (✓ / →). The full label stays in the button as screen-reader text, so its accessible name doesn't change.
- From `md` up they stay label pills, but each pill is now as wide as the wider of its two labels in the current language, instead of a fixed `w-44`. Check and Next stay exactly the same size, and a long translation no longer overflows.
- The summary table is transposed: one row per counter, with Today and Last 7 days as the two columns. Only two short headings have to fit across a phone's width, and the counter labels get the widest column.
- On phones the table uses 11–12px text, tight line height and headings that wrap word by word, so it fits the ~330×100px box the answer row reserves, in all six interface languages, from 360px wide up.
- The summary lays out the table and Next exercise button side by side in normal flow, replacing the `mr-48` margin that guessed the button's width.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `typing-practice`: adds a requirement that the answer row fits a phone-width screen: a compact check control, a field that keeps most of the row, and control labels that never overflow in any supported language.
- `practice-stats`: adds a requirement that the post-check summary fits the answer row's reserved space on a phone-width screen in every supported language, with the continue control in the check control's exact place and size.

## Impact

- `src/frontend/src/components/AnswerRowButton.vue` (new): the shared Check / Next exercise button.
- `src/frontend/src/components/AnswerInput.vue`, `src/frontend/src/components/CompletionStats.vue`: use it. The table is transposed and gets a responsive layout.
- `src/frontend/e2e/completion-stats.spec.js`: the Today / Last 7 days assertions become column headers, and new phone-width tests run in every locale.
- No backend, API, storage, or locale-string changes.
