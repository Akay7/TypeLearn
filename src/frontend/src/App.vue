<script setup>
import { onMounted } from 'vue'

import SentenceView from './components/SentenceView.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import { useExerciseStore } from './stores/exercise'

const store = useExerciseStore()

onMounted(() => store.load())
</script>

<template>
  <main class="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 px-6 py-4">
    <!-- Positioned rather than laid out beside the title: the title's row
         already has to stay as short as "the exercise fits on one screen"
         needs, and a 40px control sitting in that row would cost every
         viewport that height whether or not the menu is ever opened. -->
    <SettingsMenu class="absolute top-4 right-6" />
    <h1 class="text-sm font-medium tracking-[0.3em] uppercase opacity-60">TypeLearn</h1>
    <SentenceView />
  </main>
</template>
