## Context

`src/frontend/src/lib/layout.js` is named for a general idea and written as a
specific one. Its `BASE` and `SHIFT` tables are Kedmanee's characters; `FINGERS`
is an ANSI finger map interleaved with them by index; `LAYERS` is built by
zipping exactly those two tables; `KEY_INDEX` is a module-level map of every
character the one layout can type. `ThaiKeyboard.vue` reads that structure
directly: `LAYERS[layer].slice(0, 4)` for the character rows, `LAYERS[layer][4][0]`
for the space bar, `layer === 1` for "shifted", two hardcoded Shift buttons, a
`ROW_INDENT` array for the stagger, and `lang="th"` on every key.

None of that is wrong for Thai. All of it is Thai.

What a second layout needs, from real layouts rather than imagination:

- **A third layer.** German T1 reaches `@` with AltGr+Q and `€` with AltGr+E;
  French AZERTY reaches `@`, `#`, `{}`, `[]` the same way; the Polish
  programmers layout puts every Polish diacritic — `ą ć ę ł ń ó ś ź ż` — on
  AltGr. A base/shift pair cannot express Polish at all.
- **Its own unreachable set.** Russian ЙЦУКЕН has no `«` `»` `@` `#` `$` `&`;
  Arabic 101 writes `؟` and `،` where a scraped corpus carries `?` and `,`;
  Hebrew needs AltGr combinations for niqqud. Every layout has a version of the
  `!` problem, and each has a different answer.
- **Its own label rule.** The dotted circle that makes a Thai tone mark visible
  on a keycap is needed for Arabic harakat, Hebrew niqqud and Devanagari matras
  too — but the set of characters it applies to is per script.

And what no layout can do: Korean Dubeolsik composes `ㅎ`+`ㅏ`+`ㄴ` into `한`,
Vietnamese Telex composes `e`+`e`+`s` into `ế`, Chinese input selects candidates.
There, one key press is not one character, so "the key for the next expected
character" has no answer at all. Thai is unusually well suited to this app
precisely because it does not compose.

## Goals / Non-Goals

**Goals:**

- The keyboard renders a layout it is handed, whatever its layer count.
- The invariant the Kedmanee fix establishes — every layer is the same physical
  board — holds for every layout, structurally rather than by inspection.
- Each layout answers, for itself, what characters it can produce and what the
  learner may therefore be asked to type.
- The boundary of the model is written down, so the first person to reach for
  Korean reads why it does not fit rather than discovering it.
- Kedmanee's behaviour is unchanged. Nothing a learner sees moves.

**Non-Goals:**

- Shipping a second layout. This change makes room for one; it adds none.
- A backend `language` field, a migration, or a schema change. Deferred.
- Input-method composition, candidate selection, or dead keys.
- Physical boards other than ANSI. A board is data, so an ISO 102-key board is
  expressible, but only ANSI is described here.
- Letting a learner choose a layout other than the exercise's. The roadmap's
  "Thai + source language overlay" is a separate concern.
- Generalising the looped-typeface requirement. It is genuinely Thai-specific
  and will need the same treatment when a second script arrives, not before.

## Decisions

### The physical board and the layout are two things

A board is where keys are: rows of positions, the touch-typing finger for each,
the stagger of each row, and the furniture — Shift, Backspace, the space bar —
with the widths a physical keyboard gives them. A layout is what each position
types.

```
board  ANSI   rows [13, 13, 11, 10] + space, a finger per position,
                   the indents that make the rows line up, and where
                   the modifier keys sit
layout KEDMANEE  language, board, layers[], the label rule for its script
```

This is what makes "the layers are one board" structural. A layer is a list of
characters *for a board's positions*; a layer of the wrong length is a layout
that does not fit its board, caught by one check at module load rather than
surfacing at render time as a key with no finger. The previous change had to
assert the property in a test because the data could express its violation —
after this, it cannot.

*Alternative — keep one table per layer with the finger beside each character.*
That is today's shape, and it is exactly how the eleventh key got a finger and
nobody noticed: the finger table was extended to accommodate the layout instead
of the layout being rejected for not fitting the board.

### Layers are a list, and each names the modifier that reaches it

`layers: [{ modifier: null, rows }, { modifier: 'shift', rows }]` — and a layout
that needs AltGr adds a third entry. The component renders one modifier control
per non-base layer, using the board's geometry for it, and the controls are
mutually exclusive: pressing AltGr leaves the shift layer.

The keyboard therefore never asks "is this the shift layer"; it asks the layout
which layer holds the next character and shows that one, which is what the
highlight-follows-the-target behaviour already does with two layers.

*Alternative — a fixed base/shift/altgr triple.* Simpler to type out and wrong
in both directions: it forces every layout to answer for a layer it does not
have, and it stops at three when the real world has layouts with more.

### A character the board cannot type is reached on another board

Kedmanee has no `!`, and there were only ever three answers: invent a key, edit
the sentence, or switch layout. The first reshapes the board under the learner's
fingers and teaches a keystroke no physical Thai keyboard can produce — the
defect `one-board-on-both-layers` removed. The second shows the learner
something other than what was ingested, and quietly loses a character the
corpus really contains. The third is what a Thai typist actually does, and it is
free here: a Latin board is another layout on the same ANSI positions, which is
the machinery this change already builds.

So US QWERTY is registered as a *companion*: no exercise selects it, and it is
available beside whichever layout an exercise does. The keyboard follows the
next expected character to whichever available layout holds it, preferring the
exercise's own — so `?`, `%` and the brackets, which both boards carry, never
move the board under someone typing Thai.

Two things follow. The switch has to be visible, or a board that changed
language reads as a board that lost its mind — so a control in the panel's
bottom-left corner names the layout on screen, and the learner can press it to
switch.

It is deliberately not on the board and deliberately not shaped like a key:
white, in the corner, outside the rows, wearing no finger colour. Switching
layout is not a keystroke on any keycap — on a real machine it is Alt+Shift, or
a key the operating system claims — and a control that looked like a key would
be both a lie about the keyboard and one more thing a learner has to work out
whether to press while typing. That is the same mistake as the invented `!` key,
which is what this whole line of work started from.

And stripping shrinks to almost nothing. A character no *available* layout can
produce — an emoji, a CJK character, a typographic dash — still has no keystroke
to ask for, so it is removed as the exercise is presented; everything the corpus
realistically carries survives. `withoutUntypable` stays as the per-layout
primitive that answers "can this board type it"; `withoutUnreachable` is the
question the store actually asks, across the boards available.

*Alternative — strip everything Kedmanee lacks*, which is what the previous
change did. Simpler, and it makes every exercise typeable on one board — but it
edits the corpus's own text to fit a keyboard, for a character the learner could
have been shown how to reach.

### Every layout owns its typable set

`KEY_INDEX` becomes per layout, built when the layout is defined, and the
lookups take the layout: what key holds this character, and what does this
layout strip from a sentence. The practice-target correction — the rule from
`one-board-on-both-layers` — is asked of the layout in use, so a Russian
exercise loses `«` and a Thai one loses `!` without either rule being written
twice.

### The layout is chosen by language, and the language question is deferred

Layouts are registered in a map keyed by language tag. The exercise being
practised selects one; until an exercise carries a language, the single
registered layout is what every exercise gets.

The deferral is deliberate. Naming the language properly means an `Exercise`
field, a migration, an ingestion source for it, and a GraphQL field — work whose
right shape depends on how a second corpus is actually ingested, which nobody
has done yet. Guessing now produces a field that the real second language
contradicts. What this change does owe that future is a seam that does not have
to be re-cut: the registry, and one call site that asks it.

### A three-layer layout exists, in tests only

The AltGr path would otherwise be code no test runs and no layout uses — which
is the same as not having it. So the test suite defines a small fixture layout
with three layers on the same board and asserts the keyboard renders it,
switches to its third layer to show a highlighted key, and reports its own
typable set.

Deliberately a fixture and not a real German layout: shipping a layout nobody
has proof-read against a physical keyboard would be a second Kedmanee-shaped
claim made without checking, which is the mistake this change exists to stop
repeating.

### The component is renamed; the data keeps the language

`ThaiKeyboard.vue` becomes a component that renders any layout, so the Thai in
its name would be false. The Kedmanee data file keeps its language, which is
what `Project naming is language-neutral` already allows: the layout is
genuinely language-specific, the component is not.

## Risks / Trade-offs

- **Generalising from one example** → The shape is taken from four real layouts
  (Kedmanee, German T1, Russian ЙЦУКЕН, Polish programmers) rather than from
  what Kedmanee happens to need, and the three-layer fixture keeps the general
  path exercised. It will still be wrong somewhere; being wrong in data is
  cheaper than being wrong in a component.
- **An abstraction serving one implementation** → Real, and the reason the
  registry is a map and a lookup rather than a plugin system. If the second
  layout never arrives, what has been added is a split file and a fixture.
- **Renaming churn** → The component name appears in `SentenceView.vue` and the
  browser suite. Mechanical, and caught by the tests rather than by a reviewer.
- **A learner's physical keyboard is not the layout on screen** → Already true
  today and unchanged: the on-screen board is the thing being taught, the
  physical one is whatever the learner has.

## Migration Plan

Frontend only. No data migration, no schema change, no persisted state to
convert. It ships after `one-board-on-both-layers`, which removes the key that
makes Kedmanee's two layers different shapes — the data model here cannot
express that layout, which is the point, and applying this first would mean
representing the defect in order to keep it. Rollback is reverting the commit.

## Open Questions

- How does an exercise name its language? Deferred, and it needs: a field on
  `Exercise`, a value at ingestion (the Common Voice release directory already
  names it), a GraphQL field, and a fallback for the rows ingested before it
  existed.
- Should a learner be able to display a second layout beside the exercise's —
  the roadmap's "Thai + source language overlay"? Nothing here forecloses it;
  the registry is what it would read.
- Does the looped-typeface requirement become per script when a second script
  arrives, or per layout? Left for the change that adds one.
