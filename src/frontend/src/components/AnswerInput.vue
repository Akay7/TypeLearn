<script setup>
import { onMounted, ref } from 'vue'

import { useExerciseStore } from '../stores/exercise'

const store = useExerciseStore()

const field = ref(null)

// The learner should be able to start typing on their own keyboard without
// clicking first; the on-screen keys are careful not to steal this focus.
onMounted(() => field.value?.focus())
</script>

<template>
  <div class="flex w-full flex-col items-center gap-4">
    <!-- A plain v-model: the browser already handles physical typing,
         backspace, selection, paste, and IME composition correctly, and
         intercepting keys here would break composition to reimplement it. -->
    <input
      ref="field"
      v-model="store.typed"
      lang="th"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="Type what you hear"
      class="w-full rounded-lg border border-black/20 bg-black/5 p-4 text-2xl outline-none focus:border-indigo-500 dark:border-white/20 dark:bg-white/5"
      @keyup.enter="store.check()"
    />

    <button
      type="button"
      class="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white transition hover:bg-indigo-500"
      @click="store.check()"
    >
      Check
    </button>

    <p v-if="store.result === 'correct'" class="text-lg font-semibold text-green-600 dark:text-green-400">
      ✓ Correct
    </p>

    <div v-else-if="store.result === 'incorrect'" class="flex flex-col items-center gap-1">
      <p class="text-lg font-semibold text-red-600 dark:text-red-400">✗ Incorrect — try again</p>
      <p class="text-sm opacity-60">Expected</p>
      <p lang="th" class="text-2xl">{{ store.current.sentence }}</p>
    </div>
  </div>
</template>
