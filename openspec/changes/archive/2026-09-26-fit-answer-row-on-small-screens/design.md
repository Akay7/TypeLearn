## Context

The answer row (`AnswerInput.vue`) reserves a box: the field-and-Check row plus the fixed-height verdict row under it. After a correct check, the summary (`CompletionStats.vue`) is laid over that box, so nothing around it moves (`practice-stats`: the summary replaces the answer field, the keyboard is undisturbed). On a 360px phone the box is about **312 × 98px**. On a 1280px laptop it's about **904 × 110px**.

Before this change:

```
360px phone — typing                  360px phone — summary
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ ┌──────────┐ ┌─────────────┐ │      │  Symbols   Key    Exe┌──────────────┐
│ │Type wha… │ │    Check    │ │   ay │  correct presses  co │Next exercise→│
│ └──────────┘ └─────────────┘ │   7  │    25      25      1 └──────────────┘
│   field ≈120px   pill 198px  │      │    25      25      1     │
└──────────────────────────────┘      └──────────────────────────────┘
                                        ↑ row headers pushed off-screen by
                                          `mr-48`; Next overlaps columns
```

## Goals / Non-Goals

**Goals:**
- Check leaves a phone's answer field most of the row.
- The summary's six totals fit the reserved box from 360px up, in all six interface languages.
- Next exercise lands exactly on Check's box at every width, in every language.

**Non-Goals:**
- Widths below 360px. At 320px the page still doesn't scroll sideways, but the fr/ru/hu/de summaries run ~12px past the box. No current mainstream phone is that narrow.
- The rest of the phone layout (the `text-5xl` sentence, the hint row, the keyboard's sideways scroll).
- Shorter translations. Every locale string stays as it is.

## Decisions

### The drawn layout

```
Phone, < md (768px) — typing
┌────────────────────────────────────────┐
│ ┌──────────────────────────────┐  ╭──╮ │
│ │ Type what you hear           │  │✓ │ │   48px circle, name "Check"
│ └──────────────────────────────┘  ╰──╯ │
│              (verdict row)             │
└────────────────────────────────────────┘

Phone, < md — summary (same box, same circle position)
┌────────────────────────────────────────┐
│                   Today  Last 7   ╭──╮ │
│                          days     │→ │ │   name "Next exercise →"
│ Symbols correct     25     25     ╰──╯ │
│ Key presses         25     25          │
│ Exercises completed  1      1          │
└────────────────────────────────────────┘

md and up — summary
┌──────────────────────────────────────────────────────────────┐
│               Today  Last 7 days       ┌──────────────────┐  │
│ Symbols correct  25      25            │ Next exercise →  │  │
│ Key presses      25      25            └──────────────────┘  │
│ Exercises completed 1     1                                  │
└──────────────────────────────────────────────────────────────┘
```

### One button component for Check and Next exercise

`AnswerRowButton.vue` renders both. Below `md` it's a `size-12` circle with a glyph, and the label is kept as `sr-only` text so the accessible name, and every test that finds the button by name, is unchanged. From `md` up it's a pill. Inside the pill, both labels (`answer.check`, `stats.next`) are stacked invisibly in the same CSS grid cell as the visible one, so the pill is exactly as wide as the wider label. Check and Next are therefore the same size by construction, in any language.

*Alternatives:* a larger fixed width (e.g. `w-64`) only moves the overflow point to the next long translation, and it costs the field width in every language. A per-locale width table can't be maintained through Weblate.

*Breakpoint `md`, not `sm`:* at 640px the Russian pill (~250px) plus the summary's widest table doesn't fit the 592px column. At 768px (720px column) every locale fits with room to spare.

### Transpose the table

Rows are counters, and the two windows are the columns. The width constraint is the phone's: three counter headings across the top ("Billentyűleütések", "Упражнений выполнено") can't share ~250px with the button, but "Today" and "Last 7 days" can. The extra row costs height the box has spare, once lines are tight.

### Phone-only density rules

Measured at 360px across en, de, fr, hu, ru and th:
- `text-[11px] leading-tight`, no vertical cell spacing. At 12px, fr and ru ran 7–22px over.
- Window headings get `w-0` so they wrap word by word ("7 derniers / jours" costs one line once, where a wrapped counter label costs a line on each row), plus a `min-w-16` floor so Thai, which breaks between words without spaces, isn't cut to one word per line.
- The table fills the width the button leaves (`w-full`), so the counter-label column gets all the slack.
- The counts get the heading colour and `font-medium`, since they're the point of the summary.

### In-flow layout instead of `mr-48`

The table (centred in `flex-1`) and the button's wrapper now sit side by side in one flex row. The wrapper stretches to the box's height minus `pb-10` (the verdict row's `h-8` plus `gap-2`), so the button is centred on the field's row, exactly where Check is, without the table's height affecting it. This keeps the old `bottom-10` reasoning and drops the margin that had to guess the button's width.

## Risks / Trade-offs

- [11px text on phones is small] → Only the six totals and their labels use it, the counts are emphasised, and it's the only size that fits fr and ru at 360px without cutting a label.
- [A future translation longer than today's could overflow on phones] → The e2e suite checks the summary's bounds at 360px in every locale, so a translation update that breaks the layout fails CI.
- [Icon-only controls are less self-explanatory] → ✓ and → are the conventional glyphs for these actions, and a correct answer is also auto-checked, so Check is rarely needed. Screen readers still get the full label.
