import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The module keeps its `localStorage` fallback in a module-level variable
// (see stats.js), so each test re-imports it fresh rather than sharing that
// state across tests the way `vi.resetModules` + a dynamic import allows.
let stats

// A fake `localStorage`, in-memory by default. `broken()` makes every call
// throw, the way a browser with storage disabled does — the same shape
// `stores/__tests__/settings.test.js` uses.
function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    broken() {
      this.getItem = () => {
        throw new Error('storage disabled')
      }
      this.setItem = () => {
        throw new Error('storage disabled')
      }
    },
  }
}

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T10:00:00'))

  globalThis.window = globalThis.window ?? {}
  window.localStorage = fakeStorage()

  stats = await import('../stats')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a fresh day', () => {
  it('starts at zero', () => {
    expect(stats.today()).toEqual({ symbolsCorrect: 0, keysPressed: 0, exercisesCompleted: 0 })
  })

  it('is independent of a previous day already recorded', () => {
    stats.recordKeyPress(5)

    vi.setSystemTime(new Date('2026-09-13T10:00:00'))

    expect(stats.today()).toEqual({ symbolsCorrect: 0, keysPressed: 0, exercisesCompleted: 0 })
  })
})

describe('recording', () => {
  it('increases only the counter it names', () => {
    stats.recordCorrectSymbols(3)

    expect(stats.today()).toEqual({ symbolsCorrect: 3, keysPressed: 0, exercisesCompleted: 0 })
  })

  it('accumulates across multiple calls the same day', () => {
    stats.recordKeyPress(1)
    stats.recordKeyPress(2)

    expect(stats.today().keysPressed).toBe(3)
  })

  it('counts a completed exercise', () => {
    stats.recordExerciseCompleted()
    stats.recordExerciseCompleted()

    expect(stats.today().exercisesCompleted).toBe(2)
  })

  it('a wrong key press followed by a correction is two key presses', () => {
    // As `stores/exercise.js`'s watcher would report it: one press for the
    // wrong character, one more for the backspace that removed it.
    stats.recordKeyPress(1)
    stats.recordKeyPress(1)

    expect(stats.today()).toEqual({ symbolsCorrect: 0, keysPressed: 2, exercisesCompleted: 0 })
  })
})

describe('the last 7 days', () => {
  it('sums today and the prior 6 days', () => {
    for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
      const date = new Date('2026-09-12T10:00:00')
      date.setDate(date.getDate() - daysAgo)
      vi.setSystemTime(date)

      stats.recordCorrectSymbols(1)
      stats.recordKeyPress(1)
    }

    vi.setSystemTime(new Date('2026-09-12T10:00:00'))

    expect(stats.last7Days()).toEqual({ symbolsCorrect: 7, keysPressed: 7, exercisesCompleted: 0 })
  })

  it('does not include a day older than 7 days', () => {
    vi.setSystemTime(new Date('2026-09-01T10:00:00'))
    stats.recordCorrectSymbols(10)

    vi.setSystemTime(new Date('2026-09-12T10:00:00'))
    stats.recordCorrectSymbols(1)

    expect(stats.last7Days().symbolsCorrect).toBe(1)
  })

  it('drops a day older than 7 days from storage on the next write', () => {
    vi.setSystemTime(new Date('2026-09-01T10:00:00'))
    stats.recordCorrectSymbols(10)

    vi.setSystemTime(new Date('2026-09-12T10:00:00'))
    stats.recordCorrectSymbols(1)

    const stored = JSON.parse(window.localStorage.getItem('typelearn.stats.daily'))
    expect(Object.keys(stored)).not.toContain('2026-09-01')
  })
})

describe('when localStorage is unavailable', () => {
  it('does not crash a read', () => {
    window.localStorage.broken()

    expect(() => stats.today()).not.toThrow()
    expect(stats.today()).toEqual({ symbolsCorrect: 0, keysPressed: 0, exercisesCompleted: 0 })
  })

  it('does not crash a record call, and keeps the count for the session', () => {
    window.localStorage.broken()

    expect(() => stats.recordKeyPress(1)).not.toThrow()
    expect(stats.today().keysPressed).toBe(1)
  })
})
