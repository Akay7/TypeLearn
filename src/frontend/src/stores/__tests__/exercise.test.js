import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useExerciseStore } from '../exercise'
import { useSettingsStore } from '../settings'
import { useStatsStore } from '../stats'

const SENTENCE = 'สวัสดี'

// A fake `localStorage`, in-memory and fresh for every test — otherwise
// `lib/stats.js`'s own in-memory fallback (module-level, so it would
// otherwise survive across tests in this file) carries counts from one test
// into the next.
function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

/** A store with a deck already in place, so no fetch is involved. */
function storeWithDeck(sentences = [SENTENCE, 'ขอบคุณ']) {
  const store = useExerciseStore()
  store.deck = sentences.map((sentence, id) => ({
    id: String(id),
    sentence,
    audioUrl: `/clip-${id}.mp3`,
    difficulty: 1,
  }))
  store.index = 0
  store.status = 'ready'
  return store
}

/** Type `text` the way the on-screen keyboard does, one character at a time. */
async function type(store, text) {
  for (const char of text) {
    store.append(char)
    // The watcher that checks the answer runs after the change, so each
    // character has to settle before the next one is typed.
    await nextTick()
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()

  globalThis.window = globalThis.window ?? {}
  window.localStorage = fakeStorage()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the answer checks itself', () => {
  it('checks on the character that completes the answer, with nothing else pressed', async () => {
    const store = storeWithDeck()

    await type(store, SENTENCE)

    expect(store.result).toBe('correct')
  })

  it('says nothing while the answer is still too short', async () => {
    const store = storeWithDeck()

    await type(store, 'สวัส')

    expect(store.result).toBe(null)
  })

  it('reports a full-length answer that is wrong, rather than waiting to be asked', async () => {
    const store = storeWithDeck()

    await type(store, 'สวัสดา')

    expect(store.result).toBe('incorrect')
  })

  it('clears a stale verdict as soon as the learner types again', async () => {
    const store = storeWithDeck()
    await type(store, 'สวัสดา')
    expect(store.result).toBe('incorrect')

    store.backspace()
    await nextTick()

    expect(store.result).toBe(null)
  })

  it('checks again once the shortened answer is back at full length', async () => {
    const store = storeWithDeck()
    await type(store, 'สวัสดา')

    store.backspace()
    await nextTick()
    await type(store, 'ี')

    expect(store.result).toBe('correct')
  })

  it('sees the physical keyboard too, which writes `typed` directly', async () => {
    const store = storeWithDeck()

    store.typed = SENTENCE
    await nextTick()

    expect(store.result).toBe('correct')
  })
})

describe('advancing after a correct answer', () => {
  // The post-check summary defaults to on, and takes over advancing when it
  // shows (see the tests below) — these are about the fixed-delay
  // auto-advance itself, which is what happens with it off.
  it('presents the next exercise once the verdict has been read, with the completion-stats setting off', async () => {
    const store = storeWithDeck()
    useSettingsStore().showCompletionStats = false

    await type(store, SENTENCE)
    expect(store.current.sentence).toBe(SENTENCE)

    vi.runAllTimers()
    await nextTick()

    expect(store.current.sentence).toBe('ขอบคุณ')
    expect(store.typed).toBe('')
    expect(store.result).toBe(null)
  })

  it('does not advance an answer that was typed past correct, with the completion-stats setting off', async () => {
    const store = storeWithDeck()
    useSettingsStore().showCompletionStats = false

    await type(store, SENTENCE)
    await type(store, 'ก')

    expect(store.result).toBe('incorrect')

    // The advance the correct answer scheduled must have been called off with
    // it; otherwise the learner is carried away from a mistake they can see.
    vi.runAllTimers()
    await nextTick()

    expect(store.current.sentence).toBe(SENTENCE)
  })

  it('does not advance on its own with the completion-stats setting on (the default)', async () => {
    const store = storeWithDeck()

    await type(store, SENTENCE)
    expect(store.result).toBe('correct')

    vi.runAllTimers()
    await nextTick()

    expect(store.current.sentence).toBe(SENTENCE)
  })

  it('advances once next() is called explicitly, with the completion-stats setting on', async () => {
    const store = storeWithDeck()

    await type(store, SENTENCE)
    expect(store.result).toBe('correct')

    store.next()

    expect(store.current.sentence).toBe('ขอบคุณ')
    expect(store.typed).toBe('')
    expect(store.result).toBe(null)
  })
})

describe('practice stats are recorded as the learner types', () => {
  it('records one key press and one correct symbol for a correct character', async () => {
    const store = storeWithDeck()
    const stats = useStatsStore()

    store.append(SENTENCE[0])
    await nextTick()

    expect(stats.today.keysPressed).toBe(1)
    expect(stats.today.symbolsCorrect).toBe(1)
  })

  it('records two key presses and zero correct symbols for a wrong character then its correction', async () => {
    const store = storeWithDeck()
    const stats = useStatsStore()

    // 'ก' is not this sentence's first expected character.
    store.append('ก')
    store.backspace()
    await nextTick()

    expect(stats.today.keysPressed).toBe(2)
    expect(stats.today.symbolsCorrect).toBe(0)
  })

  it('accumulates key presses and correct symbols across a whole correct answer', async () => {
    const store = storeWithDeck()
    const stats = useStatsStore()

    await type(store, SENTENCE)

    expect(stats.today.keysPressed).toBe([...SENTENCE].length)
    expect(stats.today.symbolsCorrect).toBe([...SENTENCE].length)
  })

  it('records one completed exercise on a correct check', async () => {
    const store = storeWithDeck()
    const stats = useStatsStore()

    await type(store, SENTENCE)

    expect(stats.today.exercisesCompleted).toBe(1)
  })

  it('does not double-count a re-confirmed check of the same correct answer', async () => {
    const store = storeWithDeck()
    useSettingsStore().showCompletionStats = false
    const stats = useStatsStore()

    await type(store, SENTENCE)
    // The Check control stays live during the pre-advance delay; pressing it
    // again must not count a second completion for the one exercise.
    store.check()

    expect(stats.today.exercisesCompleted).toBe(1)
  })

  it('does not count the reset to a fresh exercise as backspaces', async () => {
    const store = storeWithDeck()
    useSettingsStore().showCompletionStats = false
    const stats = useStatsStore()

    await type(store, SENTENCE)
    vi.runAllTimers()
    await nextTick()

    // Advancing cleared `typed` back to '' on its own; that must not also
    // register as `SENTENCE.length` backspaces.
    expect(stats.today.keysPressed).toBe([...SENTENCE].length)
  })
})

describe('checking on demand', () => {
  it('checks a short answer when asked, and finds it incorrect', async () => {
    const store = storeWithDeck()

    await type(store, 'สวัส')
    store.check()

    expect(store.result).toBe('incorrect')
  })

  it('does nothing without an exercise', () => {
    const store = useExerciseStore()

    store.check()

    expect(store.result).toBe(null)
  })
})

describe('the sentence the learner is asked for', () => {
  it('keeps a character Kedmanee cannot type but the Latin layout can', () => {
    // `!` is not on a Thai keyboard. The keyboard reaches it the way a Thai
    // typist does — by switching layout — so the sentence is left alone.
    const store = storeWithDeck(['สวัสดี!'])

    expect(store.current.sentence).toBe('สวัสดี!')
  })

  it('lets that exercise be completed and judged correct', async () => {
    const store = storeWithDeck(['สวัสดี!'])

    await type(store, 'สวัสดี!')

    expect(store.result).toBe('correct')
  })

  it('removes only what is on no keyboard at all', () => {
    // An emoji is on no board this application has, so there is no keystroke
    // to ask for and nothing a layout switch could reach.
    const store = storeWithDeck(['สวัสดี 🙂'])

    expect(store.current.sentence).toBe('สวัสดี')
  })

  it('leaves the ingested sentence alone', () => {
    // The correction belongs to the exercise being presented, not to the
    // catalog: what was ingested stays as the corpus wrote it.
    const store = storeWithDeck(['สวัสดี 🙂'])

    expect(store.deck[0].sentence).toBe('สวัสดี 🙂')
  })

  it('carries everything else about the exercise through unchanged', () => {
    const store = storeWithDeck(['สวัสดี!'])

    expect(store.current.id).toBe('0')
    expect(store.current.audioUrl).toBe('/clip-0.mp3')
  })
})

describe('loading the catalog', () => {
  function respondWith(exercises) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { exercises } }),
      }),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps an exercise the Latin layout can type', async () => {
    // Reachable by switching layout, so it is a perfectly good exercise.
    respondWith([
      { id: '1', sentence: 'hello!', audioUrl: '/1.mp3', difficulty: 1 },
      { id: '2', sentence: 'สวัสดี', audioUrl: '/2.mp3', difficulty: 1 },
    ])

    const store = useExerciseStore()
    await store.load()

    expect(store.deck.map((exercise) => exercise.id).sort()).toEqual(['1', '2'])
  })

  it('leaves out an exercise no keyboard can type at all', async () => {
    // Presented, it would be complete before the learner typed anything.
    respondWith([
      { id: '1', sentence: '🙂🙂', audioUrl: '/1.mp3', difficulty: 1 },
      { id: '2', sentence: 'สวัสดี', audioUrl: '/2.mp3', difficulty: 1 },
    ])

    const store = useExerciseStore()
    await store.load()

    expect(store.deck.map((exercise) => exercise.id)).toEqual(['2'])
    expect(store.status).toBe('ready')
  })

  it('reports an empty catalog when nothing survives', async () => {
    respondWith([{ id: '1', sentence: '🙂', audioUrl: '/1.mp3', difficulty: 1 }])

    const store = useExerciseStore()
    await store.load()

    expect(store.status).toBe('empty')
    expect(store.current).toBeNull()
  })
})
