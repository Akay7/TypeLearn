## Context

The MVP loop is complete (roadmap M1–M7) and every piece this change touches is
in the frontend:

- `SentenceView.vue` renders the sentence, the length hint, and mounts
  `AudioPlayer` keyed on `store.current.id`, then `AnswerInput`, then
  `ThaiKeyboard`.
- `AudioPlayer.vue` owns an `<audio>` element and plays only on click.
- `AnswerInput.vue` binds `store.typed` with a plain `v-model`, offers a Check
  button and Enter, and renders the verdict inline — the incorrect branch adds
  three elements, including a second copy of the sentence.
- `stores/exercise.js` holds `deck`, `typed`, `result`, and the `check()` /
  `next()` pair with a 900 ms delay before advancing on a correct answer.
- `lib/checking.js` is the only place that reasons about characters, and it does
  so in code points (`[...text]`), never UTF-16 units.

Two properties of the existing code make this change cheap. Every Thai surface
already carries `lang="th"` — the sentence, the input, each character keycap —
so the font can be selected on that attribute instead of being threaded through
components. And every path that changes the answer, on-screen or physical, ends
at `store.typed`, so a single watcher there sees all typing.

## Goals / Non-Goals

**Goals:**

- Thai renders in a looped face the app serves itself, on every Thai surface.
- The clip is heard before the learner types, with a defined path when the
  browser refuses to autoplay.
- A completed answer checks itself; Enter and Check keep working.
- No verdict changes the position of the input or the keyboard.

**Non-Goals:**

- Per-character live colouring of the typed answer. Auto-check reports on a
  finished attempt; incremental feedback is a separate idea with its own design.
- Stabilising layout against things other than a verdict — a two-line sentence
  still occupies more vertical space than a one-line one when the exercise
  changes. That reflow happens between exercises, not during one.
- Any backend work. Checking stays client-side; no `Progress` row is written.
- Font choice for the interface chrome. Only Thai text changes face.

## Decisions

### 1. Bundle `@fontsource-variable/noto-sans-thai-looped`, select it on `lang="th"`

Noto Sans Thai Looped is the looped counterpart of the loopless Noto Sans Thai:
open-licensed (OFL-1.1), designed with pronounced heads, and covering the Thai
block including tone marks and Thai digits. The `@fontsource-variable` package
(v5.3.0, ~337 kB unpacked, no dependencies) self-hosts it; Vite fingerprints the
woff2 files into the build, so the app makes no request to a font host and works
offline.

Application is one rule in `style.css`, not a class per component:

```css
:where([lang="th"]) { font-family: var(--thai); }
```

`--thai` names the family with the existing sans stack behind it as fallback.
`:where()` keeps specificity at zero, so a component can still override. Every
Thai surface already sets `lang="th"` for correct shaping, so this reaches all of
them and cannot drift out of sync with a component that forgets a class.

*Alternatives considered.* The Google Fonts CDN — rejected: an external request
on every load, a privacy surface, and a broken app offline, all to avoid one
dependency. Sarabun or IBM Plex Sans Thai Looped — both looped and both fine, but
Noto's loops are the most pronounced, which is the entire point for a learner who
is identifying letters by their heads. Manually vendoring woff2 files — same
result as Fontsource with the update path done by hand.

### 2. Autoplay lives in `AudioPlayer`, which already remounts per exercise

`SentenceView` mounts `<AudioPlayer :key="store.current.id">`, so a new exercise
destroys the old component and builds a new one. Autoplay is therefore just
`onMounted(play)` — no watcher, no store state, and no way to play the wrong
exercise's clip, because the element that would hold the stale `src` no longer
exists. `onBeforeUnmount` pauses explicitly rather than trusting teardown to
silence a clip that is mid-playback.

Refusal is a `NotAllowedError` from the `play()` promise. The catch sets a local
`blocked` ref that renders a short "press play to hear it" line beside the
control; a successful play clears it. Because the state is local and the
component remounts per exercise, it re-derives itself every time: after the
learner's first click the browser grants playback, the next mount's autoplay
succeeds, and the prompt does not come back.

*Alternatives considered.* Hoisting the audio element into the store or a
composable so autoplay survives remounts — more machinery for state that is
correct precisely because it is thrown away. A global "user has interacted" flag
gating whether to try — the browser already answers that question, and asking it
directly means never guessing wrong.

### 3. Auto-check is one watcher on `store.typed`, with completeness in `lib/checking.js`

The store gains a watcher on `typed`:

```
watch(typed, () => {
  result.value = null                    // the verdict described an older answer
  if (current.value && isComplete(typed.value, current.value.sentence)) check()
})
```

`isComplete(typed, target)` joins `compare`, `nextExpected`, and `hasDiverged` in
`lib/checking.js`: it counts code points on both sides, trims the ends the same
way `compare` does, and answers whether the attempt is long enough to judge. It
is a pure function, so it is tested the way the other three are, and the
character-counting discipline stays in the module that owns it.

Putting it in the store rather than in `AnswerInput` matters: on-screen keys go
through `store.append`, physical typing goes through `v-model` on `store.typed`,
and only the store sees both. It also fixes a current gap — `append` and
`backspace` clear a stale verdict, but physical typing does not, so a red verdict
today survives the learner's next keystroke. Moving the clear into the watcher
covers every input path at once, and `append`/`backspace` drop their own line.

`check()` gains one line: cancel any pending advance before deciding. Without it,
a learner who types a correct answer and then adds a character inside the 900 ms
window gets an incorrect verdict and is advanced anyway by the timer the correct
answer scheduled.

*Alternatives considered.* Checking on a debounce after typing stops — introduces
a delay the learner cannot predict and fires on abandoned half-answers. Checking
only when the answer is correct (a silent advance) — the learner who mistypes
then sits in front of a finished-looking answer with no verdict, which is the
state this change exists to remove.

### 4. A fixed-height verdict slot, and the duplicate sentence goes away

`AnswerInput` renders the verdict inside a container of constant height that is
always present, empty or not. Nothing below it moves, and the space is reserved
before the first check rather than claimed by it.

That fits in one line only because the incorrect branch stops revealing the
expected sentence. The reveal is a copy of text that `SentenceView` has been
displaying at `text-5xl` the whole time — this app shows the sentence while the
learner types, so there is nothing to reveal. Removing it deletes the tallest,
most variable-height element in the feedback area and the redundancy at once.
The spec change is recorded in the delta: the incorrect scenario now says the
sentence stays visible where it has been all along.

*Alternatives considered.* Absolutely positioning the verdict over reserved space
— same effect, more CSS, worse for screen readers. Rendering the verdict with
`visibility: hidden` when absent — equivalent, but an always-present empty
container reads more plainly in the template.

### 5. The exercise is compacted into one screen, and the column is one width

Measured at 1280x720 with the longest sentence the catalog can hold, the page
overflowed. Four rows were spent on things that are each one line tall — the
length hint, the play control, the field, the Check button — and the keyboard,
the one element that must be visible while typing, was what fell off the bottom.

Two rows are recovered by pairing: the hint sits beside the play control, and
Check sits beside the field. The rest comes from the page's own spacing (`py-10`
to `py-4`, gaps from 10/6 to 4/3) and the sentence's leading, which was `relaxed`
for a block of prose this is not. That leaves ~50 px of slack at 1280x720 and
~46 px at 1024x640.

Moving Check onto the field's row made the input column wider than the board
beneath it, so the two now share one width: `--board`, defined once in
`style.css` and used by the keyboard that sets it and the answer row that
matches it. The alternative — repeating `47.25rem` in a second component — is
the same number in two places waiting to disagree.

*Alternatives considered.* Shrinking the keys — the board is the part a learner
reads while typing, and it is the last thing that should give up space. Letting
the verdict replace the length hint in a single shared row — it saves another
row, but the hint would vanish exactly when an exercise is still being worked on,
and the spec has it displayed whenever an exercise is.

### 6. The suite gets a browser, because four of these claims are only true on screen

Three of the four changes make claims a unit test cannot reach: that a face is
*loaded and used*, that a clip is *playing*, and that two elements are in the
*same place* before and after a verdict. Playwright drives Chromium against the
real dev server, so those are measured rather than assumed — `document.fonts`,
the media element's `paused`, and bounding boxes.

The suite never touches Django or PostgreSQL: every test stubs the GraphQL
catalog and serves a synthesised WAV, so the deck is deterministic (a real one is
shuffled), and the suite runs on a laptop with no corpus ingested and in CI with
no services. `VITE_API_URL` points at a same-origin path under test, which keeps
CORS preflights out of tests that are not about CORS.

The refusal path is the one place that does not use the browser's own behaviour:
autoplay policies differ per browser and move between versions, so `play()` is
made to reject with a `NotAllowedError` directly. That tests the question the
code answers instead of testing Chromium.

*Alternatives considered.* Component tests in jsdom — jsdom has no layout engine,
so every bounding box is zero and the layout claim cannot be made at all; it also
has no font loading and no media pipeline. Running e2e against the real backend —
a truer stack, paid for with an ingested corpus and a database before the suite
can run at all, and a shuffled deck that makes assertions probabilistic.

## Risks / Trade-offs

- **The keycap dotted circle (U+25CC) may not exist in the Thai face** →
  `layout.js` draws combining marks on `◌`, which is a General Punctuation
  symbol, not a Thai one. The fallback stack behind `--thai` supplies it if Noto
  Sans Thai Looped does not. Verify visually on the keyboard when applying; if
  the mismatch is ugly, style the circle separately rather than abandoning the
  font.
- **Autoplay policies differ across browsers** → Safari and Chrome refuse under
  different rules and Firefox has its own setting. The design does not try to
  predict them: it attempts playback and handles refusal, so a stricter browser
  degrades to today's behaviour plus a prompt.
- **Auto-check judges a learner who is still mid-thought** → an answer that
  reaches full length with a typo earlier in it is marked incorrect immediately.
  This is intended, and the keyboard already highlights Backspace whenever the
  answer has diverged, so the correction is pointed at rather than merely
  reported.
- **A verdict now re-renders on every keystroke past full length** → the fixed
  slot keeps this from moving anything, but the text can flicker as it clears and
  reappears. Acceptable; if it reads badly, holding the incorrect verdict until
  the answer shortens is a small follow-up.
- **First frontend runtime dependency beyond Vue and Pinia** → Fontsource
  packages are static assets with no code and no transitive dependencies, so the
  supply-chain surface is the woff2 files themselves.

## Migration Plan

1. `npm install @fontsource-variable/noto-sans-thai-looped` in `src/frontend`.
2. Ship the frontend changes together — the font, the autoplay, the auto-check,
   and the verdict slot are independent of one another and of anything deployed.
3. No data migration, no schema change, no backend deploy.
4. Rollback is reverting the commit; nothing persists state that would survive it.

## Open Questions

Both are now answered, by rendering them rather than by argument:

- **Which weight the sentence should use.** `font-medium` (500) stays. Rendered
  at `text-5xl` against 400 and 600, the loops stay open at 400 and 500 and start
  to tighten at 600; 500 keeps the presence the page's primary element wants
  without closing the heads the face was chosen for.
- **Whether the reserved verdict height needs tuning.** `h-8` (2rem) against a
  `text-lg` line box of 1.75rem: both verdicts fit with a little slack, which is
  what the question was asking for.
