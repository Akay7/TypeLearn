import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useIsPhone } from '../lib/device'
import { i18n, SUPPORTED_LANGUAGES } from '../i18n'

const OVERRIDE_KEY = 'typelearn.virtualKeyboardOverride'
const KEYBOARD_KEY = 'typelearn.onScreenKeyboardVisible'
const COMPLETION_STATS_KEY = 'typelearn.showCompletionStats'
const LANGUAGE_KEY = 'typelearn.interfaceLanguage'

// 'auto' follows the device classification; 'on'/'off' force the virtual
// keyboard either way, for the cases classification gets wrong in either
// direction — a tablet with a physical keyboard attached, or a phone-sized
// device the heuristic misreads.
const OVERRIDES = new Set(['auto', 'on', 'off'])

/** The persisted override, or `'auto'` if storage is unavailable (private
 * browsing, disabled storage) or holds something other than a known value
 * (never written by this app, or written by an older version of it). */
function loadOverride() {
  try {
    const stored = window.localStorage.getItem(OVERRIDE_KEY)
    return OVERRIDES.has(stored) ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

/** Best-effort persistence: a learner whose browser refuses storage keeps
 * working for the session, just without the choice surviving a reload. */
function saveOverride(value) {
  try {
    window.localStorage.setItem(OVERRIDE_KEY, value)
  } catch {
    // Storage unavailable — the override still applies for this session.
  }
}

/** Shown by default — a learner has to opt out, never opt in, to keep the
 * board there for anyone who hasn't touched the setting. */
function loadKeyboardVisible() {
  try {
    const stored = window.localStorage.getItem(KEYBOARD_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

function saveKeyboardVisible(value) {
  try {
    window.localStorage.setItem(KEYBOARD_KEY, String(value))
  } catch {
    // Storage unavailable — the choice still applies for this session.
  }
}

/** Shown by default, the same as the on-screen keyboard: a learner has to
 * opt out of the post-check summary rather than opt in. */
function loadCompletionStatsVisible() {
  try {
    const stored = window.localStorage.getItem(COMPLETION_STATS_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

function saveCompletionStatsVisible(value) {
  try {
    window.localStorage.setItem(COMPLETION_STATS_KEY, String(value))
  } catch {
    // Storage unavailable — the choice still applies for this session.
  }
}

/** The base subtag of a BCP-47 tag ('fr-CA' -> 'fr'), lowercased — none of
 * the six catalogs are regional variants, so a region suffix is dropped
 * rather than treated as a mismatch. */
function baseSubtag(tag) {
  return tag.split('-')[0].toLowerCase()
}

/** The browser's own language, if one of the six this app carries a
 * catalog for; `'en'` otherwise, including when the browser reports
 * nothing at all (no `navigator`, or a language-less environment). */
function browserLanguage() {
  const tag = typeof navigator === 'undefined' ? undefined : navigator.language
  if (!tag) return 'en'
  const base = baseSubtag(tag)
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'en'
}

/** The persisted interface language, or the browser's own (via
 * `browserLanguage`) when nothing has been stored yet or what is stored is
 * not one of the six supported languages. */
function loadLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY)
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : browserLanguage()
  } catch {
    return browserLanguage()
  }
}

function saveLanguage(value) {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, value)
  } catch {
    // Storage unavailable — the choice still applies for this session.
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const virtualKeyboardOverride = ref(loadOverride())
  const isPhone = useIsPhone()

  // A learner who already has a physical keyboard — and can see it works,
  // since typing has reached this far — may want the board gone entirely
  // rather than just the OS keyboard suppressed: it is a lot of screen for
  // something they are not reading off of.
  const onScreenKeyboardVisible = ref(loadKeyboardVisible())

  // Independent of both settings above: whether a correct check shows the
  // post-check summary (and waits for the learner) or behaves as it always
  // has (verdict, then straight to the next exercise).
  const showCompletionStats = ref(loadCompletionStatsVisible())
  const interfaceLanguage = ref(loadLanguage())

  // Synchronous, not batched: the choice should survive a tab closed right
  // after it's made, not wait for a tick that might not come.
  watch(virtualKeyboardOverride, saveOverride, { flush: 'sync' })
  watch(onScreenKeyboardVisible, saveKeyboardVisible, { flush: 'sync' })
  watch(showCompletionStats, saveCompletionStatsVisible, { flush: 'sync' })
  watch(interfaceLanguage, saveLanguage, { flush: 'sync' })

  // The one place `interfaceLanguage` drives what the rest of the app reads:
  // every component keeps reading this store for every setting, rather than
  // half of them importing vue-i18n's own locale ref directly. `immediate`
  // applies the stored or browser-derived default before anything renders,
  // so there is no flash of the wrong language while the app boots.
  watch(
    interfaceLanguage,
    (value) => {
      i18n.global.locale.value = value
    },
    { flush: 'sync', immediate: true },
  )

  // What AnswerInput.vue actually needs: one boolean, the override applied
  // over the device default.
  const virtualKeyboardEnabled = computed(() => {
    if (virtualKeyboardOverride.value === 'on') return true
    if (virtualKeyboardOverride.value === 'off') return false
    return !isPhone.value
  })

  return {
    virtualKeyboardOverride,
    virtualKeyboardEnabled,
    onScreenKeyboardVisible,
    showCompletionStats,
    interfaceLanguage,
  }
})
