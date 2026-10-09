const CLIENT_ID_KEY = 'typelearn.clientId'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Where the id lives when storage refuses to keep it: the rest of this visit.
let sessionId = null

/**
 * This browser's anonymous id, sent with a rating or a suggested translation.
 *
 * It identifies nothing but the browser, and it proves nothing: it exists so
 * that rating a translation twice replaces the first rating rather than adding
 * a second, and so the server's rate limits have something to count. Made once
 * and kept, so it survives reloads; a browser that refuses storage gets one per
 * visit instead.
 */
export function clientId() {
  try {
    const stored = window.localStorage.getItem(CLIENT_ID_KEY)
    if (stored && UUID.test(stored)) {
      return stored
    }
    const fresh = crypto.randomUUID()
    window.localStorage.setItem(CLIENT_ID_KEY, fresh)
    return fresh
  } catch {
    sessionId ??= crypto.randomUUID()
    return sessionId
  }
}
