## 1. Settings menu

- [x] 1.1 In `SettingsMenu.vue`, add `kind: 'checkbox'` to the
      `showCompletionStats` group (defaulting the other two groups to
      `kind: 'radiogroup'`), and verify the `GROUPS` array still has exactly
      three entries with no other fields changed.
- [x] 1.2 Branch the popover template on `group.kind`: keep the existing
      `role="radiogroup"`/`role="radio"` markup for `radiogroup` groups, and
      add a new checkbox row for `kind === 'checkbox'` — `role="checkbox"`,
      `aria-checked` bound to `settings.showCompletionStats`, an accessible
      name of "Post-check summary" (reusing the group's title element via
      `aria-labelledby` rather than repeating the string), one static
      description ("Today's and the last 7 days' practice, plus a replay"),
      and a click handler that toggles `settings.showCompletionStats`
      directly. Verify by opening the settings menu in the running app and
      inspecting the accessibility tree (e.g. browser dev tools) shows a
      single checkbox, not two radio buttons, for this group.
- [x] 1.3 Style the checkbox's checked indicator (a square with a check
      glyph) at the same size/position as the existing radio dot so the row
      layout is unchanged between group kinds, and verify visually that the
      "Virtual keyboard" and "On-screen keyboard" groups render pixel-identical
      to before.

## 2. e2e coverage

- [x] 2.1 Update `disableCompletionStats` in `src/frontend/e2e/fixtures.js`
      to locate `page.getByRole('checkbox', { name: 'Post-check summary' })`
      and click it (rather than `page.getByRole('radio', { name: 'Disabled'
      })`), and verify `npx playwright test completion-stats` still passes
      for the "turning the summary off" describe block.
- [x] 2.2 Review `src/frontend/e2e/completion-stats.spec.js` for any other
      reference to this setting's old `Enabled`/`Disabled` radio options and
      update to the checkbox role/name, verifying with
      `npx playwright test completion-stats`.
- [x] 2.3 Run the full e2e suite (`npx playwright test`) and verify
      `virtual-keyboard.spec.js` and the on-screen-keyboard assertions in
      `completion-stats.spec.js` are unaffected (they keep using `role:
      'radio'` for their own settings).

## 3. Verification

- [x] 3.1 Run the frontend unit test suite
      (`npm --prefix src/frontend run test:unit` or equivalent) and verify
      it passes unchanged, confirming no store or non-UI logic was touched.
- [x] 3.2 Run `openspec validate --change post-check-summary-checkbox
      --strict` and verify it passes with `skip_specs: true` and no delta
      specs.
