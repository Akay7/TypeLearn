<script setup>
import { computed } from 'vue'

import AnswerInput from './AnswerInput.vue'
import AudioPlayer from './AudioPlayer.vue'
import ThaiKeyboard from './ThaiKeyboard.vue'
import { useExerciseStore } from '../stores/exercise'

const store = useExerciseStore()

// Spread rather than .length: the hint counts the characters a learner types,
// and every Thai vowel and tone mark is one of them.
const characterCount = computed(() =>
  store.current ? [...store.current.sentence].length : 0,
)
</script>

<template>
  <section class="flex flex-col items-center gap-6 text-center">
    <p v-if="store.status === 'loading'" class="text-lg opacity-60">
      Loading an exercise…
    </p>

    <p v-else-if="store.status === 'error'" class="text-lg text-red-500">
      Could not load an exercise. Is the backend running?
    </p>

    <p v-else-if="store.status === 'empty'" class="text-lg opacity-60">
      No exercises are available yet.
    </p>

    <template v-else>
      <p lang="th" class="text-5xl leading-relaxed font-medium">
        {{ store.current.sentence }}
      </p>

      <p class="text-sm tracking-wide uppercase opacity-60">
        {{ characterCount }} characters
      </p>

      <AudioPlayer :key="store.current.id" :src="store.current.audioUrl" />

      <AnswerInput />

      <ThaiKeyboard />
    </template>
  </section>
</template>
