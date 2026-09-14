<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import SentenceView from './components/SentenceView.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import { useExerciseStore } from './stores/exercise'

const REPOSITORY_URL = 'https://github.com/Akay7/TypeLearn'

const store = useExerciseStore()
const { t } = useI18n()

onMounted(() => store.load())
</script>

<template>
  <div class="relative">
    <main class="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 px-6 py-4">
      <!-- Positioned rather than laid out beside the title: the title's row
           already has to stay as short as "the exercise fits on one screen"
           needs, and a 40px control sitting in that row would cost every
           viewport that height whether or not the menu is ever opened. -->
      <SettingsMenu class="absolute top-4 right-6" />
      <h1 class="text-sm font-medium tracking-[0.3em] uppercase opacity-60">TypeLearn</h1>
      <SentenceView />
    </main>

    <!-- Positioned for the same reason as the settings button: a row under the
         exercise would push the keyboard below the fold on a laptop screen.
         Pinned to the bottom edge instead, one `leading-4` line tall — exactly
         `main`'s `py-4` bottom padding — so when the exercise is taller than
         the screen the footer sits in that padding rather than over the
         keyboard legend. The link opens a new tab so an exercise in progress
         is not lost. -->
    <footer class="absolute inset-x-0 bottom-0 flex justify-center text-xs leading-4 opacity-60">
      <a :href="REPOSITORY_URL" target="_blank" rel="noopener noreferrer" class="hover:text-(--text-h) hover:underline">
        {{ t('footer.source') }}
      </a>
    </footer>
  </div>
</template>
