import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useExerciseStore } from '../exercise'

const SENTENCE = 'สวัสดี'

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
  it('presents the next exercise once the verdict has been read', async () => {
    const store = storeWithDeck()

    await type(store, SENTENCE)
    expect(store.current.sentence).toBe(SENTENCE)

    vi.runAllTimers()
    await nextTick()

    expect(store.current.sentence).toBe('ขอบคุณ')
    expect(store.typed).toBe('')
    expect(store.result).toBe(null)
  })

  it('does not advance an answer that was typed past correct', async () => {
    const store = storeWithDeck()

    await type(store, SENTENCE)
    await type(store, 'ก')

    expect(store.result).toBe('incorrect')

    // The advance the correct answer scheduled must have been called off with
    // it; otherwise the learner is carried away from a mistake they can see.
    vi.runAllTimers()
    await nextTick()

    expect(store.current.sentence).toBe(SENTENCE)
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
