<script setup>
import { computed } from 'vue'

import AnswerInput from './AnswerInput.vue'
import AudioPlayer from './AudioPlayer.vue'
import OnScreenKeyboard from './OnScreenKeyboard.vue'
import { useExerciseStore } from '../stores/exercise'
import { useSettingsStore } from '../stores/settings'

const store = useExerciseStore()
const settings = useSettingsStore()

// Spread rather than .length: the hint counts the symbols a learner types,
// and every Thai vowel and tone mark is one of them.
const symbolCount = computed(() =>
  store.current ? [...store.current.sentence].length : 0,
)
</script>

<template>
  <section class="flex w-full flex-col items-center gap-3 text-center">
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
      <!-- Tight leading, not relaxed: a sentence is one or two lines and the
           space under it is better spent on the keyboard. -->
      <p lang="th" class="text-5xl leading-tight font-medium">
        {{ store.current.sentence }}
      </p>

      <!-- The hint and the clip share a row. Neither is tall, and the whole
           exercise has to fit on a laptop screen without the learner scrolling
           to find the keys their fingers are supposed to be on. -->
      <div class="flex items-center gap-4">
        <p class="text-sm tracking-wide uppercase opacity-60">
          {{ symbolCount }} symbols
        </p>

        <!--
          Keyed by the exercise id *and* whether the summary is showing for
          it, not the id alone: the summary plays this same clip again (see
          `CompletionStats.vue`'s own comment) rather than mounting a second
          control, and this is what makes that happen — the key changing
          from `id:false` to `id:true` on a correct check (with the setting
          on) destroys and remounts the component, which retriggers its
          autoplay-on-mount the same way a fresh exercise does. An incorrect
          check, or a correct one with the setting off, leaves the key (and
          the clip) alone.
        -->
        <AudioPlayer
          :key="`${store.current.id}:${store.result === 'correct' && settings.showCompletionStats}`"
          :src="store.current.audioUrl"
        />
      </div>

      <AnswerInput />

      <!-- The layout the exercise is practised on, chosen by its language.
           Hidden rather than unmounted when the learner turns it off, would
           cost nothing here since it holds no state of its own worth keeping
           — but v-if is simpler and the layer/scroll state resetting on
           re-show is the right behavior anyway, the same as a new exercise
           gets. -->
      <OnScreenKeyboard v-if="settings.onScreenKeyboardVisible" :layout="store.layout" />
    </template>
  </section>
</template>
