## Context

`AnswerInput.vue` holds a plain `<input>` that the app auto-focuses on mount
and that the on-screen `OnScreenKeyboard.vue` writes into (see
`openspec/specs/typing-practice/spec.md` — "On-screen keyboard for the
exercise's language"). On a touchscreen, focusing any `<input>` is the
browser's own trigger for the OS virtual keyboard; the app has never
suppressed it because the desktop/laptop case this was built for (see "The
exercise fits on one screen") has no virtual keyboard to suppress. There is no
device-classification, settings, or persistence code anywhere in the frontend
yet — this change introduces all three.

## Goals / Non-Goals

**Goals:**
- Keep the OS virtual keyboard off the answer field by default on phones.
- Leave it available by default everywhere else, since a connected physical
  keyboard cannot be detected.
- Give the learner a persistent, explicit override in both directions.
- Keep the on-screen keyboard's own control reachable on a phone-sized
  screen, and let the learner hide that board entirely.

**Non-Goals:**
- General responsive layout for small screens beyond the keyboard board
  itself (the "fits on one screen" requirement is still laptop-scoped;
  reflowing the exercise column or the sentence's type scale for narrow
  viewports is separate work). The keyboard board's own overflow is
  in scope below — it turned out to block the override control's own
  reachability during e2e verification, not just a cosmetic gap.
- Detecting a physical keyboard directly — no browser API exposes this, which
  is precisely why an explicit override exists.
- A general settings panel/infrastructure beyond what these two settings
  need — no accounts, no server-side sync, no third setting speculatively
  added.

## Decisions

### Suppress via `inputmode="none"`, not `readonly` or a hidden proxy input
Setting the field's `inputmode` attribute to `"none"` tells the browser not to
draw its virtual keyboard on focus, while the field stays focused, editable,
and still receives physical key events — because `inputmode` only hints at
which virtual keyboard to show, it does not disable input. `readonly` was
considered and rejected: it also blocks physical keyboard input and caret
placement, which would break the "physical keyboard also works" scenario
already in the spec. A hidden/offscreen proxy input was considered and
rejected as needless complexity — `v-model`, `@keyup.enter`, and the visible
caret all keep working unchanged with `inputmode` alone.

`inputmode` becomes a computed property on the input, driven by whichever of
the two settings states below is active.

### Two independent pieces of state: device classification and override
1. **Device classification** (`phone` vs. not) is computed, not stored — a
   small composable reads it live from `matchMedia`, so it reacts if the
   viewport or input mode changes (e.g. rotating a phone, or a tablet
   docking a keyboard, changes `hover`/`pointer` on some platforms).
   Classification rule: `(max-width: 640px)` — Tailwind's own `sm` breakpoint,
   already the project's small-screen line — **and** `(hover: none) and
   (pointer: coarse)`, i.e. touch-primary with no mouse/trackpad. Both must
   hold; a narrow desktop window with a mouse is not a phone.
2. **Override** is a tri-state value — `auto` (default), `on`, `off` — held in
   a small Pinia store and mirrored to `localStorage` under one key, read
   once at store creation and written on every change. `auto` means "follow
   classification"; `on`/`off` force the `inputmode` regardless of it.

Keeping these separate (rather than collapsing to one persisted boolean)
means a learner who never touches the setting keeps getting the
device-appropriate default even if they later switch devices with the same
browser profile — `localStorage` is per-origin-per-browser, not per-device,
so a forced boolean would follow them somewhere it no longer applies.

### Settings control placement: a header menu, not the keyboard's bottom bar
Tried first as a pill in `OnScreenKeyboard.vue`'s existing bottom bar
(alongside the layout switch and finger legend). Phone-width e2e
verification (Playwright, `hasTouch`/`isMobile` emulation) caught what a
static mockup didn't: at 390px the bar is already tight, and the pill was
genuinely unclickable — other elements physically overlapped it. Rather than
fight that bar for space, both settings moved to a small popover menu off a
gear icon in the app header (`SettingsMenu.vue`), positioned
absolutely so it costs the header row no height on any viewport (`App.vue`'s
title row must stay short — see "The exercise fits on one screen"). This
also gave the second setting (below) a natural home instead of a second
crowded pill.

### The on-screen keyboard scrolls sideways rather than shrinking
`OnScreenKeyboard.vue`'s panel was `w-[var(--board)]`, a fixed width; below
that width the whole page grew wider than the viewport instead of the panel
adapting. Shrinking every key to fit was rejected — a key below a tappable
size defeats the board's whole point, and there is no width where a
13-column row shrinks to fit a phone and stays tappable. Instead: the panel
is now `w-full max-w-[var(--board)]` (shrinks with the viewport, matching
`AnswerInput.vue`'s column), and inside it the rows + space bar sit in an
`overflow-x-auto` wrapper at their full, unshrunk width — so on any viewport
narrower than `--board` the keys stay true size and the learner scrolls
sideways to reach the rest, the way they would scroll any wide content on a
touch device. The bottom bar (legend + layout switch) sits outside that
scroll wrapper, so it never scrolls out of reach itself; the legend also
gained `flex-wrap` for narrow panels.

### A second, independent setting: hide the on-screen keyboard
Once a learner is typing on a physical keyboard they already know work, the
board is a lot of screen for a hint they are not using — a plain "hide it"
option, not tied to the virtual-keyboard override (that one is about the
*OS* keyboard; this one is about *this app's own* board). Held as a second
field, `onScreenKeyboardVisible`, on the same settings store, defaulting to
shown and persisted the same way. `SentenceView.vue` wraps
`<OnScreenKeyboard>` in `v-if`, not `v-show`: the board holds no state worth
preserving while hidden (its layer and scroll position reset the same way a
new exercise already resets them), so mounting fresh on re-show costs
nothing and is simpler than tracking what to reset by hand.

### Where the logic lives
- `src/frontend/src/lib/device.js`: the `matchMedia`-backed
  phone-classification composable/helper, unit-testable by mocking
  `matchMedia` the way the existing `lib/keyboard` tests mock their inputs.
- `src/frontend/src/stores/settings.js`: the Pinia store holding both
  settings, their `localStorage` keys, and a computed `virtualKeyboardEnabled`
  that combines the override + classification into the boolean
  `AnswerInput.vue` needs.
- `AnswerInput.vue`: binds `:inputmode` to `store.virtualKeyboardEnabled ?
  'text' : 'none'`.
- `SettingsMenu.vue` (new): the header's gear button and its popover, reading
  and writing both settings.
- `OnScreenKeyboard.vue`: the `overflow-x-auto` scroll wrapper; no longer
  holds any settings-control markup itself.
- `SentenceView.vue`: `v-if`s the board on `onScreenKeyboardVisible`.

## Risks / Trade-offs

- **Classification is a heuristic and will misjudge some devices** (e.g. a
  large phone above 640px, or a small tablet at 640px in portrait) → this is
  exactly what the override exists for; the proposal treats the override as a
  first-class requirement rather than an escape hatch, and the design keeps
  the default in the "safer to leave the keyboard available" direction for
  anything not confidently phone-sized.
- **`inputmode="none"` support varies slightly across mobile browsers**
  (notably some older WebKit versions honored it inconsistently) → the
  override lets an affected learner switch it back on if suppression fails to
  behave, and lets one switch it off if a browser shows the virtual keyboard
  despite `inputmode="none"`; no feature detection is added since there is
  nothing reliable to detect.
- **`localStorage` can be unavailable** (private browsing in some browsers,
  storage disabled) → reads/writes are wrapped so a failure falls back to the
  in-memory default (`auto`) for that session rather than throwing.

## Migration Plan

Additive, frontend-only change with no persisted server data and no schema.
Ships as a normal frontend deploy; nothing to migrate or roll back beyond
reverting the commit if the heuristic proves wrong in practice.
