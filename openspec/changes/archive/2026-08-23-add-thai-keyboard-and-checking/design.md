## Context

M3–M5 are merged. `stores/exercise.js` holds `current` and a four-state `status`, fetches
`exercises(limit: 1)` with native `fetch`, and `SentenceView.vue` renders the sentence, the
character hint, and `AudioPlayer.vue`. The store was built one milestone early precisely so
this change would have somewhere to put the typed answer — the previous design says so.

Constraints inherited from earlier decisions:

- The backend needs no change. `exercises` with no arguments already returns the full 100-row
  catalog, and `openspec/specs/exercise-api/spec.md` specifies that behavior.
- Tailwind 4 utility classes only; `specs/mission.md` already fixes the visual arrangement —
  sentence, hint, play, input, keyboard, Check, result — and the key styling down to
  `ring-2 ring-white` for the active key.
- The keyboard must be a custom component. `specs/tech-stack.md` rules out a keyboard library.
- No `Progress` write. Checking is client-side for the MVP, by spec.
- The frontend has no test runner and no `lib/` directory today; both arrive here.

## Goals / Non-Goals

**Goals:**

- A Kedmanee on-screen keyboard where every character of every catalog sentence is reachable.
- One piece of typed state driven identically by the on-screen keys and a physical Thai IME.
- A next-key highlight that is always visible — including when the next character is on the
  Shift layer.
- Instant feedback and an automatic advance that costs no round-trip.
- The character-level logic — layout lookup, prefix/next-char, comparison — in pure modules
  under test, because Thai combining marks are where this silently goes wrong.

**Non-Goals:**

- Skip, retry, session progress, and layout switching. `specs/roadmap.md` places all four in
  Phase 2.
- Component tests. Vitest arrives for `lib/`; mounting Vue components needs jsdom and
  `@vue/test-utils`, which is a second decision for a later change.
- Any backend work, any mutation, any persistence of attempts.
- Tolerant comparison — near-misses, diffing, per-character scoring. The spec says exact.
- Mobile layout. `specs/mission.md` lists responsive design under "cannot build yet".

## Decisions

### The Kedmanee layout is data in `lib/layout.js`, not markup

`LAYERS` is a two-element array (base, shift), each a list of four rows, each row a list of
`{ char, label }`. A `KEY_INDEX` Map built once at module load answers the only question the UI
asks: given a character, which layer, row, and column holds it.

The alternative — rows written straight into `ThaiKeyboard.vue`'s template — makes the lookup a
search through the DOM structure on every keystroke and puts 90 characters where no test can
reach them. As data, the table is one export that a unit test can assert over exhaustively.

Kedmanee over a layout that groups consonants, vowels, and tone marks into tidy rows: the
mission is typing muscle memory ("the ability to produce text by ear"), and the highlighted key
is only useful as a finger target if it sits where the real key sits. A grouped layout would be
easier to build and would teach nothing transferable.

### Combining marks get a dotted circle for display only

Thai vowel signs and tone marks (ั ี ุ ่ ้ ็ ์) have no advance width — rendered alone on a keycap
they collapse onto the edge of the key or vanish. Each key therefore carries both `char`, the
value that gets typed, and `label`, what the cap shows: for a combining character the label is
U+25CC DOTTED CIRCLE followed by the mark, which is the convention Unicode charts use and every
Thai keyboard picture follows.

Keeping them as two fields rather than deriving the label at render time means the test that
asserts "every catalog character is reachable" reads `char` and never has to strip decoration.

### The Shift layer follows the highlight, and the learner can still drive it

`ThaiKeyboard` has a `layer` ref the Shift key toggles. A watcher on the next expected character
sets `layer` to whichever layer holds it. A learner who never touches Shift still sees the key
they need; a learner who does keeps control until the next character moves the highlight again.

The alternative of rendering both layers on every keycap — the shifted character small above the
base one, like a real keyboard — was rejected because a click then has no unambiguous meaning.

### Finger colour is data on the key, and the hands mirror

`FINGERS` in `lib/layout.js` gives the touch-typing finger for each column of each row, and the finger is attached to every key object as it is built. It is indexed by position, not by character, because that is what is true: the same physical key is pressed by the same finger on both layers.

The colours mirror across the hands — one hue per finger rather than eight separate hues. Four tints are told apart reliably at a glance and eight are not, and which hand is meant is never in doubt once the board is split down the middle. The space bar's thumb gets a fifth.

A legend names the five, because a colour code nobody explains is decoration. Each key also carries its finger in a `title` and in its accessible name, so the guidance survives for a learner who cannot use the colours at all.

*Alternative considered:* eight distinct hues, one per finger. Rejected — at the tint strength that keeps Thai glyphs readable, eight hues are not reliably distinguishable, and the mirror already carries the information.

Adding colour forced the next-key highlight to change: an indigo ring was one accent among several once the keys had hues of their own, so the highlight is now drawn in the page's own black or white, which holds its contrast against every tint.

### A diverged answer highlights Backspace

`nextExpected` returns `null` in two different situations — the answer has gone wrong, and the answer is finished — and those call for opposite advice. `hasDiverged` in `lib/checking.js` separates them, so a completed sentence is never mistaken for a mistake.

When the answer has diverged, the backspace key takes the highlight. A keyboard with nothing lit reads as "no idea what to do now" at exactly the moment the learner is most lost, and backspace is the only key that is unambiguously right in that state: there is no correct next character to point at until the answer is a prefix again.

`hasDiverged` treats anything the checker would accept as on track, which is what stops a forgiven trailing space from being reported as an error by one half of the app and accepted by the other.

*Alternative considered:* highlighting the character that *should* have been typed at the point of divergence. Rejected — it points at a key that cannot be pressed usefully, since typing it would append to an answer that is already wrong.

### The deck is fetched once and shuffled in the store

`load()` queries `exercises { id sentence audioUrl difficulty }` with no `limit`, shuffles the
result with a Fisher–Yates pass, and stores it as `deck` with an `index`. `current` becomes a
computed reading `deck[index]`. `next()` increments the index modulo the deck length — no
network, no new failure state, no repeat until the catalog is exhausted, and the wrap-around the
spec requires falls out of the modulo.

The catalog is 100 rows, roughly 20 KB of JSON; one request at startup is cheaper than a hundred
requests during a session, and the alternative — `exercises(filters: {id: {gt: …}}, limit: 1)` per
advance — puts a loading state in the middle of the moment the learner just got a green result.
Phase 2's "sequence of 10-20 questions" slices this same deck rather than replacing it.

`status` keeps its four values and its meaning; only `empty` changes trigger, from "no exercise"
to "no deck".

### Typed answer, result, and the reset live in the store

The store gains `typed` (a string), `result` (`null | 'correct' | 'incorrect'`), and the actions
`append(char)`, `backspace()`, `check()`, and `next()`. Three components read `typed` — the input,
the keyboard's highlight, and the result line — which is exactly the situation the previous design
predicted when it chose Pinia over a `ref` in `SentenceView`.

`next()` clears `typed` and `result` alongside the index, so the spec's reset requirement is one
action's postcondition rather than a rule three components have to remember. `AudioPlayer` already
takes `src` as a prop; a `:key` bound to the exercise id remounts it so a clip in flight cannot
outlive its exercise.

### Comparison is exact, over NFC-normalized text with the ends trimmed

`compare(typed, target)` in `lib/checking.js` returns a boolean after `normalize('NFC')` on both
sides and `trim()` on the typed answer.

Normalization guards against a physical IME emitting a different byte sequence for a visually
identical string; for Thai it is close to a no-op, which is the point — it costs nothing and
removes a class of "but it looks identical" bug reports. Trimming the ends absorbs the trailing
space a learner leaves after the last word. Internal spacing is left alone: Thai uses spaces as
phrase boundaries, so an internal space is content, not whitespace noise.

### The input field is a plain `v-model`; nothing intercepts keys

`AnswerInput.vue` binds `v-model` to the store's `typed` and lets the browser do the rest —
physical typing, backspace, selection, paste, and IME composition all work with no key handling
of our own, which is the whole content of the "physical keyboard also works" scenario. Enter is
bound to `check()`.

The on-screen keys call `append()` and `backspace()` on the same state. Their buttons prevent
default on `mousedown` so the input keeps focus, letting a learner mix clicking and typing without
clicking back into the field.

Intercepting `keydown` to route physical keys through the layout table was rejected: it would
break IME composition and reimplement, worse, what the input element already does.

### Vitest runs `lib/` only, in the default node environment

`vitest` as the single new devDependency, `"test": "vitest run"` in `package.json`, no config file
and no jsdom — the modules under test are pure functions over strings. Three suites: the layout
covers the Thai block and every key maps back to itself, the next-character logic handles prefixes
and divergence and multi-code-point sequences, and the comparison handles whitespace and
normalization.

The layout suite is the one that earns its keep. A single typo in a 90-entry table is invisible in
review and shows up as a key that types the wrong letter; asserting the table against the Thai
character set catches it at `npm run test`.

## Risks / Trade-offs

- **The layout table is transcribed by hand** → a wrong or missing character is a real
  possibility. Mitigated twice: the unit test asserting round-trip coverage of the Thai block, and
  an implementation step that diffs the table against the characters actually present in the 100
  ingested sentences. Anything the corpus uses and the table lacks is unreachable by the on-screen
  keyboard, so that diff must come out empty before the change is done.
- **Auto-advance on a timer** → the green result is shown for a beat before `next()` fires; a
  learner who acts inside that window could hit a half-reset state. The timeout handle is stored
  and cleared by `next()` itself, so the advance happens once regardless of what triggered it.
- **The whole catalog in memory** → fine at 100 rows, not fine at 100,000. The store's shape, not
  the query, is what would have to change; noted so it is not mistaken for a scaling decision.
- **No component tests** → the keyboard's rendering, the highlight, and the focus behavior are
  verified by hand against the acceptance list below. The pure logic under them is tested, which is
  where the subtle bugs live.
- **Shift layer auto-switching can feel jumpy** → the layer changes as the learner types past a
  shifted character. Accepted: a highlight the learner cannot see is worse than a keyboard that
  moves.
- **Exact comparison is unforgiving** → a learner one tone mark off gets red with no indication of
  where. That is what the spec asks for in the MVP, and the revealed sentence is the remedy;
  per-character diffing is Phase 2's "correct answer reveal".

## Verification

With the container up, `runserver` and `npm run dev` both running, and the catalog ingested:

1. `npm run test` passes, including the layout coverage suite.
2. The app shows a sentence, a play control, an empty input, and the keyboard, with no console error.
3. The key for the sentence's first character is highlighted before anything is typed.
4. Clicking that key types it, the input shows it, and the highlight moves to the second character.
5. Typing the same sentence on a physical keyboard with a Thai IME advances the highlight identically.
6. A sentence containing a Shift-layer character switches the displayed layer on its own when the
   highlight reaches it, and clicking the key types the right character.
7. Typing a wrong character clears the highlight; backspacing restores it.
8. Check with the exact sentence shows green and a different exercise appears with an empty field,
   no verdict, and the new clip playing when play is pressed.
9. Check with a wrong answer shows red and the expected sentence, and the learner can keep typing.
10. The browser's network tab shows one GraphQL request for the whole session — checking sends nothing.
