import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '../../i18n'
import { useSettingsStore } from '../settings'

// The device classification is mocked out here: this suite is about the
// override and its persistence, not about matchMedia — device.test.js
// already covers that.
const isPhone = ref(false)
vi.mock('../../lib/device', () => ({ useIsPhone: () => isPhone }))

// A fake `localStorage`, in-memory by default. `broken()` makes every call
// throw, the way a browser with storage disabled does.
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

/** A fresh store, on its own Pinia instance, so its setup — including the
 * `localStorage` read — runs again from scratch. */
function freshStore() {
  setActivePinia(createPinia())
  return useSettingsStore()
}

beforeEach(() => {
  isPhone.value = false
  globalThis.window = globalThis.window ?? {}
  window.localStorage = fakeStorage()
  vi.stubGlobal('navigator', { language: 'en-US' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the virtual keyboard override', () => {
  it('defaults to auto', async () => {
    const store = await freshStore()
    expect(store.virtualKeyboardOverride).toBe('auto')
  })

  it('follows the device when auto', async () => {
    const store = await freshStore()

    isPhone.value = true
    expect(store.virtualKeyboardEnabled).toBe(false)

    isPhone.value = false
    expect(store.virtualKeyboardEnabled).toBe(true)
  })

  it('forces the keyboard on, even on a phone', async () => {
    isPhone.value = true
    const store = await freshStore()

    store.virtualKeyboardOverride = 'on'
    expect(store.virtualKeyboardEnabled).toBe(true)
  })

  it('forces the keyboard off, even off a phone', async () => {
    isPhone.value = false
    const store = await freshStore()

    store.virtualKeyboardOverride = 'off'
    expect(store.virtualKeyboardEnabled).toBe(false)
  })

  it('is read back by a fresh store instance', async () => {
    const first = await freshStore()
    first.virtualKeyboardOverride = 'off'

    const second = await freshStore()
    expect(second.virtualKeyboardOverride).toBe('off')
  })

  it('does not crash store creation when storage throws on read', async () => {
    window.localStorage.broken()

    const store = await freshStore()
    expect(store.virtualKeyboardOverride).toBe('auto')
  })

  it('does not crash a setting change when storage throws on write', async () => {
    const store = await freshStore()
    window.localStorage.broken()

    expect(() => {
      store.virtualKeyboardOverride = 'on'
    }).not.toThrow()
    expect(store.virtualKeyboardEnabled).toBe(true)
  })
})

describe('the on-screen keyboard visibility', () => {
  it('defaults to shown', async () => {
    const store = await freshStore()
    expect(store.onScreenKeyboardVisible).toBe(true)
  })

  it('is read back by a fresh store instance', async () => {
    const first = await freshStore()
    first.onScreenKeyboardVisible = false

    const second = await freshStore()
    expect(second.onScreenKeyboardVisible).toBe(false)
  })

  it('does not crash store creation when storage throws on read', async () => {
    window.localStorage.broken()

    const store = await freshStore()
    expect(store.onScreenKeyboardVisible).toBe(true)
  })

  it('does not crash a setting change when storage throws on write', async () => {
    const store = await freshStore()
    window.localStorage.broken()

    expect(() => {
      store.onScreenKeyboardVisible = false
    }).not.toThrow()
    expect(store.onScreenKeyboardVisible).toBe(false)
  })

  it('is independent of the virtual keyboard override', async () => {
    const store = await freshStore()

    store.onScreenKeyboardVisible = false
    store.virtualKeyboardOverride = 'on'

    expect(store.onScreenKeyboardVisible).toBe(false)
    expect(store.virtualKeyboardEnabled).toBe(true)
  })
})

describe('the completion-stats setting', () => {
  it('defaults to shown', async () => {
    const store = await freshStore()
    expect(store.showCompletionStats).toBe(true)
  })

  it('is read back by a fresh store instance', async () => {
    const first = await freshStore()
    first.showCompletionStats = false

    const second = await freshStore()
    expect(second.showCompletionStats).toBe(false)
  })

  it('does not crash store creation when storage throws on read', async () => {
    window.localStorage.broken()

    const store = await freshStore()
    expect(store.showCompletionStats).toBe(true)
  })

  it('does not crash a setting change when storage throws on write', async () => {
    const store = await freshStore()
    window.localStorage.broken()

    expect(() => {
      store.showCompletionStats = false
    }).not.toThrow()
    expect(store.showCompletionStats).toBe(false)
  })

  it('is independent of the other two settings', async () => {
    const store = await freshStore()

    store.showCompletionStats = false
    store.onScreenKeyboardVisible = false
    store.virtualKeyboardOverride = 'on'

    expect(store.showCompletionStats).toBe(false)
    expect(store.onScreenKeyboardVisible).toBe(false)
    expect(store.virtualKeyboardEnabled).toBe(true)
  })
})

describe('the interface language', () => {
  it("defaults to the browser's language when it is supported", async () => {
    vi.stubGlobal('navigator', { language: 'fr-CA' })

    const store = await freshStore()
    expect(store.interfaceLanguage).toBe('fr')
  })

  it("falls back to English when the browser's language is not supported", async () => {
    vi.stubGlobal('navigator', { language: 'ja-JP' })

    const store = await freshStore()
    expect(store.interfaceLanguage).toBe('en')
  })

  it('falls back to English when the browser reports no language at all', async () => {
    vi.stubGlobal('navigator', {})

    const store = await freshStore()
    expect(store.interfaceLanguage).toBe('en')
  })

  it('prefers a stored choice over the browser language', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    window.localStorage.setItem('typelearn.interfaceLanguage', 'de')

    const store = await freshStore()
    expect(store.interfaceLanguage).toBe('de')
  })

  it('ignores a stored value that is not one of the six supported languages', async () => {
    vi.stubGlobal('navigator', { language: 'ja-JP' })
    window.localStorage.setItem('typelearn.interfaceLanguage', 'ja')

    const store = await freshStore()
    expect(store.interfaceLanguage).toBe('en')
  })

  it('is read back by a fresh store instance', async () => {
    const first = await freshStore()
    first.interfaceLanguage = 'ru'

    const second = await freshStore()
    expect(second.interfaceLanguage).toBe('ru')
  })

  it('does not crash store creation when storage throws on read', async () => {
    window.localStorage.broken()

    const store = await freshStore()
    expect(store.interfaceLanguage).toBe('en')
  })

  it('does not crash a setting change when storage throws on write', async () => {
    const store = await freshStore()
    window.localStorage.broken()

    expect(() => {
      store.interfaceLanguage = 'hu'
    }).not.toThrow()
    expect(store.interfaceLanguage).toBe('hu')
  })

  it("drives vue-i18n's own locale", async () => {
    const store = await freshStore()
    expect(i18n.global.locale.value).toBe('en')

    store.interfaceLanguage = 'th'
    expect(i18n.global.locale.value).toBe('th')
  })
})
