import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useIsPhone } from '../lib/device'

const OVERRIDE_KEY = 'typelearn.virtualKeyboardOverride'
const KEYBOARD_KEY = 'typelearn.onScreenKeyboardVisible'
const COMPLETION_STATS_KEY = 'typelearn.showCompletionStats'

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

  // Synchronous, not batched: the choice should survive a tab closed right
  // after it's made, not wait for a tick that might not come.
  watch(virtualKeyboardOverride, saveOverride, { flush: 'sync' })
  watch(onScreenKeyboardVisible, saveKeyboardVisible, { flush: 'sync' })
  watch(showCompletionStats, saveCompletionStatsVisible, { flush: 'sync' })

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
  }
})
