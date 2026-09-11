import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
