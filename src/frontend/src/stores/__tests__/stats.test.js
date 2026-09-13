import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useStatsStore } from '../stats'

// A fake `localStorage`, in-memory by default — the same shape
// `settings.test.js` uses. `lib/stats.js`'s own failure handling is covered
// in its own test file; this suite is about the store staying in sync with
// it, so a working store is all that's needed here.
function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

/** A fresh store, on its own Pinia instance, so its setup — including the
 * initial read from `lib/stats.js` — runs again from scratch. */
function freshStore() {
  setActivePinia(createPinia())
  return useStatsStore()
}

beforeEach(() => {
  globalThis.window = globalThis.window ?? {}
  window.localStorage = fakeStorage()
})

describe('recording updates the reactive totals', () => {
  it('recordKeyPress updates today and last7Days', () => {
    const store = freshStore()

    store.recordKeyPress(2)

    expect(store.today.keysPressed).toBe(2)
    expect(store.last7Days.keysPressed).toBe(2)
  })

  it('recordCorrectSymbols updates today and last7Days', () => {
    const store = freshStore()

    store.recordCorrectSymbols(3)

    expect(store.today.symbolsCorrect).toBe(3)
    expect(store.last7Days.symbolsCorrect).toBe(3)
  })

  it('recordExerciseCompleted updates today and last7Days', () => {
    const store = freshStore()

    store.recordExerciseCompleted()

    expect(store.today.exercisesCompleted).toBe(1)
    expect(store.last7Days.exercisesCompleted).toBe(1)
  })

  it('accumulates across multiple calls', () => {
    const store = freshStore()

    store.recordKeyPress(1)
    store.recordKeyPress(1)

    expect(store.today.keysPressed).toBe(2)
  })
})

describe('a fresh store instance', () => {
  it('starts at zero with nothing recorded', () => {
    const store = freshStore()

    expect(store.today).toEqual({ symbolsCorrect: 0, keysPressed: 0, exercisesCompleted: 0 })
    expect(store.last7Days).toEqual({ symbolsCorrect: 0, keysPressed: 0, exercisesCompleted: 0 })
  })

  it('reads existing localStorage data back', () => {
    const first = freshStore()
    first.recordCorrectSymbols(5)

    const second = freshStore()

    expect(second.today.symbolsCorrect).toBe(5)
    expect(second.last7Days.symbolsCorrect).toBe(5)
  })
})
