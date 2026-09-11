<script setup>
import { onMounted, ref } from 'vue'

import { useExerciseStore } from '../stores/exercise'
import { useSettingsStore } from '../stores/settings'

const store = useExerciseStore()
const settings = useSettingsStore()

const field = ref(null)

// The learner should be able to start typing on their own keyboard without
// clicking first; the on-screen keys are careful not to steal this focus.
onMounted(() => field.value?.focus())
</script>

<template>
  <div class="flex w-full max-w-[var(--board)] flex-col items-center gap-2">
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

      <button
        type="button"
        class="shrink-0 rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white transition hover:bg-indigo-500"
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
</template>
