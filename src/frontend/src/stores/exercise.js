import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { compare, dropLast, isComplete } from '../lib/checking'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/graphql/'

// The whole catalog, in one request. It is 100 rows, and fetching it up front
// is what makes advancing to the next exercise cost nothing: the moment after a
// green result is the worst possible time to show a loading state.
const CATALOG_QUERY = `
  query Catalog {
    exercises {
      id
      sentence
      audioUrl
      difficulty
    }
  }
`

// How long the verdict stays on screen before the next exercise replaces it.
const ADVANCE_DELAY_MS = 900

/** Fisher-Yates, in place: every ordering equally likely, no sort comparator abuse. */
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

export const useExerciseStore = defineStore('exercise', () => {
  // The catalog in the order this session will practise it, and where we are in
  // it. Shuffled once at load, so no exercise repeats until it wraps.
  const deck = ref([])
  const index = ref(0)
  // 'loading' | 'ready' | 'error' | 'empty' — what the view renders.
  const status = ref('loading')

  const typed = ref('')
  // null until the learner checks; then 'correct' or 'incorrect'.
  const result = ref(null)

  const current = computed(() => deck.value[index.value] ?? null)

  // Held so that whatever advances first — the timer or a later call to next()
  // — is the only advance that happens.
  let advanceTimer = null

  function cancelAdvance() {
    if (advanceTimer !== null) {
      clearTimeout(advanceTimer)
      advanceTimer = null
    }
  }

  async function load() {
    status.value = 'loading'

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: CATALOG_QUERY }),
      })

      if (!response.ok) {
        throw new Error(`The backend responded ${response.status}`)
      }

      const body = await response.json()

      // A GraphQL error arrives as HTTP 200 with an `errors` array, so checking
      // response.ok alone would report success on a broken query.
      if (body.errors?.length) {
        throw new Error(body.errors[0].message)
      }

      deck.value = shuffle([...body.data.exercises])
      index.value = 0
      typed.value = ''
      result.value = null
      status.value = deck.value.length ? 'ready' : 'empty'
    } catch (error) {
      console.error('Could not load the exercises:', error)
      deck.value = []
      status.value = 'error'
    }
  }

  function append(char) {
    typed.value += char
  }

  function backspace() {
    typed.value = dropLast(typed.value)
  }

  // Every way of changing the answer ends here — on-screen keys through
  // `append`, the physical keyboard through the input's `v-model` — so this is
  // the one place that sees all typing. Two things follow from every change:
  // the previous verdict described an older answer and has to go, and an answer
  // that has reached the target's length is a finished attempt worth judging
  // without the learner having to ask.
  watch(typed, () => {
    result.value = null

    if (current.value && isComplete(typed.value, current.value.sentence)) {
      check()
    }
  })

  function check() {
    if (!current.value) {
      return
    }

    // Whatever this check decides replaces the last one, including its pending
    // advance: a correct answer typed one character too far must not still be
    // carried forward by the timer the correct answer scheduled.
    cancelAdvance()

    const correct = compare(typed.value, current.value.sentence)
    result.value = correct ? 'correct' : 'incorrect'

    // Checking is client-side for the MVP: nothing is sent, no Progress row is
    // written. Only the move to the next exercise happens on its own.
    if (correct) {
      advanceTimer = setTimeout(next, ADVANCE_DELAY_MS)
    }
  }

  /**
   * Present the next exercise, wrapping to the start when the deck runs out.
   * Everything belonging to the previous exercise is cleared here, so no
   * component has to remember to reset itself.
   */
  function next() {
    cancelAdvance()

    if (!deck.value.length) {
      return
    }

    index.value = (index.value + 1) % deck.value.length
    typed.value = ''
    result.value = null
  }

  return { deck, index, current, status, typed, result, load, append, backspace, check, next }
})
