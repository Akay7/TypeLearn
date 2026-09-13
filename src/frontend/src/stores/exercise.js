import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { compare, dropLast, isComplete, nextExpected } from '../lib/checking'
import { layoutFor, layoutsAvailable, withoutUnreachable } from '../lib/keyboard'
import { useSettingsStore } from './settings'
import { useStatsStore } from './stats'

// A path, never a URL. The application is served from one origin in every
// environment — behind the Gateway in the cluster and in a deployment, and
// behind the dev server's proxy when the frontend runs on the host — so the
// backend is always reachable at a path on the current origin. An absolute URL
// here would be a second origin, and the backend carries no CORS configuration
// to make one work.
const API_URL = import.meta.env.VITE_API_URL ?? '/graphql/'

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
  const settingsStore = useSettingsStore()
  const statsStore = useStatsStore()

  // The catalog in the order this session will practise it, and where we are in
  // it. Shuffled once at load, so no exercise repeats until it wraps.
  const deck = ref([])
  const index = ref(0)
  // 'loading' | 'ready' | 'error' | 'empty' — what the view renders.
  const status = ref('loading')

  const typed = ref('')
  // null until the learner checks; then 'correct' or 'incorrect'.
  const result = ref(null)

  /** The exercise as it was ingested, before the keyboard has its say. */
  const ingested = computed(() => deck.value[index.value] ?? null)

  /**
   * The keyboard the exercise is practised on, chosen by its language.
   *
   * Nothing carries a language yet, so this is Kedmanee for every exercise —
   * see `lib/keyboard/index.js` for why that question is still open. The
   * selection happens here because this is where the exercise is, and because
   * the correction below has to be made against the same layout the learner is
   * looking at.
   */
  const layout = computed(() => layoutFor(ingested.value?.language))

  /**
   * The exercise being practised, with only the characters no keyboard at all
   * can produce removed.
   *
   * Almost nothing is removed. A `!` stays, though Kedmanee has no key for it,
   * because the keyboard reaches it the way a Thai typist does — by switching
   * to the Latin layout — and a sentence shown differently from the one that
   * was ingested is a worse answer than a keyboard that switches. What goes is
   * only what is on no board this application has: an emoji, a CJK character,
   * a typographic dash.
   *
   * Still at presentation rather than in the catalog: the stored sentence stays
   * as the corpus wrote it, and registering another layout takes effect on the
   * next page load instead of needing every exercise re-ingested.
   *
   * Here rather than at each call site, so the sentence on screen, the length
   * hint, the check, the completion trigger and the keyboard's highlight are
   * one string. A version corrected for checking but not for display would ask
   * the learner to type a character that is on screen and on no key.
   */
  const current = computed(() => {
    if (!ingested.value) {
      return null
    }

    return {
      ...ingested.value,
      sentence: withoutUnreachable(ingested.value.sentence, layoutsAvailable(layout.value)),
    }
  })

  // Held so that whatever advances first — the timer or a later call to next()
  // — is the only advance that happens.
  let advanceTimer = null

  function cancelAdvance() {
    if (advanceTimer !== null) {
      clearTimeout(advanceTimer)
      advanceTimer = null
    }
  }

  // Guards the `typed` watcher below against counting a programmatic reset —
  // advancing to the next exercise, loading a fresh deck — as backspacing by
  // hand. `flush: 'sync'` on that watcher is what makes toggling this flag
  // around the assignment reliable: the watcher runs within this same
  // synchronous call, before the flag is lowered again.
  let resettingTyped = false

  function resetTyped() {
    resettingTyped = true
    typed.value = ''
    resettingTyped = false
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

      // An exercise whose sentence holds nothing any keyboard can type is not
      // an exercise: presented, it would be complete before the learner typed
      // anything. Dropped here rather than hidden later, so the deck is the
      // list of things there are to practise.
      const practisable = body.data.exercises.filter(
        (exercise) =>
          withoutUnreachable(
            exercise.sentence,
            layoutsAvailable(layoutFor(exercise.language)),
          ) !== '',
      )

      deck.value = shuffle(practisable)
      index.value = 0
      resetTyped()
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

  /**
   * Counts one keystroke change, and any newly-typed characters that were
   * correct at the moment they were typed.
   *
   * The key-press count is the raw length delta — 1 for the overwhelmingly
   * common case of one character appended or removed, but never assumed to
   * be exactly 1, so a wrong key immediately corrected still counts as two
   * presses and zero correct symbols. Each newly-appended character (never
   * on a deletion) is checked against `nextExpected` — the same next-key
   * logic the keyboard's own highlight already uses — one character at a
   * time against the prefix as it stood before that character, so a run of
   * several new characters (a paste, in the rare case) is judged position by
   * position rather than all against the answer's very first character.
   */
  function recordKeystrokeStats(oldTyped, newTyped) {
    const oldChars = [...oldTyped]
    const newChars = [...newTyped]

    statsStore.recordKeyPress(Math.abs(newChars.length - oldChars.length))

    if (newChars.length <= oldChars.length || !current.value) {
      return
    }

    let correct = 0
    let prefix = oldTyped

    for (let i = oldChars.length; i < newChars.length; i += 1) {
      if (newChars[i] === nextExpected(prefix, current.value.sentence)) {
        correct += 1
      }
      prefix += newChars[i]
    }

    if (correct > 0) {
      statsStore.recordCorrectSymbols(correct)
    }
  }

  // Every way of changing the answer ends here — on-screen keys through
  // `append`, the physical keyboard through the input's `v-model` — so this is
  // the one place that sees all typing. Three things follow from every change,
  // skipped only for the programmatic reset `resetTyped` guards against: the
  // keystroke (and any correct symbols) is recorded for the stats display; the
  // previous verdict described an older answer and has to go; and an answer
  // that has reached the target's length is a finished attempt worth judging
  // without the learner having to ask. `flush: 'sync'` is what makes that guard
  // reliable — see `resetTyped`.
  watch(
    typed,
    (newTyped, oldTyped) => {
      if (resettingTyped) {
        return
      }

      recordKeystrokeStats(oldTyped, newTyped)

      result.value = null

      if (current.value && isComplete(newTyped, current.value.sentence)) {
        check()
      }
    },
    { flush: 'sync' },
  )

  function check() {
    if (!current.value) {
      return
    }

    // Whatever this check decides replaces the last one, including its pending
    // advance: a correct answer typed one character too far must not still be
    // carried forward by the timer the correct answer scheduled.
    cancelAdvance()

    const correct = compare(typed.value, current.value.sentence)
    // Caught before overwriting `result`: with the summary off, the Check
    // control stays live during the delay before auto-advance, and pressing
    // it again while already correct must re-confirm the same verdict rather
    // than counting a second completion for the one exercise.
    const wasAlreadyCorrect = result.value === 'correct'
    result.value = correct ? 'correct' : 'incorrect'

    // Checking is client-side for the MVP: nothing is sent, no Progress row is
    // written. Only the move to the next exercise happens on its own.
    if (correct) {
      if (!wasAlreadyCorrect) {
        statsStore.recordExerciseCompleted()
      }

      // The post-check summary (see AnswerInput.vue) takes over advancing
      // when it is going to show — it calls `next()` once the learner is
      // ready, rather than on this fixed delay. Off, this is exactly the
      // auto-advance the app has always done.
      if (!settingsStore.showCompletionStats) {
        advanceTimer = setTimeout(next, ADVANCE_DELAY_MS)
      }
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
    resetTyped()
    result.value = null
  }

  return {
    deck,
    index,
    current,
    layout,
    status,
    typed,
    result,
    load,
    append,
    backspace,
    check,
    next,
  }
})
