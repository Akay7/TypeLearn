import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { clientId } from '../lib/clientId'
import { graphql } from '../lib/graphql'
import { useExerciseStore } from './exercise'
import { useSettingsStore } from './settings'

// The rest of the deck's translations into one language, in one request. The
// ids go in a variable rather than the document: 200 of them written inline
// would be over the API's token limit on their own.
const TRANSLATIONS_QUERY = `
  query Translations($ids: [ID!], $language: String!) {
    exercises(filters: { id: { inList: $ids } }) {
      id
      translation(language: $language) { id text origin upVotes downVotes }
    }
  }
`

const RATE_MUTATION = `
  mutation Rate($id: ID!, $clientId: String!, $value: TranslationRatingValue!) {
    rateTranslation(translationId: $id, clientId: $clientId, value: $value) {
      id text origin upVotes downVotes
    }
  }
`

const PROPOSE_MUTATION = `
  mutation Propose($exerciseId: ID!, $language: String!, $text: String!, $clientId: String!) {
    proposeTranslation(exerciseId: $exerciseId, language: $language, text: $text, clientId: $clientId) {
      accepted
    }
  }
`

// The refusals the API names that a learner can act on. Anything else — a
// network failure, a server error, a code added later — gets the generic
// message rather than none.
const KNOWN_ERRORS = new Set(['BLANK', 'TOO_LONG', 'DUPLICATE', 'RATE_LIMITED'])

// The longest translation the API stores. The form stops there rather than
// letting the learner write something the server will refuse.
export const MAX_TRANSLATION_LENGTH = 500

/** The i18n key describing why a write failed. */
export function errorKey(error) {
  return KNOWN_ERRORS.has(error?.code)
    ? `translation.errors.${error.code}`
    : 'translation.errors.generic'
}

const key = (exerciseId, language) => `${exerciseId}:${language}`

/**
 * The translation shown with the current exercise, and the learner's two ways
 * of improving it.
 *
 * Its own store rather than more of the exercise store: nothing about checking
 * an answer depends on it, and a failure here must never reach practice. It
 * follows the exercise store's deck and the settings, fetching whatever the
 * rest of the deck is missing in the language being shown, so advancing to the
 * next exercise never waits on a request.
 */
export const useTranslationStore = defineStore('translation', () => {
  const exercise = useExerciseStore()
  const settings = useSettingsStore()

  // `${exerciseId}:${language}` -> the translation, or null for "there is none".
  // Absent means not asked for yet.
  const translations = ref({})
  // Same keys -> 'loading' | 'error', while a request is out or after it failed.
  const pending = ref({})
  // Translation id -> 'UP' | 'DOWN': what this browser has said this visit.
  // Not persisted — the server holds the rating, and nothing reads it back.
  const ratings = ref({})

  const language = computed(() => settings.interfaceLanguage)

  // Exercises carry no language of their own yet; the one they are practised
  // in is the one their keyboard is for. A translation into that same language
  // would say the sentence again.
  const sourceLanguage = computed(() => exercise.layout.language)

  const active = computed(
    () => settings.showTranslation && language.value !== sourceLanguage.value,
  )

  const currentKey = computed(() =>
    exercise.current ? key(exercise.current.id, language.value) : null,
  )

  /** 'loading' | 'error' | 'none' | 'ready' for the exercise on screen. */
  const state = computed(() => {
    const k = currentKey.value
    if (!k) return 'loading'
    if (k in translations.value) return translations.value[k] ? 'ready' : 'none'
    return pending.value[k] === 'error' ? 'error' : 'loading'
  })

  const current = computed(() => (state.value === 'ready' ? translations.value[currentKey.value] : null))

  const currentRating = computed(() => (current.value ? ratings.value[current.value.id] : undefined))

  async function fetchMissing() {
    if (!active.value || !exercise.deck.length) return

    const lang = language.value
    const ids = exercise.deck
      .slice(exercise.index)
      .map((item) => item.id)
      .filter((id) => !(key(id, lang) in translations.value) && pending.value[key(id, lang)] !== 'loading')
    if (!ids.length) return

    for (const id of ids) pending.value[key(id, lang)] = 'loading'

    try {
      const data = await graphql(TRANSLATIONS_QUERY, { ids, language: lang })
      const found = new Map(data.exercises.map((item) => [item.id, item.translation]))
      for (const id of ids) {
        translations.value[key(id, lang)] = found.get(id) ?? null
        delete pending.value[key(id, lang)]
      }
    } catch (error) {
      console.error('Could not load translations:', error)
      for (const id of ids) pending.value[key(id, lang)] = 'error'
    }
  }

  // A new deck, the setting turned on, or another interface language: each
  // leaves translations to fetch, and each is answered with one request.
  watch([active, language, () => exercise.deck], fetchMissing, { immediate: true })

  /**
   * Rate the shown translation. Choosing the rating already given withdraws
   * it. Returns null on success, or the i18n key of what went wrong.
   */
  async function rate(value) {
    const translation = current.value
    if (!translation) return null

    const previous = ratings.value[translation.id]
    const sent = previous === value ? 'NONE' : value

    try {
      const data = await graphql(RATE_MUTATION, {
        id: translation.id,
        clientId: clientId(),
        value: sent,
      })
      // Every cached copy of this translation, whichever exercise key holds it.
      for (const [k, cached] of Object.entries(translations.value)) {
        if (cached?.id === translation.id) translations.value[k] = data.rateTranslation
      }
      if (sent === 'NONE') delete ratings.value[translation.id]
      else ratings.value[translation.id] = sent
      return null
    } catch (error) {
      return errorKey(error)
    }
  }

  /**
   * Suggest a translation of the current exercise into the interface language.
   * Returns null once the server has it (it waits for review), or the i18n key
   * of why it was refused. The obvious refusals are caught here first, so they
   * cost no request.
   */
  async function propose(text) {
    const trimmed = text.trim()
    if (!trimmed) return 'translation.errors.BLANK'
    if (trimmed.length > MAX_TRANSLATION_LENGTH) return 'translation.errors.TOO_LONG'
    if (current.value && trimmed === current.value.text) return 'translation.errors.DUPLICATE'
    if (!exercise.current) return 'translation.errors.generic'

    try {
      await graphql(PROPOSE_MUTATION, {
        exerciseId: exercise.current.id,
        language: language.value,
        text: trimmed,
        clientId: clientId(),
      })
      return null
    } catch (error) {
      return errorKey(error)
    }
  }

  return {
    translations,
    ratings,
    active,
    state,
    current,
    currentRating,
    language,
    fetchMissing,
    rate,
    propose,
  }
})
