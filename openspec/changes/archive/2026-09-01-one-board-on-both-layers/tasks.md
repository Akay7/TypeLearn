## 1. The board becomes one board

- [x] 1.1 Remove `!` from `SHIFT`'s bottom row in `src/frontend/src/lib/layout.js`, and remove the eleventh entry from `FINGERS[3]` that existed only to give it a finger
- [x] 1.2 Rewrite the module comment that explains the `!` exception: the table is Kedmanee, both layers are the same physical board, and a character the board cannot reach is handled by not asking for it
- [x] 1.3 Assert in `layout.test.js` that the layers are one board — same row count, same key count per row, same finger in every position — rather than walking the base layer's positions, which is how the eleventh key went unseen

## 2. The layout decides what is typeable

- [x] 2.1 Export a function from `layout.js` that returns a string with every character the board cannot type removed, built on `keyFor` so there is no second list to keep in sync
- [x] 2.2 Collapse runs of spaces and trim the ends after removal, so a removed character leaves no doubled or leading space in the target
- [x] 2.3 Unit-test it: `!` and a Latin letter are removed, every Thai character and the punctuation Kedmanee does carry survive, spacing is repaired, an all-untypable string comes back empty, and a sentence needing no correction comes back identical
- [x] 2.4 Drop `!` from the punctuation list in `layout.test.js` that asserts what the corpus needs to reach, and state there that the guarantee now runs the other way

## 3. The presented exercise is the practice target

- [x] 3.1 Apply the correction in `src/frontend/src/stores/exercise.js` where the exercise is presented, so the sentence on screen, the character-count hint, the check, the completion trigger and the next-key highlight all read the same string
- [x] 3.2 Leave out of the deck any exercise whose sentence holds nothing typeable, and confirm an emptied deck still reports the existing `empty` status
- [x] 3.3 Leave `load_corpus`, the `Exercise` model and the GraphQL schema untouched — the stored sentence stays as the corpus wrote it
- [x] 3.4 Extend the store tests: an exercise whose sentence carries `!` is presented and can be completed, the raw sentence in the deck is not modified, and an exercise with nothing typeable never becomes `current`

## 4. Verification

- [x] 4.1 Run the unit suites (`npm run test`) and the browser suite (`npm run test:e2e`) in `src/frontend`
- [x] 4.2 Add a browser assertion that toggling Shift leaves the bottom row's key count and the board's width unchanged — the reflow is what the learner actually saw
- [x] 4.3 Bring the stack up and check by hand: toggle Shift and watch no key move, then type an exercise whose sentence contained an untypable character through to a correct verdict using only the on-screen keys
