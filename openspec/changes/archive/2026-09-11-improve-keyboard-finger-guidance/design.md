## Context

See proposal.md - Why. The board and finger data live in two files:

- `src/frontend/src/lib/keyboard/board.js` describes the physical ANSI board:
  a `FINGERS` grid (one finger id per row position) and `FURNITURE` (Backspace,
  Shift, AltGr, each with its own `finger`). Positions carry a finger id but
  nothing marking any of them as a "home" position.
- `src/frontend/src/components/OnScreenKeyboard.vue` owns all rendering: the
  `FINGER_TINT` map from finger id to Tailwind classes, the `LEGEND` array
  shown under the board, and the `highlighted()`/`ACTIVE_CLASSES` logic for
  the next-key ring.

The home row is `FINGERS` row index 2 (`ASDF GHJKL;` on a Latin board, 11
positions). Within it, column 3 is the left index finger's home key (F) and
column 6 is the right index finger's home key (J); columns 4 and 5 (G and H)
are also `l-index`/`r-index` but are the lateral reach, not the resting
position — a real keyboard puts no bump there either. This design marks
exactly columns 3 and 6 of row index 2.

## Goals / Non-Goals

**Goals:**
- Split `l-index`/`r-index` into two distinct colours in `FINGER_TINT` and
  `LEGEND`, with no change to which finger is assigned to which position.
- Add a per-position "home" flag to the board data, and render it as a small,
  static marker (a bar) on the two keys it applies to, visible independently
  of hover/highlight state.
- Keep the next-key highlight (`ACTIVE_CLASSES`) legible when it lands on a
  home-marked key, per the existing "highlight stays legible over the
  colours" requirement extended to the home marker.

**Non-Goals:**
- Not touching `l-pinky`/`r-pinky`, `l-ring`/`r-ring`, or `l-middle`/`r-middle`
  — they keep mirroring, per the user's chosen scope.
- Not marking a home position for every finger (pinky/ring/middle) — only the
  two index fingers get the marker, matching the physical F/J bump.
- Not changing `kedmanee.js` or `layout.js` — no layout, layer, or key-to-
  character mapping changes; this is purely a board-data + rendering change.
- Not changing keyboard behaviour (pressing, highlighting logic, layout
  switching) beyond the visual additions.

## Decisions

**Where the home flag lives: `board.js`, not the component.**
The finger-guidance requirement already establishes "the finger is a property
of the physical board." A home position is the same kind of fact — it depends
on which key a finger rests on, not on the layout or layer displayed — so it
belongs next to `FINGERS` in `board.js` rather than being hardcoded as
row/column literals inside the Vue component. Concretely, `FINGERS` entries
become `{ finger, home: true }` for the two marked positions (F and J's board
positions) and a bare finger id — or `{ finger }` — elsewhere; `keyboardModel`
(in `keyboard/index.js`, which turns board+layout into rendered cells) carries
the `home` flag through to each cell alongside `finger`, the way it already
carries `finger` through untouched.

Alternative considered: keep `FINGERS` as a flat array of finger ids and add a
separate `HOME_POSITIONS` list of `[row, col]` pairs. Rejected because it
duplicates the row/column indexing `FINGERS` already does and separates two
facts about the same position, which is exactly the split the file's own
header comment (interleaving discouraged) warns against for finger data.

**Index-finger colours: one shade of blue each, not two different hues.**
`sky` (currently shared by both index fingers) stays with the left hand; the
right gets a different shade of the same blue family (`blue-600`, deeper than
`sky-500`) rather than an unrelated hue such as lime or indigo. A shared hue
reads as "the two index fingers, told apart by shade" — which is what they
are, a mirrored pair like the other three — where two unrelated hues would
have read as two unrelated fingers, undoing the mirroring the other three
fingers still rely on. Pinky/ring/middle/thumb keep their own hues
unchanged, so no colour collides with them.

Alternative considered: a fifth, unrelated hue (lime, indigo, cyan) for the
right index finger, maximizing hue distance from every other finger. Rejected
per explicit user preference — a hue that reads as "an unrelated finger"
undersells that the two index fingers are still one pair, just distinguished
by side rather than merged.

**Home marker rendering: a short bar, not a dot, a border, or a background
change.**
The finger colour already occupies the key's background, and the next-key
highlight already occupies the ring/border. A third indicator needs a channel
that doesn't collide with either — but it also can't be a round dot: Kedmanee
already draws a dotted circle (`◌`) under a combining mark's label so the mark
has somewhere to sit (see `decorate` in `kedmanee.js`), and `่`, the *right*
index finger's own home key, is one of those marks. A round marker at the
bottom of that exact key reads as a second occurrence of a glyph already on
it, not as an unrelated indicator. A short horizontal bar avoids that
collision by shape alone — it also happens to be closer to what a physical
keyboard's F/J bump actually looks like, a ridge rather than a dot — sized as
a fraction of the key's own width so it scales between a normal keycap and
the narrower legend swatch. It is positioned at the bottom-center of the
keycap, rendered whenever the cell's `home` flag is true, in a neutral colour
(current text colour at reduced opacity) so it reads on top of any finger
tint and
under the highlight ring.

**Legend additions are appended, not restructured.**
The existing `LEGEND` array (one entry per left-hand finger, relying on the
mirror) gains a second index-finger entry (so index appears twice, once per
colour) and one line explaining the home marker. The legend's existing
five-item layout grows to six items plus one marker note; no redesign of the
legend's layout beyond accommodating one more item.

## Risks / Trade-offs

- [Two shades of the same hue are closer together than two unrelated hues,
  so the left/right index distinction could be harder to read at a glance,
  especially for a colour-vision-deficient learner, than the lime/indigo
  alternative would have been] → Mitigation: the shades are spaced further
  apart than the tint/hover step already used elsewhere on the board
  (`sky-500` vs `blue-600`, not two points on the same 500-scale), and the
  aria-label and home marker carry the left/right distinction independently
  of colour, so the colour is a reinforcement rather than the only signal.
- [A bar marker could be mistaken for a stray artifact or a third kind of
  highlight] → Mitigation: the legend explicitly names it, per the new
  "home marker is explained" scenario, and it renders identically regardless
  of highlight/hover state so its meaning stays constant.
- [Marking only F/J and not the full home row could read as inconsistent once
  a learner asks "why not my other fingers too?"] → Accepted trade-off per
  the user's explicit choice; the proposal and spec scope this to the index
  fingers only, matching the physical keyboard's own bumps.

## Migration Plan

Frontend-only, additive change to existing files; no data migration, no API
change, no backend involvement. Ship behind no flag — the change is purely
visual/additive and the existing Playwright/unit tests for the keyboard
(`__tests__/kedmanee.test.js`, `__tests__/layout.test.js`,
`e2e/practice.spec.js`) continue to exercise typing behaviour unchanged; new
tests cover the two colour and marker scenarios. Rollback is a plain revert
since no persisted state or schema is touched.
