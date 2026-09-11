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
  <div class="relative flex flex-col items-center gap-1.5 sm:flex-row sm:gap-0">
    <audio ref="audio" :src="src" preload="auto" />
    <button
      type="button"
      class="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white transition hover:bg-indigo-500"
      @click="play"
    >
      ▶ Play
    </button>

    <!-- Below the button, in normal flow, on a phone-width screen: it only
         adds height there, never width, so the button never shifts
         sideways, and whatever sits below this component (AnswerInput) is
         pushed down by exactly the room the prompt needs instead of being
         overlapped by it — the earlier absolute-positioned version left it
         overlapping AnswerInput once it was no longer off to the side.
         From `sm` up (the same phone/tablet line `lib/device.js`
         classifies on) there is room to the side instead, so it goes back
         to sitting there, out of flow: in the flow at that width it would
         widen the row and shove the button off the page's centre line,
         which is the kind of movement this whole change exists to remove. -->
    <p
      v-if="blocked"
      class="text-center text-sm opacity-60 sm:absolute sm:top-1/2 sm:left-full sm:ml-3 sm:w-max sm:-translate-y-1/2 sm:text-left"
    >
      Press play to hear it
    </p>
  </div>
</template>
