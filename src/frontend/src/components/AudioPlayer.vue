<script setup>
import { ref } from 'vue'

defineProps({
  src: { type: String, required: true },
})

const audio = ref(null)

function play() {
  // Rewind first, so pressing the control mid-clip replays it from the start
  // instead of resuming or doing nothing.
  audio.value.currentTime = 0
  audio.value.play().catch((error) => {
    console.error('Could not play the clip:', error)
  })
}
</script>

<template>
  <div>
    <audio ref="audio" :src="src" preload="auto" />
    <button
      type="button"
      class="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white transition hover:bg-indigo-500"
      @click="play"
    >
      ▶ Play
    </button>
  </div>
</template>
