## 1. Board data: mark the index fingers' home keys

- [x] 1.1 In `board.js`, change the two `FINGERS` entries for the home row's F
      and J positions (row index 2, columns 3 and 6) from bare finger ids to
      `{ finger: 'l-index', home: true }` / `{ finger: 'r-index', home: true }`,
      and normalize every other position in `FINGERS` to the same shape (a bare
      finger id, or `{ finger }`) so the row-building code has one shape to read
      — verify by inspecting the updated `FINGERS` grid and running the existing
      `layout.test.js` suite, which reads `fingers` per row and must still pass
      unmodified
- [x] 1.2 Update `layout.js`'s row-building code (around the `fingers[col]`
      assignment) to read the normalized shape and attach both `finger` and
      `home` to each character cell — verify with a unit test asserting the F
      and J cells of the built home row carry `home: true` and every other
      cell carries `home: false`/`undefined`

## 2. Rendering: distinct index-finger colours

- [x] 2.1 In `OnScreenKeyboard.vue`, split the `FINGER_TINT` map so `l-index`
      and `r-index` resolve to two distinct Tailwind colour classes (keeping
      `l-pinky`/`r-pinky`, `l-ring`/`r-ring`, `l-middle`/`r-middle` mirrored as
      today), choosing a hue not already used by another finger and checked for
      readable contrast against key text in both light and dark mode — verify
      visually by loading the keyboard and confirming F-column and J-column
      keys render in different colours
- [x] 2.2 Add a second index-finger entry to the `LEGEND` array (one swatch per
      colour rather than one per mirrored pair) so both index-finger colours
      are named — verify the legend renders six finger entries where it
      previously rendered five

## 3. Rendering: home-position marker

- [x] 3.1 In `OnScreenKeyboard.vue`, render a small resting-position marker
      (a centered bar, not a dot — a round dot reads as the dotted-circle
      Kedmanee already draws under a combining mark's label, and ่ is one of
      the two home keys) on any cell whose `home` flag is true, styled so it
      stays visible over any finger tint and does not visually compete with the
      `ACTIVE_CLASSES` next-key ring when both are present on the same key —
      verify by triggering an exercise whose first character is on the F or J
      home key and confirming both the marker and the highlight ring are
      visible together
- [x] 3.2 Add a line to the legend area explaining what the marker means (e.g.
      "rest position") — verify by reading the rendered legend

## 4. Tests

- [x] 4.1 Add/extend unit tests in `lib/keyboard/__tests__/layout.test.js` (or a
      new test file) covering: the home flag lands on exactly the F and J
      positions of every layer of every registered layout, and that flag is
      unchanged when the modifier/layer changes — verify by running the
      frontend test suite
- [x] 4.2 Extend `e2e/practice.spec.js` (or add a focused component test) to
      assert the on-screen keyboard shows two visually distinct index-finger
      colours and a home marker on the F/J-equivalent keys — verify the new
      assertions pass in the existing test run

## 5. Spec sync

- [x] 5.1 Confirm the delta in
      `openspec/changes/improve-keyboard-finger-guidance/specs/typing-practice/spec.md`
      matches what was built (colours, marker, legend) before archiving — verify
      with `openspec validate --change improve-keyboard-finger-guidance --strict`
