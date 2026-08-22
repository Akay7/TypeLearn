<script setup>
import { onMounted } from 'vue'

import SentenceView from './components/SentenceView.vue'
import { useExerciseStore } from './stores/exercise'

const store = useExerciseStore()

onMounted(() => store.load())
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-10 px-6">
    <h1 class="text-sm font-medium tracking-[0.3em] uppercase opacity-60">TypeLearn</h1>
    <SentenceView />
  </main>
</template>
