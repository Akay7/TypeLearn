import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useExerciseStore } from '../exercise'
import { useSettingsStore } from '../settings'
import { errorKey, useTranslationStore } from '../translation'

function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

const translationOf = (id, language, extra = {}) => ({
  id: `t${id}-${language}`,
  text: `[${language}] sentence ${id}`,
  origin: 'MACHINE',
  upVotes: 0,
  downVotes: 0,
  ...extra,
})

/**
 * A fetch that answers the translations query from `known` (exercise id ->
 * language -> translation) and hands every mutation to `onMutation`.
 */
function backend({ known = {}, onMutation = () => ({}) } = {}) {
  return vi.fn(async (url, init) => {
    const { query, variables } = JSON.parse(init.body)
    let body
    if (query.includes('query Translations')) {
      body = {
        data: {
          exercises: variables.ids.map((id) => ({
            id,
            translation: known[id]?.[variables.language] ?? null,
          })),
        },
      }
    } else {
      body = onMutation(query, variables)
    }
    return { ok: true, status: 200, json: async () => body }
  })
}

const requestsOf = (fetch, name) =>
  fetch.mock.calls
    .map(([, init]) => JSON.parse(init.body))
    .filter(({ query }) => query.includes(name))

/** Let every pending promise and watcher run. */
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await nextTick()
    await Promise.resolve()
  }
}

function setup({ deck = ['1', '2', '3'], show = true, language = 'en' } = {}) {
  const settings = useSettingsStore()
  settings.showTranslation = show
  settings.interfaceLanguage = language
  const exercise = useExerciseStore()
  exercise.deck = deck.map((id) => ({ id, sentence: 'สวัสดี', audioUrl: `/${id}.mp3` }))
  exercise.index = 0
  exercise.status = 'ready'
  return { settings, exercise, translation: useTranslationStore() }
}

beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.window = globalThis.window ?? {}
  window.localStorage = fakeStorage()
  vi.stubGlobal('navigator', { language: 'en-US' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetching translations', () => {
  it('asks for nothing while the setting is off', async () => {
    const fetch = backend()
    vi.stubGlobal('fetch', fetch)

    setup({ show: false })
    await settle()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches the rest of the deck in one request once turned on', async () => {
    const fetch = backend({ known: { 1: { en: translationOf(1, 'en') } } })
    vi.stubGlobal('fetch', fetch)
    const { settings, translation } = setup({ show: false })

    settings.showTranslation = true
    await settle()

    const [request] = requestsOf(fetch, 'query Translations')
    expect(request.variables).toEqual({ ids: ['1', '2', '3'], language: 'en' })
    expect(translation.state).toBe('ready')
    expect(translation.current.text).toBe('[en] sentence 1')
  })

  it('reports an exercise with no translation as none', async () => {
    vi.stubGlobal('fetch', backend())
    const { translation } = setup()
    await settle()

    expect(translation.state).toBe('none')
    expect(translation.current).toBe(null)
  })

  it('fetches again in the new language when the interface language changes', async () => {
    const fetch = backend({
      known: { 1: { en: translationOf(1, 'en'), fr: translationOf(1, 'fr') } },
    })
    vi.stubGlobal('fetch', fetch)
    const { settings, translation } = setup()
    await settle()

    settings.interfaceLanguage = 'fr'
    await settle()

    expect(requestsOf(fetch, 'query Translations').map((r) => r.variables.language)).toEqual([
      'en',
      'fr',
    ])
    expect(translation.current.text).toBe('[fr] sentence 1')

    // Back to English: already cached, so no third request.
    settings.interfaceLanguage = 'en'
    await settle()
    expect(requestsOf(fetch, 'query Translations')).toHaveLength(2)
    expect(translation.current.text).toBe('[en] sentence 1')
  })

  it('never asks for a translation into the exercise’s own language', async () => {
    const fetch = backend()
    vi.stubGlobal('fetch', fetch)

    const { translation } = setup({ language: 'th' })
    await settle()

    expect(translation.active).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a failed request without touching practice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { exercise, translation } = setup()
    await settle()

    expect(translation.state).toBe('error')
    expect(exercise.status).toBe('ready')
  })

  it('only asks for exercises not yet fetched when a new deck arrives', async () => {
    const fetch = backend()
    vi.stubGlobal('fetch', fetch)
    const { exercise } = setup({ deck: ['1', '2'] })
    await settle()

    exercise.deck = [...exercise.deck, { id: '9', sentence: 'ก', audioUrl: '/9.mp3' }]
    await settle()

    expect(requestsOf(fetch, 'query Translations').map((r) => r.variables.ids)).toEqual([
      ['1', '2'],
      ['9'],
    ])
  })
})

describe('rating', () => {
  function rated(value) {
    return { data: { rateTranslation: translationOf(1, 'en', value) } }
  }

  it('sends the rating and shows the counts the server returns', async () => {
    const fetch = backend({
      known: { 1: { en: translationOf(1, 'en') } },
      onMutation: () => rated({ upVotes: 1 }),
    })
    vi.stubGlobal('fetch', fetch)
    const { translation } = setup()
    await settle()

    expect(await translation.rate('UP')).toBe(null)

    const [request] = requestsOf(fetch, 'mutation Rate')
    expect(request.variables.value).toBe('UP')
    expect(request.variables.clientId).toMatch(/^[0-9a-f-]{36}$/)
    expect(translation.currentRating).toBe('UP')
    expect(translation.current.upVotes).toBe(1)
  })

  it('withdraws a rating chosen twice', async () => {
    const fetch = backend({
      known: { 1: { en: translationOf(1, 'en') } },
      onMutation: () => rated({}),
    })
    vi.stubGlobal('fetch', fetch)
    const { translation } = setup()
    await settle()

    await translation.rate('DOWN')
    await translation.rate('DOWN')

    expect(requestsOf(fetch, 'mutation Rate').map((r) => r.variables.value)).toEqual([
      'DOWN',
      'NONE',
    ])
    expect(translation.currentRating).toBe(undefined)
  })

  it('names the refusal when rating is rate-limited', async () => {
    vi.stubGlobal(
      'fetch',
      backend({
        known: { 1: { en: translationOf(1, 'en') } },
        onMutation: () => ({ errors: [{ message: 'no', extensions: { code: 'RATE_LIMITED' } }] }),
      }),
    )
    const { translation } = setup()
    await settle()

    expect(await translation.rate('UP')).toBe('translation.errors.RATE_LIMITED')
    expect(translation.currentRating).toBe(undefined)
  })
})

describe('proposing', () => {
  it('sends a trimmed suggestion for the current exercise and language', async () => {
    const fetch = backend({ onMutation: () => ({ data: { proposeTranslation: { accepted: true } } }) })
    vi.stubGlobal('fetch', fetch)
    const { translation } = setup({ language: 'ru' })
    await settle()

    expect(await translation.propose('  Привет  ')).toBe(null)

    const [request] = requestsOf(fetch, 'mutation Propose')
    expect(request.variables).toMatchObject({ exerciseId: '1', language: 'ru', text: 'Привет' })
  })

  it('refuses the obvious without a request', async () => {
    const fetch = backend({ known: { 1: { en: translationOf(1, 'en') } } })
    vi.stubGlobal('fetch', fetch)
    const { translation } = setup()
    await settle()

    expect(await translation.propose('   ')).toBe('translation.errors.BLANK')
    expect(await translation.propose('x'.repeat(501))).toBe('translation.errors.TOO_LONG')
    expect(await translation.propose('[en] sentence 1')).toBe('translation.errors.DUPLICATE')
    expect(requestsOf(fetch, 'mutation Propose')).toHaveLength(0)
  })

  it('maps server refusals to messages, and unknown ones to the generic one', async () => {
    const code = { value: 'DUPLICATE' }
    vi.stubGlobal(
      'fetch',
      backend({
        onMutation: () => ({ errors: [{ message: 'no', extensions: { code: code.value } }] }),
      }),
    )
    const { translation } = setup()
    await settle()

    expect(await translation.propose('Hello')).toBe('translation.errors.DUPLICATE')
    code.value = 'SOMETHING_NEW'
    expect(await translation.propose('Hello')).toBe('translation.errors.generic')
  })
})

describe('errorKey', () => {
  it('falls back to the generic message for errors with no code', () => {
    expect(errorKey(new Error('network down'))).toBe('translation.errors.generic')
    expect(errorKey({ code: 'TOO_LONG' })).toBe('translation.errors.TOO_LONG')
  })
})
