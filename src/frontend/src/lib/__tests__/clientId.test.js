import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function fakeStorage({ broken = false } = {}) {
  const data = new Map()
  return {
    getItem: (key) => {
      if (broken) throw new Error('storage disabled')
      return data.has(key) ? data.get(key) : null
    },
    setItem: (key, value) => {
      if (broken) throw new Error('storage disabled')
      data.set(key, String(value))
    },
  }
}

// A fresh module each time: the in-memory fallback is module state.
async function load() {
  vi.resetModules()
  return (await import('../clientId')).clientId
}

beforeEach(() => {
  globalThis.window = globalThis.window ?? {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the browser client id', () => {
  it('is a UUID, made once and kept', async () => {
    window.localStorage = fakeStorage()
    const clientId = await load()

    const first = clientId()

    expect(first).toMatch(UUID)
    expect(clientId()).toBe(first)
    expect(window.localStorage.getItem('typelearn.clientId')).toBe(first)
  })

  it('survives a reload', async () => {
    window.localStorage = fakeStorage()
    const first = (await load())()

    expect((await load())()).toBe(first)
  })

  it('replaces a stored value that is not a UUID', async () => {
    window.localStorage = fakeStorage()
    window.localStorage.setItem('typelearn.clientId', 'tampered')

    expect((await load())()).toMatch(UUID)
  })

  it('lasts the visit when storage is refused', async () => {
    window.localStorage = fakeStorage({ broken: true })
    const clientId = await load()

    const first = clientId()

    expect(first).toMatch(UUID)
    expect(clientId()).toBe(first)
  })
})
