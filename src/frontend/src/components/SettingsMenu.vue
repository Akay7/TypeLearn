<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const { t } = useI18n()

const open = ref(false)
const root = ref(null)

// Three independent settings, one menu. The first two are each a `field` on
// the settings store plus a small set of named values, and share one
// radiogroup template below instead of two near-duplicates. The third is a
// plain boolean, so it gets its own `kind: 'checkbox'` and a single-control
// template instead of a two-option radiogroup — see design.md for why.
// A computed, not a plain constant: `t(...)` reads the active locale
// reactively, but an array built from it once at module load would not
// follow a later change to `settings.interfaceLanguage`.
const GROUPS = computed(() => [
  {
    field: 'virtualKeyboardOverride',
    title: t('settings.keyboardOverride.title'),
    kind: 'radiogroup',
    // Device classification can only guess whether a phone-sized screen has
    // no physical keyboard and a larger one does — this is how the learner
    // corrects it in either direction. 'auto' stays a real, chosen option
    // rather than an implicit default, so a learner who forced it once can
    // see how to get back to it.
    options: [
      {
        value: 'auto',
        label: t('settings.keyboardOverride.auto.label'),
        description: t('settings.keyboardOverride.auto.description'),
      },
      {
        value: 'on',
        label: t('settings.keyboardOverride.on.label'),
        description: t('settings.keyboardOverride.on.description'),
      },
      {
        value: 'off',
        label: t('settings.keyboardOverride.off.label'),
        description: t('settings.keyboardOverride.off.description'),
      },
    ],
  },
  {
    field: 'onScreenKeyboardVisible',
    title: t('settings.onScreenKeyboard.title'),
    kind: 'radiogroup',
    // For a learner who already has a physical keyboard and knows it: the
    // board is a lot of screen for something they are not reading off of.
    options: [
      {
        value: true,
        label: t('settings.onScreenKeyboard.show.label'),
        description: t('settings.onScreenKeyboard.show.description'),
      },
      {
        value: false,
        label: t('settings.onScreenKeyboard.hide.label'),
        description: t('settings.onScreenKeyboard.hide.description'),
      },
    ],
  },
  {
    field: 'showCompletionStats',
    kind: 'checkbox',
    // A single on/off toggle needs one control and one accessible name, not
    // a sibling pair of named options, so this carries its own label and
    // description on the row itself rather than a separate caption heading
    // above it like the radiogroup-based settings have.
    label: t('settings.completionStats.label'),
    description: t('settings.completionStats.description'),
  },
])

// Every interface language, named in itself rather than translated into
// whichever one is currently active — the universal convention for a
// language picker, and the only choice that stays readable to a learner who
// cannot yet read the active language at all.
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'th', label: 'ไทย' },
  { value: 'ru', label: 'Русский' },
  { value: 'hu', label: 'Magyar' },
]

function choose(group, value) {
  settings[group.field] = value
  open.value = false
}

function toggle(group) {
  settings[group.field] = !settings[group.field]
  open.value = false
}

// A menu that only closes on its own toggle traps a learner who taps away
// from it to get back to the exercise — the field beneath it stays reachable
// for typing, so a stray click there should dismiss the menu, not fight it.
function onDocumentClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) {
    open.value = false
  }
}

function onKeydown(event) {
  if (open.value && event.key === 'Escape') {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!-- No position utility of its own: the caller places this (fixed corner,
       inline in a row, ...), and whatever position it ends up with still
       gives the popover below a containing block to anchor against. -->
  <div ref="root">
    <button
      type="button"
      :class="[
        'flex size-10 items-center justify-center rounded-full transition-colors',
        'text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10',
        open ? 'bg-black/5 dark:bg-white/10' : '',
      ]"
      aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="t('settings.button.label')"
      @click="open = !open"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </button>

    <!-- Anchored to the button rather than centred on the screen: this is a
         couple of settings, not a destination, and a full modal would dim
         the exercise behind it for a choice that takes one tap. -->
    <div
      v-if="open"
      class="absolute top-full right-0 z-10 mt-2 max-h-[calc(100dvh-5rem)] w-56 overflow-y-auto overscroll-contain rounded-2xl border border-black/10 bg-[var(--bg)] p-3.5 shadow-xl dark:border-white/15"
    >
      <div
        v-for="(group, index) in GROUPS"
        :key="group.field"
        :role="group.kind === 'checkbox' ? undefined : 'radiogroup'"
        :aria-label="group.kind === 'checkbox' ? undefined : group.title"
        :class="index > 0 ? 'mt-3 border-t border-black/10 pt-3 dark:border-white/10' : ''"
      >
        <!-- A single boolean: one checkbox, labeled and described on the row
             itself rather than under a separate caption heading — see
             design.md. -->
        <template v-if="group.kind === 'checkbox'">
          <button
            type="button"
            role="checkbox"
            :aria-checked="settings[group.field]"
            :aria-label="group.label"
            :aria-describedby="`${group.field}-description`"
            :class="[
              'flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors',
              settings[group.field] ? 'bg-indigo-600/10' : 'hover:bg-black/5 dark:hover:bg-white/5',
            ]"
            @click="toggle(group)"
          >
            <span
              :class="[
                'flex size-3.5 shrink-0 items-center justify-center rounded border',
                settings[group.field] ? 'border-indigo-600 bg-indigo-600' : 'border-black/30 dark:border-white/30',
              ]"
            >
              <svg
                v-if="settings[group.field]"
                class="size-2.5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>

            <span class="flex flex-col">
              <span class="text-sm font-medium text-(--text-h)">{{ group.label }}</span>
              <span :id="`${group.field}-description`" class="text-xs opacity-60">{{ group.description }}</span>
            </span>
          </button>
        </template>

        <template v-else>
          <p class="mb-1.5 px-1.5 text-[11px] font-semibold tracking-wide text-black/50 uppercase dark:text-white/50">
            {{ group.title }}
          </p>

          <button
            v-for="option in group.options"
            :key="String(option.value)"
            type="button"
            role="radio"
            :aria-checked="settings[group.field] === option.value"
            :aria-label="option.label"
            :aria-describedby="`${group.field}-${option.value}`"
            :class="[
              'flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors',
              settings[group.field] === option.value
                ? 'bg-indigo-600/10'
                : 'hover:bg-black/5 dark:hover:bg-white/5',
            ]"
            @click="choose(group, option.value)"
          >
            <span
              :class="[
                'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                settings[group.field] === option.value
                  ? 'border-indigo-600'
                  : 'border-black/30 dark:border-white/30',
              ]"
            >
              <span v-if="settings[group.field] === option.value" class="size-1.5 rounded-full bg-indigo-600" />
            </span>

            <span class="flex flex-col">
              <span class="text-sm font-medium text-(--text-h)">{{ option.label }}</span>
              <span :id="`${group.field}-${option.value}`" class="text-xs opacity-60">{{ option.description }}</span>
            </span>
          </button>
        </template>
      </div>

      <!-- A native select rather than a third radiogroup: six options are
           past the point a row-per-option list reads well in this width, and
           unlike the other two settings, the choices here don't take a short
           label plus description — just a name, which a select shows without
           adding rows to the menu at all. -->
      <div class="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
        <label
          for="interface-language"
          class="mb-1.5 block px-1.5 text-[11px] font-semibold tracking-wide text-black/50 uppercase dark:text-white/50"
        >
          {{ t('settings.language.title') }}
        </label>

        <select
          id="interface-language"
          v-model="settings.interfaceLanguage"
          class="w-full rounded-lg border border-black/15 bg-transparent px-2.5 py-2 text-sm font-medium text-(--text-h) dark:border-white/20"
        >
          <option v-for="language in LANGUAGES" :key="language.value" :value="language.value">
            {{ language.label }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>
