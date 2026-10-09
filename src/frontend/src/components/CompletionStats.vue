<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AnswerRowButton from './AnswerRowButton.vue'
import { typingElsewhere } from '../lib/editable'
import { useExerciseStore } from '../stores/exercise'
import { useStatsStore } from '../stores/stats'

// Overlays `AnswerInput.vue`'s answer-row and feedback row once a correct
// check has nothing left for either to do — see design.md, "Where the
// summary lives", for why that's an overlay rather than a swap. The
// on-screen keyboard, wherever `SentenceView.vue` puts it, is untouched:
// this component knows nothing about it.
//
// No audio control of its own: the hint row's `AudioPlayer.vue` (in
// `SentenceView.vue`) is retriggered instead of mounting a second copy here
// — see that component's own comment on `AudioPlayer`'s `:key`. A second
// instance of the same clip meant two independent `<audio>` elements that
// could each be playing at once, and two Play/Pause buttons for what read
// as one control.
const store = useExerciseStore()
const stats = useStatsStore()
const { t } = useI18n()

const nextButton = ref(null)

// One table row per counter. Each is both the counter's name in the stats
// store and its label's key under `stats.` in the locale files.
const counters = ['symbolsCorrect', 'keysPressed', 'exercisesCompleted']

/**
 * Advances on Enter, the same way the answer field's `@keyup.enter` used to
 * check the answer — but there is no field to attach that to any more, so
 * this listens on the document instead.
 *
 * `keyup`, matching the field's own listener, and not `keydown`: the field
 * is `invisible` rather than unmounted (see `AnswerInput.vue`) and keeps
 * focus through the swap, so the same physical Enter press still reaches
 * its `@keyup.enter`. Two different event types would fire as two separate
 * events with this component's own advance landing in between — `next()`
 * on `keydown`, then the field's stray `check()` on `keyup`, now checking
 * the *new* exercise's empty answer and reporting it incorrect. Sharing
 * `keyup` makes it one event instead: the field, as the actual target, runs
 * its handler first and re-confirms the old, already-correct answer (a
 * no-op — `check()` already guards against double-counting a repeat
 * confirmation), and only then does this bubble up and advance.
 *
 * Skipped when the Next button itself is focused: pressing Enter there
 * already triggers the button's own `@click` as the browser's native
 * activation behavior, and calling `next()` a second time here would skip
 * an extra exercise. Skipped, too, when Enter was pressed in some other text
 * field — a suggested translation, say — where it means a new line, not
 * "next".
 */
function onKeyup(event) {
  if (typingElsewhere(event)) return
  if (event.key === 'Enter' && document.activeElement !== nextButton.value?.$el) {
    store.next()
  }
}

onMounted(() => document.addEventListener('keyup', onKeyup))
onBeforeUnmount(() => document.removeEventListener('keyup', onKeyup))
</script>

<template>
  <!--
    The table and the Next button side by side, filling the reserved box
    `AnswerInput.vue` positions this in. Both are in flow: the table takes
    whatever width the button leaves and centres itself in it, so no margin
    has to guess how wide the button is in the current locale.
  -->
  <div class="flex h-full w-full items-start gap-2 md:gap-3" aria-live="polite">
    <div class="flex min-w-0 flex-1 justify-center">
      <!--
        A table, not prose lines: "Today" and "Last 7 days" are the same
        three counters over two windows, and a table says that at a glance.

        The counters are the rows and the two windows the columns, not the
        other way round: this has to fit a phone's reserved box as well as a
        laptop's, and on a phone it is the width that runs out. Three
        counter labels across the top ("Exercises completed", Hungarian's
        "Billentyűleütések") cannot share ~250px with the Next button; two
        window labels can, and the longer counter labels get the one column
        wide enough to hold them.

        Below `md` the height runs out too, so every line counts: the
        table spans the width the button leaves and the window headings
        (`w-0`) are as narrow as their longest word, so they are what
        breaks — "7 derniers / jours" costs one line once, where a counter
        label wrapped instead costs one on each of three rows. `min-w-12`
        stops a heading with no spaces to break at — Thai's — from being cut
        down to one word per line. The rows sit `leading-tight` with no
        spacing between them.
      -->
      <table
        class="w-full border-separate border-spacing-x-1.5 border-spacing-y-0 text-[11px] leading-tight sm:text-xs md:border-spacing-x-3 md:border-spacing-y-0.5 md:w-auto md:text-sm md:leading-normal"
      >
        <caption class="sr-only">{{ t('stats.caption') }}</caption>
        <thead>
          <tr>
            <td></td>
            <th scope="col" class="w-0 font-semibold text-(--text-h) md:w-auto md:whitespace-nowrap">
              <span class="block min-w-16 md:min-w-0">{{ t('stats.today') }}</span>
            </th>
            <th scope="col" class="w-0 font-semibold text-(--text-h) md:w-auto md:whitespace-nowrap">
              <span class="block min-w-16 md:min-w-0">{{ t('stats.last7Days') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="counter in counters" :key="counter">
            <th scope="row" class="text-left font-normal opacity-60">{{ t(`stats.${counter}`) }}</th>
            <td class="text-center font-medium text-(--text-h) tabular-nums">{{ stats.today[counter] }}</td>
            <td class="text-center font-medium text-(--text-h) tabular-nums">{{ stats.last7Days[counter] }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!--
      Level with where Check sits, whatever the table's own height: the
      button is centred in the box's first row only — the answer field's
      row — and never against the table. `pb-10` is what cuts this wrapper
      down to that row: the box is taller than it by exactly the feedback
      row's `h-8` plus the `gap-2` above it (`AnswerInput.vue`), 2.5rem.
      The right edge is the box's right edge, as Check's is, and
      `AnswerRowButton` makes the two the same size — so Next lands on
      Check's exact box. See design.md.
    -->
    <div class="flex self-stretch pb-10">
      <div class="flex items-center">
        <AnswerRowButton ref="nextButton" :label="t('stats.next')" glyph="→" @click="store.next()" />
      </div>
    </div>
  </div>
</template>
