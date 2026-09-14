<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  src: { type: String, required: true },
})

const audio = ref(null)

// True once the browser has refused to start the clip on its own. Local state,
// and the component is keyed on the exercise, so it re-derives itself every
// time: after the learner's first press the browser grants playback, the next
// exercise's automatic play succeeds, and the prompt does not come back.
const blocked = ref(false)

// Mirrors the `<audio>` element's own state via its `play`/`pause`/`ended`
// events, rather than being set only where this component calls `.play()`
// or `.pause()` itself — so the control's label is correct even when
// playback starts or stops for a reason this component didn't initiate.
const playing = ref(false)

async function attemptPlay() {
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

/** Only ever called once, on mount: the exercise's own clip, from the start. */
function playFromStart() {
  audio.value.currentTime = 0
  return attemptPlay()
}

/**
 * The control's click handler. While the clip is playing, the control reads
 * as Pause and this just pauses it in place. Otherwise it plays — rewinding
 * first only if the clip already reached its end, so a clip paused partway
 * through resumes from there instead of restarting, and a clip that finished
 * on its own starts over.
 */
function toggle() {
  if (playing.value) {
    audio.value.pause()
    return
  }

  if (audio.value.ended) {
    audio.value.currentTime = 0
  }

  return attemptPlay()
}

// The exercise is something the learner is meant to hear before typing, so the
// clip starts itself. `SentenceView` keys this component on the exercise id, so
// a new exercise mounts a new player and this is all "play the current clip"
// needs to be — there is no stale `src` left to play by mistake.
onMounted(playFromStart)

// Advancing while a clip is still running would otherwise leave the old audio
// overlapping the new exercise's; teardown alone is not a promise of silence.
onBeforeUnmount(() => audio.value?.pause())
</script>

<template>
  <div class="relative flex flex-col items-center gap-1.5 sm:flex-row sm:gap-0">
    <audio
      ref="audio"
      :src="src"
      preload="auto"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
    />
    <button
      type="button"
      class="inline-flex w-32 items-center justify-center whitespace-nowrap rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white transition hover:bg-indigo-500"
      @click="toggle"
    >
      {{ playing ? t('audio.pause') : t('audio.play') }}
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
      {{ t('audio.autoplayBlocked') }}
    </p>
  </div>
</template>
