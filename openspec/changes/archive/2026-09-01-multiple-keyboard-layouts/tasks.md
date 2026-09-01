## 1. The board and the layout become separate things

- [x] 1.1 Extract the physical board from `layout.js`: rows of key positions, the touch-typing finger for each, the stagger of each row, and the furniture — modifiers, Backspace, the space bar — with the widths a physical keyboard gives them
- [x] 1.2 Express Kedmanee as data on that board: its language tag, a list of layers each naming the modifier that reaches it, and the script's own label rule for marks that have no advance width
- [x] 1.3 Refuse a layout whose layer does not cover the board's positions, where the layout is defined, naming the row and the two counts — the mismatch that used to be absorbed by extending the finger table
- [x] 1.4 Build a layout's character index when the layout is defined, and make the lookups take a layout rather than reading a module-level one

## 2. The keyboard renders the layout it is handed

- [x] 2.1 Rename `ThaiKeyboard.vue` to a component that renders any layout, and follow the rename through `SentenceView.vue` and the browser suite
- [x] 2.2 Take the character rows, the space bar and the row indents from the layout's board instead of slicing fixed indices out of `LAYERS`
- [x] 2.3 Render one modifier control per non-base layer from the board's furniture, replacing the two hardcoded Shift buttons, and make activating one release the others so exactly one layer is displayed
- [x] 2.4 Follow the next expected character to whichever layer holds it, with no comparison against layer 1
- [x] 2.5 Take the `lang` attribute and the keycap label rule from the layout rather than hardcoding Thai

## 3. The layout is chosen for the exercise

- [x] 3.1 Register layouts by language tag, with Kedmanee registered under Thai
- [x] 3.2 Select the layout for the exercise being presented, using the only registered layout while there is only one
- [x] 3.3 Correct the practice target against that layout — the rule `one-board-on-both-layers` introduces — rather than against a module-level board
- [x] 3.4 Leave the backend untouched: no `language` field, no migration, no schema change

## 4. Tests

- [x] 4.1 Re-express the Kedmanee assertions against the layout rather than the module: the 44 consonants, the vowel signs and tone marks, the Thai digits, the punctuation it carries, the home-row fingers, and the dotted-circle labels
- [x] 4.2 Define a three-layer fixture layout on the same board, and assert the keyboard renders it, offers a control for its third layer, switches to that layer for a next expected character, and reports its own typable set
- [x] 4.3 Assert a layout whose layer does not cover the board is refused when it is defined
- [x] 4.4 Assert two layouts on one board give the same position the same finger
- [x] 4.5 Assert that what is stripped from a sentence follows the layout in use, using the fixture as the second answer
- [x] 4.6 Browser suite: activating a modifier leaves every key's size and position unchanged

## 6. Reaching what the exercise's layout cannot type

- [x] 6.1 Register US QWERTY as a companion layout on the same ANSI board: available beside the exercise's own, never selected by an exercise
- [x] 6.2 Follow the next expected character to whichever available layout holds it, preferring the exercise's own so a character both boards carry does not move the board
- [x] 6.3 Show which layout is on screen and let the learner switch, from a control in the panel's bottom-left corner — white, off the board, wearing no finger colour, so it cannot be read as a key
- [x] 6.4 Strip only what no available layout can produce, and leave the sentence otherwise exactly as it was ingested
- [x] 6.5 Test the registry: preference order, `!` reaching the Latin board's shift layer, a character on no board, and what survives stripping
- [x] 6.6 Browser: a sentence carrying `!` is shown whole, the board switches to the Latin layout with that key lit, and the exercise completes on the on-screen keys

## 5. Verification

- [x] 5.1 Run `npm run test` and `npm run test:e2e` in `src/frontend`
- [x] 5.2 Bring the stack up and confirm a Thai session is unchanged end to end — the highlight follows the target across layers, no key moves when Shift is pressed, and an exercise completes using only the on-screen keys
- [x] 5.3 Confirm nothing generic carries the language in its name and the Kedmanee data file still does, as `Project naming is language-neutral` requires
