## Why

The core loop works, but it fights the learner in four places: Thai renders in
whatever the system picks — often a loopless display face whose letters a
beginner cannot tell apart; the clip only plays when asked, so the learner reads
the sentence before hearing it and practises copying rather than listening;
finishing an answer still costs a reach for Enter or the Check button; and a red
verdict inserts a block that pushes the on-screen keyboard down mid-exercise,
moving every key out from under the finger aiming at it.

## What Changes

- **Looped Thai typeface.** Thai text — sentence, input field, keycaps, revealed
  answer — renders in a bundled looped face (heads drawn as visible loops)
  rather than inheriting `system-ui`. Self-hosted, so the app keeps working
  offline and does not call a font CDN.
- **The clip plays first.** When an exercise is presented, its audio plays
  automatically, before the learner types. Manual replay stays. Where the
  browser's autoplay policy blocks the first play, the app says so plainly and
  keeps the play control as the way through, rather than failing silently.
- **The answer checks itself.** When the typed answer reaches the target
  sentence's length, it is checked automatically — correct or not. Enter and the
  Check control keep working as a manual path, so nothing is taken away.
- **The verdict never moves the page.** The feedback area holds constant height
  whether it is empty, green, or red, so the keyboard and input stay put across
  a check.
- **The whole exercise fits on one screen.** The Check control moves onto the
  answer field's row, the length hint shares a row with the play control, and the
  page's spacing tightens, so a learner on a laptop sees the sentence and every
  key at once instead of scrolling away from what they are typing.

## Capabilities

### New Capabilities

None. Every change refines behaviour the `typing-practice` capability already
owns.

### Modified Capabilities

- `typing-practice`: four requirement changes —
  - *Exercise presentation* gains a script-legibility requirement: Thai is
    rendered in a looped face the app ships, not a system default.
  - *Audio playback* gains automatic playback on presentation, with defined
    behaviour when the browser refuses it.
  - *Answer checking* gains an automatic trigger at target length, alongside the
    existing manual ones.
  - *Answer checking* gains a layout-stability requirement: a verdict must not
    reflow the page.

## Impact

- **Frontend only.** No backend, schema, model, or data change; checking stays
  client-side and still writes no `Progress` row.
- Files: `src/frontend/src/style.css` (font face and Thai stack),
  `components/SentenceView.vue`, `components/AudioPlayer.vue`,
  `components/AnswerInput.vue`, `stores/exercise.js`.
- **New dependency**: one `@fontsource/*` package carrying a looped Thai face,
  bundled by Vite. First frontend runtime dependency beyond Vue and Pinia.
- Bundle grows by the subsetted Thai font (tens of KB), served from the app's
  own origin.
- Existing `lib/checking.js` tests keep passing unchanged; the new auto-check
  trigger and the audio autoplay path need their own coverage.
