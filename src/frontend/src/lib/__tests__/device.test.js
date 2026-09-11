import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useIsPhone } from '../device'

/** A fake `MediaQueryList`, keyed by query string, whose `matches` a test can
 * flip and whose listeners a test can fire — standing in for the browser API
 * vitest's node environment does not provide. */
function fakeMatchMedia(initial) {
  const lists = new Map()

  const matchMedia = (query) => {
    if (!lists.has(query)) {
      lists.set(query, { matches: Boolean(initial[query]), listeners: new Set() })
    }
    const state = lists.get(query)

    return {
      get matches() {
        return state.matches
      },
      addEventListener: (_event, listener) => state.listeners.add(listener),
      removeEventListener: (_event, listener) => state.listeners.delete(listener),
    }
  }

  /** Flips a query's `matches` and fires its listeners, the way the browser
   * would when the viewport or input mode changes. */
  matchMedia.set = (query, matches) => {
    const state = lists.get(query)
    state.matches = matches
    state.listeners.forEach((listener) => listener())
  }

  matchMedia.listenerCount = (query) => lists.get(query)?.listeners.size ?? 0

  return matchMedia
}

const SMALL_SCREEN = '(max-width: 640px)'
const TOUCH_PRIMARY = '(hover: none) and (pointer: coarse)'

beforeEach(() => {
  globalThis.window = globalThis.window ?? {}
})

afterEach(() => {
  delete globalThis.window.matchMedia
})

describe('phone classification', () => {
  it('is a phone when the screen is small and the pointer is touch-primary', () => {
    window.matchMedia = fakeMatchMedia({ [SMALL_SCREEN]: true, [TOUCH_PRIMARY]: true })

    expect(useIsPhone().value).toBe(true)
  })

  it('is not a phone when the screen is small but a hover-capable pointer is present', () => {
    window.matchMedia = fakeMatchMedia({ [SMALL_SCREEN]: true, [TOUCH_PRIMARY]: false })

    expect(useIsPhone().value).toBe(false)
  })

  it('is not a phone when the pointer is touch-primary but the screen is not small', () => {
    window.matchMedia = fakeMatchMedia({ [SMALL_SCREEN]: false, [TOUCH_PRIMARY]: true })

    expect(useIsPhone().value).toBe(false)
  })

  it('falls back to not-a-phone when matchMedia is unavailable', () => {
    expect(useIsPhone().value).toBe(false)
  })

  it('follows a change to either media query live', () => {
    const matchMedia = fakeMatchMedia({ [SMALL_SCREEN]: false, [TOUCH_PRIMARY]: true })
    window.matchMedia = matchMedia

    const isPhone = useIsPhone()
    expect(isPhone.value).toBe(false)

    matchMedia.set(SMALL_SCREEN, true)
    expect(isPhone.value).toBe(true)

    matchMedia.set(TOUCH_PRIMARY, false)
    expect(isPhone.value).toBe(false)
  })

  it('stops listening once its effect scope is disposed', () => {
    const matchMedia = fakeMatchMedia({ [SMALL_SCREEN]: true, [TOUCH_PRIMARY]: true })
    window.matchMedia = matchMedia

    const scope = effectScope()
    scope.run(() => useIsPhone())

    expect(matchMedia.listenerCount(SMALL_SCREEN)).toBe(1)

    scope.stop()

    expect(matchMedia.listenerCount(SMALL_SCREEN)).toBe(0)
    expect(matchMedia.listenerCount(TOUCH_PRIMARY)).toBe(0)
  })
})
