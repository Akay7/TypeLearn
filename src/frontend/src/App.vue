<script setup>
import { onMounted } from 'vue'

import SentenceView from './components/SentenceView.vue'
import { useExerciseStore } from './stores/exercise'

const store = useExerciseStore()

onMounted(() => store.load())
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 px-6 py-4">
    <h1 class="text-sm font-medium tracking-[0.3em] uppercase opacity-60">TypeLearn</h1>
    <SentenceView />
  </main>
</template>
