<script setup>
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { MAX_TRANSLATION_LENGTH, useTranslationStore } from '../stores/translation'
import { useExerciseStore } from '../stores/exercise'

const translation = useTranslationStore()
const exercise = useExerciseStore()
const { t } = useI18n()

// Clamped to two lines until the learner asks for the rest: the panel sits
// between the sentence and the keyboard, and a long translation should not
// push the keys down mid-exercise.
const expanded = ref(false)
const formOpen = ref(false)
const draft = ref('')
const sending = ref(false)
// An i18n key: the last thing to tell the learner about rating or suggesting.
const message = ref(null)
const thanked = ref(false)
const textarea = ref(null)

// Everything here belongs to one exercise in one language.
watch(
  () => [exercise.current?.id, translation.language],
  () => {
    expanded.value = false
    formOpen.value = false
    draft.value = ''
    message.value = null
    thanked.value = false
  },
)

async function openForm() {
  formOpen.value = true
  thanked.value = false
  message.value = null
  await nextTick()
  textarea.value?.focus()
}

function closeForm() {
  formOpen.value = false
  draft.value = ''
  message.value = null
}

async function rate(value) {
  message.value = await translation.rate(value)
}

async function submit() {
  if (sending.value) return
  sending.value = true
  const error = await translation.propose(draft.value)
  sending.value = false
  if (error) {
    message.value = error
    return
  }
  closeForm()
  thanked.value = true
}
</script>

<template>
  <div v-if="translation.active" class="flex w-full max-w-[var(--board)] flex-col items-center gap-1.5 text-center">
    <p v-if="translation.state === 'loading'" class="min-h-8 text-base opacity-50">
      {{ t('translation.loading') }}
    </p>

    <p v-else-if="translation.state === 'error'" class="min-h-8 text-base opacity-50">
      {{ t('translation.unavailable') }}
    </p>

    <!-- The same reserved height in every state, so the keyboard below stays
         put while a translation arrives or an exercise has none. -->
    <div v-else class="flex min-h-8 w-full items-center justify-center gap-2">
      <template v-if="translation.state === 'ready'">
        <!-- A button so the whole translation is reachable by keyboard, not
             only by tapping clamped text. Marked with its language, the way
             the sentence above is marked Thai. -->
        <button
          type="button"
          :lang="translation.language"
          :aria-expanded="expanded"
          :title="translation.current.origin === 'MACHINE' ? t('translation.machine') : undefined"
          :class="['min-w-0 text-left text-lg leading-snug opacity-80', expanded ? '' : 'line-clamp-2']"
          @click="expanded = !expanded"
        >
          {{ translation.current.text }}
        </button>

        <div class="flex shrink-0 gap-1">
          <button
            v-for="choice in [
              { value: 'UP', glyph: '👍', label: t('translation.rateGood') },
              { value: 'DOWN', glyph: '👎', label: t('translation.rateBad') },
            ]"
            :key="choice.value"
            type="button"
            :aria-label="choice.label"
            :aria-pressed="translation.currentRating === choice.value"
            :class="[
              'flex size-8 items-center justify-center rounded-full text-sm transition-colors',
              translation.currentRating === choice.value
                ? 'bg-indigo-600/15 ring-1 ring-indigo-600/40'
                : 'opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10',
            ]"
            @click="rate(choice.value)"
          >
            {{ choice.glyph }}
          </button>
        </div>
      </template>

      <p v-else class="text-base opacity-60">{{ t('translation.none') }}</p>
    </div>

    <form v-if="formOpen" class="flex w-full flex-col gap-2" @submit.prevent="submit">
      <!-- Enter inserts a line; Ctrl/Cmd+Enter sends. `.stop` keeps the
           keystroke from bubbling up to the document-level Enter handling
           the exercise uses to advance. -->
      <textarea
        ref="textarea"
        v-model="draft"
        :lang="translation.language"
        rows="2"
        :maxlength="MAX_TRANSLATION_LENGTH"
        :placeholder="t('translation.placeholder')"
        :aria-label="t('translation.placeholder')"
        class="w-full resize-y rounded-lg border border-black/20 bg-black/5 p-2 text-base outline-none focus:border-indigo-500 dark:border-white/20 dark:bg-white/5"
        @keydown.stop
        @keyup.stop
        @keydown.enter.ctrl.exact.prevent="submit"
        @keydown.enter.meta.exact.prevent="submit"
      />
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-full px-3 py-1 text-sm opacity-70 hover:bg-black/5 dark:hover:bg-white/10"
          @click="closeForm"
        >
          {{ t('translation.cancel') }}
        </button>
        <button
          type="submit"
          :disabled="sending"
          class="rounded-full bg-indigo-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          {{ t('translation.submit') }}
        </button>
      </div>
    </form>

    <button
      v-else
      type="button"
      class="text-sm text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
      @click="openForm"
    >
      {{ translation.state === 'ready' ? t('translation.suggestBetter') : t('translation.suggest') }}
    </button>

    <p v-if="message || thanked" class="text-sm" :class="message ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'" aria-live="polite">
      {{ message ? t(message) : t('translation.thanks') }}
    </p>
  </div>
</template>
