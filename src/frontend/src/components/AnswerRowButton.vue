<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// The answer row's one button: Check while the learner types, Next exercise
// once the post-check summary has taken the row over. The summary pins its
// Next button to exactly the box Check occupied (`CompletionStats.vue`), so
// the two have to be the same size whichever label a locale gives them —
// which is why this one component draws both, rather than each caller
// sizing its own.
defineProps({
  // What the button says, and its accessible name at every width.
  label: { type: String, required: true },
  // What it shows instead below `md`, where it is a circle.
  glyph: { type: String, required: true },
})

const { t } = useI18n()

// Every label this button is ever given, laid invisibly into the same grid
// cell as the visible one: the pill is then as wide as the widest of them,
// Check's and Next's alike. A fixed width was the previous answer, and it
// held "Check" and "Next exercise →" but not "Следующее упражнение →",
// which ran out past the pill's edge.
const reserved = computed(() => [t('answer.check'), t('stats.next')])
</script>

<template>
  <!--
    Below `md` it is a `size-12` circle showing `glyph` alone: a label pill
    left a phone's answer field about a third of the row, and the summary
    needs that width for its table. The label stays inside as `sr-only`
    text, so screen readers and tests find the same name at every width.
  -->
  <button
    type="button"
    class="grid size-12 shrink-0 place-items-center rounded-full bg-indigo-600 text-xl font-medium whitespace-nowrap text-white transition hover:bg-indigo-500 md:h-auto md:w-auto md:min-w-44 md:px-6 md:py-3 md:text-base"
  >
    <span class="col-start-1 row-start-1 md:hidden" aria-hidden="true">{{ glyph }}</span>
    <span class="col-start-1 row-start-1 max-md:sr-only">{{ label }}</span>
    <span
      v-for="text in reserved"
      :key="text"
      class="invisible col-start-1 row-start-1 max-md:hidden"
      aria-hidden="true"
    >{{ text }}</span>
  </button>
</template>
