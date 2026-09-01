## Why

The on-screen keyboard changes shape when Shift is pressed. The base layer's
bottom row holds ten keys and the shift layer's holds eleven, because `!` was
appended to it — the corpus sentences contain that character and Kedmanee has no
key for it, so a key was invented. The whole argument for the Kedmanee layout is
that "the position a learner reads on screen is the position their finger takes
on a physical keyboard", and a board that grows a key under Shift breaks that
claim twice over: the row visibly reflows, and the invented key teaches a
keystroke no physical Thai keyboard can produce.

## What Changes

- The shift layer drops `!` and the finger table drops the eleventh entry that
  existed only to reach it. Both layers then describe one physical board: the
  same 47 keys in the same positions, differing only in what is printed on them.
- **BREAKING** for exercise text: a sentence is no longer guaranteed typeable as
  ingested. What the learner sees and types becomes the sentence with characters
  the board cannot produce removed — done when the exercise is presented, not at
  ingestion, so the catalog keeps the corpus text verbatim and the rule can
  change without re-ingesting anything.
- The removal covers every untypable character, not `!` alone. A stray Latin
  letter in a corpus sentence is the same defect and is silently unfinishable
  today: the learner can never type the character, so the answer can never be
  checked.
- The layout becomes the single authority on what is typeable. It already knows
  — `keyFor` answers exactly this question — so presentation asks it rather than
  carrying a second list that can drift.
- A test asserts the two layers hold the same number of keys in the same
  positions, so the next character the corpus needs cannot be solved by growing
  the board again.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — this change carries no delta spec of its own.

The requirements it would have written are owned by `multiple-keyboard-layouts`
instead: that change rewrites the on-screen keyboard requirements from
layout-agnostic first principles, and the rules this fix establishes — every
layer of a layout is the same physical board, and the learner is only asked to
type what that board can produce — are the generalised form of exactly those
rules. Two changes editing the same requirement in parallel would collide when
they are synced, so there is one owner. Apply this fix first; it is the Kedmanee
instance of what that change then states for any layout.

## Superseded in part

The board fix stands: `!` is off the shift row, the layers are one board, and
that is what makes the rest possible. The *answer* to "what about a sentence
carrying `!`" does not stand. This change removed the character from the
sentence; `multiple-keyboard-layouts` instead reaches it on a Latin layout the
keyboard switches to, which is what a Thai typist does — so the sentence is
shown as it was ingested, and only a character no board at all can produce is
still removed. Read the two together: this one for why the key had to go, that
one for where the character went instead.

## Impact

- `src/frontend/src/lib/layout.js` — `SHIFT` loses `!`; `FINGERS[3]` loses its
  eleventh entry; a function is exported that removes what the board cannot type.
- `src/frontend/src/stores/exercise.js` — the presented exercise carries the
  practice target rather than the raw sentence.
- `src/frontend/src/lib/__tests__/layout.test.js` — `!` leaves the punctuation
  the corpus is expected to reach; the layers-are-one-board assertion arrives.
- `src/frontend/src/components/SentenceView.vue` — unchanged in code, but its
  sentence and character count now describe the practice target.
- No backend change. `load_corpus` keeps storing the corpus sentence as written,
  and the GraphQL schema is untouched.
