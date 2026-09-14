<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

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
 * an extra exercise.
 */
function onKeyup(event) {
  if (event.key === 'Enter' && document.activeElement !== nextButton.value) {
    store.next()
  }
}

onMounted(() => document.addEventListener('keyup', onKeyup))
onBeforeUnmount(() => document.removeEventListener('keyup', onKeyup))
</script>

<template>
  <!--
    A table, not two prose lines: "Today" and "Last 7 days" are the same
    three counters over two windows, and a table says that at a glance —
    one column heading per counter instead of repeating "symbols correct" /
    "key presses" / "exercises completed" on every row.
  -->
  <div class="flex w-full items-center justify-center" aria-live="polite">
    <table class="mr-48 border-separate border-spacing-x-3 border-spacing-y-1 text-sm">
      <caption class="sr-only">{{ t('stats.caption') }}</caption>
      <thead>
        <tr class="text-xs font-normal opacity-60">
          <th scope="col"></th>
          <th scope="col" class="font-normal">{{ t('stats.symbolsCorrect') }}</th>
          <th scope="col" class="font-normal">{{ t('stats.keysPressed') }}</th>
          <th scope="col" class="font-normal">{{ t('stats.exercisesCompleted') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" class="pr-2 text-left font-semibold text-(--text-h)">{{ t('stats.today') }}</th>
          <td class="text-center tabular-nums">{{ stats.today.symbolsCorrect }}</td>
          <td class="text-center tabular-nums">{{ stats.today.keysPressed }}</td>
          <td class="text-center tabular-nums">{{ stats.today.exercisesCompleted }}</td>
        </tr>
        <tr>
          <th scope="row" class="pr-2 text-left font-semibold text-(--text-h)">{{ t('stats.last7Days') }}</th>
          <td class="text-center tabular-nums">{{ stats.last7Days.symbolsCorrect }}</td>
          <td class="text-center tabular-nums">{{ stats.last7Days.keysPressed }}</td>
          <td class="text-center tabular-nums">{{ stats.last7Days.exercisesCompleted }}</td>
        </tr>
      </tbody>
    </table>

    <!--
      Pinned to the exact corner Check occupies against `AnswerInput.vue`'s
      reserved box (the nearest positioned ancestor, its `absolute inset-0`
      overlay wrapper) — rather than laid out beside or inside the table.
      Deriving the button's position from the table's own rows (a flex
      sibling centered against it, or a rowspan cell within it) meant its
      position moved whenever the table's height did; pinning it to a fixed
      corner, independent of the table entirely, is what makes it land
      exactly where Check was, every time — see design.md.

      `bottom-10` rather than `inset-y-0`: `top-0` alone would size this
      wrapper to the *whole* reserved box, but Check sits only within that
      box's first row (beside the answer field), a row shorter than the box
      itself by exactly the feedback row's `h-8` plus the `gap-2` above it
      (`AnswerInput.vue`) — 36px + 9px at this project's 18px root, i.e.
      `bottom-10` (2.5rem = 45px). Stopping this wrapper's bottom edge there
      gives it that same first-row height, so `items-center` centers the
      button in it exactly the way the field's own height centers Check —
      rather than guessing the pixel gap between their two different font
      sizes directly.
    -->
    <div class="absolute top-0 right-0 bottom-10 flex items-center">
      <!--
        `w-44` matches Check's own fixed width (added there for the same
        reason): two different labels ("Check" / "Next exercise →") in one
        matching box, so the button is not just in the same place but the
        same size, whichever it reads.
      -->
      <button
        ref="nextButton"
        type="button"
        class="w-44 shrink-0 rounded-full bg-indigo-600 px-6 py-3 text-base font-medium whitespace-nowrap text-white transition hover:bg-indigo-500"
        @click="store.next()"
      >
        {{ t('stats.next') }}
      </button>
    </div>
  </div>
</template>
