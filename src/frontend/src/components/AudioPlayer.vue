<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  src: { type: String, required: true },
})

const audio = ref(null)

// True once the browser has refused to start the clip on its own. Local state,
// and the component is keyed on the exercise, so it re-derives itself every
// time: after the learner's first press the browser grants playback, the next
// exercise's automatic play succeeds, and the prompt does not come back.
const blocked = ref(false)

async function play() {
  // Rewind first, so pressing the control mid-clip replays it from the start
  // instead of resuming or doing nothing.
  audio.value.currentTime = 0

  try {
    await audio.value.play()
    blocked.value = false
  } catch (error) {
    // Autoplay policies differ across browsers and none of them are worth
    // predicting: attempt playback, and treat a refusal as a state to show.
    blocked.value = error.name === 'NotAllowedError'
    console.error('Could not play the clip:', error)
  }
}

// The exercise is something the learner is meant to hear before typing, so the
// clip starts itself. `SentenceView` keys this component on the exercise id, so
// a new exercise mounts a new player and this is all "play the current clip"
// needs to be — there is no stale `src` left to play by mistake.
onMounted(play)

// Advancing while a clip is still running would otherwise leave the old audio
// overlapping the new exercise's; teardown alone is not a promise of silence.
onBeforeUnmount(() => audio.value?.pause())
</script>

<template>
  <div class="relative flex items-center">
    <audio ref="audio" :src="src" preload="auto" />
    <button
      type="button"
      class="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white transition hover:bg-indigo-500"
      @click="play"
    >
      ▶ Play
    </button>

    <!-- Out of the flow, not merely beside the button: in the flow it would
         widen the row and shove the control off the page's centre line, which
         is the kind of movement this whole change exists to remove. -->
    <p
      v-if="blocked"
      class="absolute left-full ml-3 w-max text-sm opacity-60"
    >
      Press play to hear it
    </p>
  </div>
</template>
