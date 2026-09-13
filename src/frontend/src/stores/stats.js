import { defineStore } from 'pinia'
import { ref } from 'vue'

import * as dailyStats from '../lib/stats'

/**
 * A thin, reactive wrapper over `lib/stats.js`.
 *
 * The day-bucketing and `localStorage` logic lives there, pure and easily
 * tested against a fixed date; this store's only job is to give components
 * `today` and `last7Days` as refs that update the moment something is
 * recorded, without every caller re-reading `localStorage` by hand.
 */
export const useStatsStore = defineStore('stats', () => {
  const today = ref(dailyStats.today())
  const last7Days = ref(dailyStats.last7Days())

  /** Re-reads both totals from storage. Cheap — a handful of property
   * reads off one parsed JSON blob — so it runs after every record call
   * rather than trying to patch the two refs by hand. */
  function refresh() {
    today.value = dailyStats.today()
    last7Days.value = dailyStats.last7Days()
  }

  function recordKeyPress(count = 1) {
    dailyStats.recordKeyPress(count)
    refresh()
  }

  function recordCorrectSymbols(count = 1) {
    dailyStats.recordCorrectSymbols(count)
    refresh()
  }

  function recordExerciseCompleted() {
    dailyStats.recordExerciseCompleted()
    refresh()
  }

  return { today, last7Days, recordKeyPress, recordCorrectSymbols, recordExerciseCompleted }
})
