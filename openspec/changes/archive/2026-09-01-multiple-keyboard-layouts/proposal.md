## Why

The application's premise is that it serves any language, and the on-screen
keyboard is the one place that premise is not yet true. `layout.js` does not
hold *a* layout; its structure *is* Kedmanee: exactly two layers, four character
rows and a space row, an ANSI finger table written beside the characters, a Thai
combining-mark rule for the key labels, Shift as the only modifier, `lang="th"`
in the markup, and a component named for the language.

Nothing about that generalises, and the failures are not hypothetical:

- German, French, Spanish and Polish put characters on a **third layer** reached
  with AltGr. Polish diacritics — `ą ć ę ł ń ó ś ź ż` — live entirely there, so a
  board with two layers cannot type Polish at all.
- Russian ЙЦУКЕН has no `«` `»` `@` `#` `$` `&`; Arabic writes `؟` and `،` where
  a scraped corpus often carries `?` and `,`. Each layout has its own set of
  characters it simply cannot produce — the `!` problem, once per language.
- Korean, Vietnamese and Chinese break the model itself: a keystroke is not a
  character there, so "highlight the key for the next character" has no answer.
  That belongs in the specification as a stated boundary, not as an omission
  someone discovers.

## What Changes

- **The physical board and the layout become separate things.** A board owns
  positions, the touch-typing finger for each, and the stagger of its rows. A
  layout owns what each position types on each of its layers. The rule the
  Kedmanee fix establishes — every layer is the same board — stops being a rule
  to check and becomes the shape of the data.
- **A layout declares its own layers**, as a list rather than a base/shift pair,
  each naming the modifier that reaches it. Two for Kedmanee, three for a layout
  with an AltGr layer, and the keyboard renders whatever it is handed.
- **The keyboard component stops knowing Thai.** Rows, the space bar, the
  modifier keys it draws, the `lang` attribute it sets, and the rule for
  displaying a mark that has no advance width all come from the layout it is
  given. The component is renamed accordingly; the Thai-specific part is a data
  file that keeps the language in its name.
- **Every layout carries its own typable set.** "What the board can produce"
  becomes a question asked of a layout, and the practice target is corrected
  against the layout in use rather than against a global one.
- **Layouts are registered by language**, and the exercise being practised
  selects one. How an exercise names its language is left open until a second
  language exists: with one layout registered, that one is used.
- **Scripts whose writing composes are out of scope, stated.** A layout is a map
  from key presses to characters; Hangul jamo composition, Vietnamese Telex and
  Chinese input methods are not that, and the specification says so rather than
  leaving the model to fail quietly.

## Capabilities

### New Capabilities

None. This is the existing keyboard, described in terms that admit a second
layout.

### Modified Capabilities

- `typing-practice`: the on-screen keyboard requirement stops being a Kedmanee
  requirement. It becomes: a layout for the exercise's language, whose layers
  all describe one physical board, whose count is the layout's own business, and
  which decides what the learner can be asked to type. Kedmanee is named as the
  first and, for now, only one. The finger-guidance requirement follows the same
  generalisation, and the boundary of the model is stated.

## Impact

- `src/frontend/src/lib/layout.js` — split: a physical board (positions,
  fingers, stagger), the Kedmanee layout as data on it, and the registry and
  lookups that take a layout.
- `src/frontend/src/components/ThaiKeyboard.vue` — renamed to a component that
  renders any layout; the two hardcoded Shift keys become the modifier keys the
  layout declares, and `LAYERS[layer]` becomes the layer list it was handed.
- `src/frontend/src/stores/exercise.js` — the practice target is corrected
  against the layout for the exercise, not a module-level one.
- `src/frontend/src/lib/__tests__/layout.test.js`, `e2e/practice.spec.js` — the
  Kedmanee assertions stay, and a fixture layout with three layers exercises the
  paths no shipped layout uses yet.
- `openspec/specs/typing-practice/spec.md` via this change's delta.
- No backend change: no `language` field, no migration, no schema edit. That
  decision is deferred to the change that adds the second language.
- Depends on `one-board-on-both-layers` being applied first — it removes the one
  key that makes today's two layers different shapes, which this change's data
  model would otherwise be unable to express.
