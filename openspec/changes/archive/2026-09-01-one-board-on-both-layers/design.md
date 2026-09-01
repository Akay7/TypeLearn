## Context

`src/frontend/src/lib/layout.js` holds the Kedmanee layout as two layers of
rows. Every row of the two layers matches its counterpart except one: the shift
layer's bottom row carries eleven keys where the base layer carries ten. The
extra key is `!`, and the file says why it is there — the corpus sentences
contain that character, a learner has no Latin layer to switch to, and "any
character the catalog uses has to be on a key". `FINGERS[3]` was extended to
eleven entries to give it a finger.

Measured rather than assumed:

```
layer 0 row lengths 13,13,11,10,1
layer 1 row lengths 13,13,11,11,1
shift-only key "!" at row 3 col 10, finger r-pinky
```

That is the whole difference between the layers. Its two consequences: the row
reflows when Shift is toggled — the right Shift key shrinks by a key width to
make room — and the eleventh key sits in the modifier cluster wearing the right
little finger's tint, offering a keystroke that does not exist on a physical
Thai keyboard.

The constraint that produced it is real and does not go away: `!` does appear in
Common Voice Thai sentences, and today an exercise containing one is typeable
only because of that invented key. The same constraint is already being violated
silently elsewhere — a corpus sentence containing a Latin letter or an Arabic
digit has no key at all, so the learner can never complete it, `isComplete`
never fires, and the exercise simply cannot be finished. The board grew one key
for the one case anybody noticed.

## Goals / Non-Goals

**Goals:**

- One physical board: both layers hold the same keys in the same positions, and
  a layer decides only what is printed on them.
- Every character a learner is asked to type is on that board — enforced by
  construction, for every untypable character, not by adding keys.
- The rule lives in one place, derived from the layout itself, so the layout and
  "what can be typed" cannot drift apart.
- The correction happens while the exercise is presented, so the stored catalog
  is untouched and changing the rule needs no re-ingestion.

**Non-Goals:**

- Changing `load_corpus`, the `Exercise` model, or the GraphQL schema. The
  sentence stays in the database exactly as the corpus wrote it.
- Adding a Latin layer, an IME, or any second layout. One board.
- Deciding what any *other* language's layout will do. Kedmanee is the only
  layout the app has, and the mechanism is a property of the layout module, so a
  second layout brings its own answer.

## Decisions

### The layers describe one physical board

`SHIFT`'s bottom row loses `!` and `FINGERS[3]` loses its eleventh entry. Both
layers then hold 13/13/11/10 character keys plus the space bar, which is the
ANSI key count Kedmanee is defined against.

A test asserts it directly — same row count, same length per row, same finger in
every position — so the next character the corpus needs cannot be solved by
growing the board again. The existing test `assigns a key the same finger on
both layers` iterates the *base* layer's positions and therefore never saw the
eleventh key; the new assertion compares shapes rather than walking one side.

*Alternative — keep the key and pad the base layer with a blank in the same
position.* The board would stop reflowing, but a dead key that types nothing is
still not a key on a physical keyboard, and the learner would be looking at a
board that does not exist.

*Alternative — an off-board strip for characters Kedmanee cannot type.* Honest
and it keeps every sentence intact, but it puts a second input surface on a
screen whose whole layout is fought over (`The exercise fits on one screen`), to
serve a character that a sentence rarely needs.

### The layout decides what is typeable

`layout.js` already answers the question: `keyFor(char)` is defined exactly when
the board can produce `char`. The stripping function is exported from that
module and built on `keyFor`, rather than being a list of allowed characters
maintained beside it. A character added to or removed from the board changes
what exercises ask for, in the same edit, with nothing to keep in sync.

### The target is corrected at presentation, not at ingestion

The store derives what the learner sees and types from the sentence it fetched.
The database keeps the corpus text; `load_corpus` is not touched.

Three reasons this is the right side of the wire. The corpus text stays
verbatim, so nothing is lost and a future feature that wants the original still
has it. The rule is a property of the on-screen keyboard, which is frontend
knowledge — putting it in `load_corpus` would make the backend depend on a
layout it cannot see. And it costs nothing to change: a layout edit takes effect
on the next page load, where an ingestion-time rule would need every exercise
re-selected and re-copied to take effect at all.

The cost is that it runs on every exercise rather than once. It is a scan of a
string of at most 255 characters against a `Map`, done once per exercise when
the deck is built.

*Alternative — reject such sentences during selection.* The catalog would then
be exactly what the board can type, which is a cleaner invariant, but it throws
away clips over one character of punctuation and bakes today's layout into the
data.

### It happens where every reader sees the same string

The correction is applied where the deck is presented — `current` — not at
individual call sites. The sentence on screen, the character-count hint, the
comparison, the completion trigger and the keyboard's next-key highlight all
read that one value, so the learner types exactly the sentence displayed. A
version stripped for checking but not for display would ask the learner to type
a character that is on screen and on no key, which is the bug being fixed
wearing a different hat.

Applying it in `current` rather than only in `load()` also means a deck put
there by any other route — a test, a future second source — is presented under
the same rule.

### Removal, then whitespace repair

Removing a character can leave two spaces where the corpus had one, or a space
at the start. Since the displayed sentence is the typed target, a doubled space
is a character the learner must type for a reason they cannot see. So after
removal the target collapses runs of spaces to one and trims the ends — which is
also what `compare` and `isComplete` already do to both sides, so nothing about
checking changes.

A sentence that is empty after this holds nothing to practise, so it is dropped
from the deck when the deck is built. If that left the deck empty, the existing
`empty` status already describes it.

## Risks / Trade-offs

- **A stripped character was spoken in the clip** → The audio is unchanged, so a
  sentence that loses a Latin word now reads slightly shorter than what is
  heard. Punctuation, which is the overwhelming majority of what this removes,
  is not spoken at all and carries no risk. Accepted for now, and cheap to
  revisit: if the catalog turns out to carry spoken Latin often, the decision to
  strip becomes a decision to reject, in `load_corpus`, without the layout
  changing.
- **The displayed sentence differs from the corpus sentence** → Only by
  characters no key can produce. The database still holds the original, and
  nothing in the app has yet claimed to show corpus text verbatim.
- **The length hint changes for affected exercises** → It is meant to count what
  the learner has to type, so counting the practice target is more correct than
  what it does today.
- **Someone re-adds a character to reach a corpus character** → The
  shape assertion fails, which is the point of adding it.

## Migration Plan

Frontend only, no data migration, no schema change. The change ships with the
next frontend image; an already-ingested catalog is corrected on the next page
load, because the correction happens at presentation. Rollback is reverting the
commit: the stored sentences were never modified, so there is nothing to undo.

## Open Questions

- Should the raw corpus sentence be shown anywhere — a "as written" line under
  the practice target — for the rare exercise where the two differ? Not needed
  to fix the board, so it is left out; the data to build it stays available.
