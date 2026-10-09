import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { compare, dropLast, isComplete, nextExpected } from '../lib/checking'
import { graphql } from '../lib/graphql'
import { layoutFor, layoutsAvailable, withoutUnreachable } from '../lib/keyboard'
import { useSettingsStore } from './settings'
import { useStatsStore } from './stats'

// A random sample of the catalog, never the whole of it: a deployment holds
// tens of thousands of exercises. Fetched up front, so advancing within a deck
// costs nothing — the moment after a green result is the worst possible time
// to show a loading state. The server shuffles, so the client does not.
const DECK_SIZE = 200

const DECK_QUERY = `
  query Deck {
    deck(size: ${DECK_SIZE}) {
      id
      sentence
      audioUrl
      difficulty
    }
  }
`

// How long the verdict stays on screen before the next exercise replaces it.
const ADVANCE_DELAY_MS = 900

/**
 * Fetch a deck, keeping only the exercises some keyboard can type.
 *
 * An exercise whose sentence holds nothing any keyboard can type is not an
 * exercise: presented, it would be complete before the learner typed anything.
 * Dropped here rather than hidden later, so the deck is the list of things
 * there are to practise.
 */
async function fetchDeck() {
  const data = await graphql(DECK_QUERY)

  return data.deck.filter(
    (exercise) =>
      withoutUnreachable(exercise.sentence, layoutsAvailable(layoutFor(exercise.language))) !==
      '',
  )
}

export const useExerciseStore = defineStore('exercise', () => {
  const settingsStore = useSettingsStore()
  const statsStore = useStatsStore()

  // The deck being practised, in the order the server drew it, and where we
  // are in it. No exercise repeats within a deck; the next deck is a fresh draw.
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
      deck.value = await fetchDeck()
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

  function present(position) {
    index.value = position
    resetTyped()
    result.value = null
  }

  // Held while a new deck is on its way, so a second advance in the meantime
  // does not ask for another.
  let refilling = false

  /**
   * Replace a finished deck with a fresh draw, in the background.
   *
   * `status` stays 'ready': the answered exercise and its verdict stay on
   * screen until the new deck arrives, which is usually within the pause the
   * verdict is shown for anyway. If the draw fails, or comes back with nothing
   * to practise, the deck already held starts again rather than practice
   * ending in an error.
   */
  async function refill() {
    if (refilling) {
      return
    }
    refilling = true

    try {
      const fresh = await fetchDeck()
      if (fresh.length) {
        deck.value = fresh
      }
    } catch (error) {
      console.error('Could not load a new deck:', error)
    } finally {
      refilling = false
    }

    present(0)
  }

  /**
   * Present the next exercise, drawing a new deck when this one runs out.
   * Everything belonging to the previous exercise is cleared here, so no
   * component has to remember to reset itself.
   */
  function next() {
    cancelAdvance()

    if (!deck.value.length) {
      return
    }

    if (index.value + 1 < deck.value.length) {
      present(index.value + 1)
      return
    }

    return refill()
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
