/**
 * Day-bucketed practice counters, kept entirely in the browser.
 *
 * Three counts — symbols typed correctly, key presses, exercises completed —
 * are recorded per local calendar day under one `localStorage` key, as a
 * single JSON object keyed by date (`YYYY-MM-DD`, the learner's own
 * timezone). One key rather than one entry per day keeps every operation
 * here a plain object read-modify-write, with no iteration over
 * `localStorage` itself.
 *
 * Nothing here is reactive — `stores/stats.js` wraps these functions in a
 * Pinia store for that. This module is the part worth unit-testing against a
 * fixed date and a mocked `localStorage`, independent of Vue or Pinia.
 */

const STORAGE_KEY = 'typelearn.stats.daily'

// How many calendar days of counts are kept and summed. Today counts as one
// of the seven, so "last 7 days" is today plus the six before it.
const RETENTION_DAYS = 7

/** In-memory fallback, used for the whole session when `localStorage` is
 * unavailable or throws (private browsing, quota, disabled storage) — a
 * record call still behaves as if it succeeded, just without surviving a
 * reload. Module-level, like `stores/settings.js`'s equivalent, so it
 * persists across calls within the same page load. */
let memory = {}

function emptyDay() {
  return { symbolsCorrect: 0, keysPressed: 0, exercisesCompleted: 0 }
}

/** `YYYY-MM-DD` for `date`, in local time — never UTC, since a day boundary
 * is what the learner's own clock says it is. */
function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** The keys of the last `RETENTION_DAYS` calendar days, today first. */
function recentKeys(now) {
  const keys = []
  for (let i = 0; i < RETENTION_DAYS; i += 1) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    keys.push(dateKey(date))
  }
  return keys
}

/** Every stored day whose key is not among the last `RETENTION_DAYS` is
 * dropped, so the payload never grows past a week regardless of how long
 * the app has been in use. */
function prune(days, now) {
  const keep = new Set(recentKeys(now))
  const pruned = {}
  for (const [key, value] of Object.entries(days)) {
    if (keep.has(key)) {
      pruned[key] = value
    }
  }
  return pruned
}

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return memory
  }
}

function save(days) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(days))
  } catch {
    // Storage unavailable — the counts still apply for this session.
    memory = days
  }
}

/** Adds `amount` to one field of today's counts, pruning old days on the way
 * out so every write is also the moment stale entries are dropped. */
function record(field, amount) {
  if (amount === 0) {
    return
  }

  const now = new Date()
  const days = load()
  const key = dateKey(now)
  const day = days[key] ?? emptyDay()

  day[field] += amount
  days[key] = day

  save(prune(days, now))
}

/** A wrong key followed by its correction is two key presses, not one — this
 * takes the raw count rather than assuming "one" so the caller (the `typed`
 * watcher, which sees the net length change of a possibly multi-character
 * edit) can report exactly how many keystrokes a change represents. */
export function recordKeyPress(count = 1) {
  record('keysPressed', count)
}

/** A symbol counts as correct at the moment it is typed, independent of
 * whether the exercise it belongs to is ultimately finished correctly. */
export function recordCorrectSymbols(count = 1) {
  record('symbolsCorrect', count)
}

export function recordExerciseCompleted() {
  record('exercisesCompleted', 1)
}

/** Today's counts, or all zeros if nothing has been recorded yet. */
export function today() {
  const days = load()
  return { ...emptyDay(), ...days[dateKey(new Date())] }
}

/** The sum of the last 7 calendar days' counts, today included. */
export function last7Days() {
  const days = load()
  const totals = emptyDay()

  for (const key of recentKeys(new Date())) {
    const day = days[key]
    if (!day) {
      continue
    }

    totals.symbolsCorrect += day.symbolsCorrect ?? 0
    totals.keysPressed += day.keysPressed ?? 0
    totals.exercisesCompleted += day.exercisesCompleted ?? 0
  }

  return totals
}
