## Why

The on-screen keyboard's finger guidance mirrors colours across hands: both index
fingers show the same blue, both pinkies the same rose, and so on. A learner
glancing at a highlighted key can tell which finger presses it but not which
hand — for the index fingers this matters most, since they anchor the whole home
row on a physical keyboard. The board also has no equivalent of the tactile
bumps a physical keyboard puts on F and J, so nothing on screen tells a learner
where their fingers should rest between keystrokes. Both gaps make the guidance
read as "here is a key" rather than "here is where your hand lives."

## What Changes

- Give the left and right index fingers their own distinct colours instead of
  sharing one hue, so a highlighted index-finger key also says which hand
  reaches it. Pinky, ring, and middle fingers keep mirroring across hands as
  today.
- Mark the home-row key of each index finger — F and J on a Latin board, their
  Kedmanee equivalents on the Thai board — with a visible resting-position
  indicator, the on-screen equivalent of the tactile bump on a physical
  keyboard.
- Extend the legend so the two index-finger colours and the home-position
  marker are each named, not just the mirrored colours already explained.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `typing-practice`: the "Finger guidance on the keyboard" requirement changes
  from a fully mirrored, unmarked colour scheme to one where the index fingers
  carry distinct left/right colours and their home-row keys carry a resting-
  position marker.

## Impact

- `src/frontend/src/lib/keyboard/board.js` — the physical board description
  gains a way to mark a position as a finger's home key (currently only
  position and finger are recorded).
- `src/frontend/src/components/OnScreenKeyboard.vue` — the finger-colour map
  splits `l-index`/`r-index` into two colours, renders the home-position
  marker, and extends the legend.
- No backend, API, or layout (`kedmanee.js`, `layout.js`) changes: the finger
  assignments and key positions are unchanged, only how two of them are drawn.
