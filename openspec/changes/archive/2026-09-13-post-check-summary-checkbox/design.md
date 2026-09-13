## Context

See proposal.md - Why. `SettingsMenu.vue` renders three setting groups from
one `GROUPS` array through a single `radiogroup`/`role="radio"` template
(see `SettingsMenu.vue:14-51` for the array, `:116-159` for the template).
Only the "Post-check summary" group (`showCompletionStats`) is changing to a
checkbox; the other two groups keep their existing radiogroup rendering
unchanged.

## Goals / Non-Goals

**Goals:**
- Render `showCompletionStats` as a single `role="checkbox"` control that
  toggles the setting directly.
- Keep the existing per-group template usable for the two groups that stay
  radiogroups, without duplicating the popover's layout/spacing markup for a
  one-off checkbox.

**Non-Goals:**
- Changing `showCompletionStats`'s storage, default, or persistence
  (`stores/settings.js` is untouched).
- Changing the virtual keyboard override or on-screen keyboard groups.
- Introducing a generic "field type" system for arbitrary future setting
  kinds — this design only needs to distinguish "radiogroup" from
  "checkbox", so it does the minimum for that.

## Decisions

**Give the checkbox group its own `kind` and branch the template on it,
rather than generalizing every group to a shared abstraction.**
`GROUPS` gains `kind: 'radiogroup'` (default, on the two existing groups) or
`kind: 'checkbox'` (on the `showCompletionStats` group). The template
`v-for`s over `GROUPS` as before, but wraps two alternative bodies —
existing radiogroup markup on `kind === 'radiogroup'`, new checkbox markup on
`kind === 'checkbox'` — behind a `v-if`/`v-else`. Alternative considered:
build one row-rendering helper generic enough for both shapes; rejected as
premature abstraction for two shapes with genuinely different accessible
semantics (a radiogroup of named options vs. a single toggle) and a group
count of three.

**One label and one description, not two.** The current radiogroup carries
an `Enabled` description and a `Disabled` description, each describing that
state. A checkbox has one accessible name and, optionally, one description,
not two — Rather than swap descriptive text based on checked state (extra
logic for marginal value; the setting's effect is already explained by the
group title context), the checkbox keeps a single static description: the
existing `Enabled` copy, `"Today's and the last 7 days' practice, plus a
replay"`, describing what the summary shows when the box is checked. The
group title `Post-check summary` remains as the group's heading, unchanged.

**Accessible name is the group title, not a repeated `Enabled`.** A
standalone checkbox's name should say what it turns on: `aria-label="Post-check
summary"` (or an associated `<label>`/`aria-labelledby` pointing at the
existing title element) rather than reusing `Enabled`, which only made sense
paired with a sibling `Disabled` button. The visual heading row currently
rendered above each group is reused as the checkbox's label rather than
duplicated.

**Checkbox visual**: a small square with a check glyph shown when
`aria-checked="true"`, replacing the current circular radio dot, sized and
positioned the same as the existing indicator (`size-3.5`, same gap and
padding) so the row's layout doesn't shift between the two group kinds.

**e2e updates**: `fixtures.js`'s `disableCompletionStats` and any assertion
in `completion-stats.spec.js` against this setting's `Enabled`/`Disabled`
radio options switch to `page.getByRole('checkbox', { name: 'Post-check
summary' })` plus `.click()` / `toBeChecked()`/`not.toBeChecked()` as
appropriate. `virtual-keyboard.spec.js` and the `Hide` option used inside
`completion-stats.spec.js` for the on-screen-keyboard setting are unaffected
since that group stays a radiogroup.

## Risks / Trade-offs

- [Branching the template on `kind` adds a small conditional to a component
  that was previously one uniform loop] → scoped to exactly the two shapes
  this menu has today; revisit only if a third shape shows up.
- [Existing description copy ("Today's and the last 7 days' practice, plus a
  replay") was written to pair with a sibling "Disabled" option, and now
  stands alone] → it still reads correctly as "what checking this box does",
  no copy change needed.
