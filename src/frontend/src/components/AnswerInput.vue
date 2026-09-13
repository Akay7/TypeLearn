<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import CompletionStats from './CompletionStats.vue'
import { useExerciseStore } from '../stores/exercise'
import { useSettingsStore } from '../stores/settings'

const store = useExerciseStore()
const settings = useSettingsStore()

const field = ref(null)

// The learner should be able to start typing on their own keyboard without
// clicking first; the on-screen keys are careful not to steal this focus.
onMounted(() => field.value?.focus())

// The field stays mounted (see below) rather than being remounted for each
// exercise, so this is what gives a fresh exercise focus the same way the
// very first one gets it on mount — including every time the field becomes
// visible again after the summary below. `nextTick` first: this watcher's
// default ('pre') flush runs before Vue has patched the DOM, so focusing
// immediately would still find the field `invisible` from the exercise the
// learner is leaving, and silently do nothing.
watch(
  () => store.current?.id,
  async () => {
    await nextTick()
    field.value?.focus()
  },
)

const showingSummary = computed(() => store.result === 'correct' && settings.showCompletionStats)
</script>

<template>
  <div class="relative flex w-full max-w-[var(--board)] flex-col items-center gap-2">
    <!--
      The field and Check button stay mounted at all times — merely
      `invisible` once the summary takes over — rather than being swapped
      out for it. `invisible` (not `v-if`) is what makes this a *reserved*
      box: its rendered height depends on the field's own font size and
      padding, which the summary's smaller pill buttons don't naturally
      match, and guessing a pixel value to force them level risks exactly
      the layout shift this exists to prevent. Reserving the real box
      instead — the same idiom the feedback row's fixed `h-8` already uses
      one level down — sidesteps needing to know that number at all. See
      design.md, "Where the summary lives".
    -->
    <div class="flex w-full flex-col items-center gap-2" :class="{ invisible: showingSummary }">
      <!-- The control sits beside the field rather than under it: a row costs the
           page vertical space, and every row spent above the keyboard is one that
           pushes it towards the bottom of the screen. -->
      <div class="flex w-full items-center gap-3">
        <!-- A plain v-model: the browser already handles physical typing,
             backspace, selection, paste, and IME composition correctly, and
             intercepting keys here would break composition to reimplement it. -->
        <!-- inputmode="none" keeps the OS virtual keyboard from covering the
             on-screen one without disabling the field: it stays focusable,
             editable, and a physical keyboard still types into it exactly as
             inputmode="text" would. -->
        <input
          ref="field"
          v-model="store.typed"
          lang="th"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :inputmode="settings.virtualKeyboardEnabled ? 'text' : 'none'"
          placeholder="Type what you hear"
          class="w-full rounded-lg border border-black/20 bg-black/5 p-3 text-2xl outline-none focus:border-indigo-500 dark:border-white/20 dark:bg-white/5"
          @keyup.enter="store.check()"
        />

        <!--
          `w-44`, matching `CompletionStats.vue`'s Next-exercise button
          exactly: that button is pinned to this one's own corner of the
          reserved box once the summary shows, so the two have to agree on
          size as well as position, or swapping between "Check" and "Next
          exercise →" would still visibly resize the button even with its
          position now fixed.
        -->
        <button
          type="button"
          class="w-44 shrink-0 rounded-full bg-indigo-600 px-6 py-3 text-base font-medium whitespace-nowrap text-white transition hover:bg-indigo-500"
          @click="store.check()"
        >
          Check
        </button>
      </div>

      <!-- Always rendered, at a height that holds either verdict: the keyboard's
           whole argument is that the highlighted key sits where the finger goes,
           and a verdict that pushed it down would break that at the moment the
           learner is most dependent on it. The expected sentence is not repeated
           here — SentenceView has been showing it at text-5xl the whole time. -->
      <div class="flex h-8 items-center" aria-live="polite">
        <p v-if="store.result === 'correct'" class="text-lg font-semibold text-green-600 dark:text-green-400">
          ✓ Correct
        </p>

        <p v-else-if="store.result === 'incorrect'" class="text-lg font-semibold text-red-600 dark:text-red-400">
          ✗ Incorrect — try again
        </p>
      </div>
    </div>

    <!--
      Positioned over the box above rather than in normal flow, so its own
      (shorter) content never has to match that box's height for the column
      not to move. `justify-start`, not `justify-center`: the table's own
      top edge lines up with the answer field's, the same way the Next
      exercise button inside `CompletionStats.vue` is pinned to Check's row
      rather than centered — centering left it floating with dead space
      above it instead of sitting level with the rest of the row.
    -->
    <div v-if="showingSummary" class="absolute inset-0 flex w-full flex-col items-center justify-start gap-2">
      <CompletionStats />
    </div>
  </div>
</template>
