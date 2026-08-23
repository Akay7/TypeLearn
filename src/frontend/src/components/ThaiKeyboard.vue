<script setup>
import { computed, ref, watch } from 'vue'

import { FINGER_NAMES, LAYERS, keyFor } from '../lib/layout'
import { hasDiverged, nextExpected } from '../lib/checking'
import { useExerciseStore } from '../stores/exercise'

const store = useExerciseStore()

// Which layer is on screen. The learner can toggle it, and the watcher below
// moves it whenever the next expected character lives somewhere else.
const layer = ref(0)

// The last row of the layout data holds the space bar; the four above it are
// the character rows of a physical Thai keyboard.
const rows = computed(() => LAYERS[layer.value].slice(0, 4))
const spaceKey = computed(() => LAYERS[layer.value][4][0])

const nextChar = computed(() =>
  store.current ? nextExpected(store.typed, store.current.sentence) : null,
)

// Once the answer has gone wrong there is no next character to point at, and a
// keyboard with nothing lit reads as "no idea what to do now". Backspace is the
// one key that is always the right answer in that state, so it takes the
// highlight until the answer is a correct prefix again.
const diverged = computed(() =>
  store.current ? hasDiverged(store.typed, store.current.sentence) : false,
)

watch(
  nextChar,
  (char) => {
    const key = char ? keyFor(char) : undefined

    // A highlight the learner cannot see is worse than a keyboard that moves,
    // so the layer follows the next key. Characters this layout cannot type
    // leave the displayed layer alone.
    if (key) {
      layer.value = key.layer
    }
  },
  { immediate: true },
)

const KEY_CLASSES = 'h-12 rounded-lg text-lg transition-colors'

// A colour per finger, so the column a key belongs to is readable at a glance:
// position alone does not say which finger reaches it. The two hands mirror
// each other — one hue per finger rather than eight separate hues — because
// four colours are told apart reliably and eight are not, and which hand is
// never in doubt once the board is split down the middle.
const FINGER_TINT = {
  'l-pinky': 'bg-rose-500/15 hover:bg-rose-500/30 dark:bg-rose-400/20 dark:hover:bg-rose-400/35',
  'l-ring': 'bg-amber-500/15 hover:bg-amber-500/30 dark:bg-amber-400/20 dark:hover:bg-amber-400/35',
  'l-middle': 'bg-emerald-500/15 hover:bg-emerald-500/30 dark:bg-emerald-400/20 dark:hover:bg-emerald-400/35',
  'l-index': 'bg-sky-500/15 hover:bg-sky-500/30 dark:bg-sky-400/20 dark:hover:bg-sky-400/35',
  'r-index': 'bg-sky-500/15 hover:bg-sky-500/30 dark:bg-sky-400/20 dark:hover:bg-sky-400/35',
  'r-middle': 'bg-emerald-500/15 hover:bg-emerald-500/30 dark:bg-emerald-400/20 dark:hover:bg-emerald-400/35',
  'r-ring': 'bg-amber-500/15 hover:bg-amber-500/30 dark:bg-amber-400/20 dark:hover:bg-amber-400/35',
  'r-pinky': 'bg-rose-500/15 hover:bg-rose-500/30 dark:bg-rose-400/20 dark:hover:bg-rose-400/35',
  thumb: 'bg-violet-500/15 hover:bg-violet-500/30 dark:bg-violet-400/20 dark:hover:bg-violet-400/35',
}

// One entry per finger of one hand: the mirror makes a second set redundant.
const LEGEND = [
  { finger: 'l-pinky', name: 'little', swatch: 'bg-rose-500/40' },
  { finger: 'l-ring', name: 'ring', swatch: 'bg-amber-500/40' },
  { finger: 'l-middle', name: 'middle', swatch: 'bg-emerald-500/40' },
  { finger: 'l-index', name: 'index', swatch: 'bg-sky-500/40' },
  { finger: 'thumb', name: 'thumb', swatch: 'bg-violet-500/40' },
]

const tint = (finger) => FINGER_TINT[finger] ?? ''
const fingerName = (finger) => FINGER_NAMES[finger] ?? ''

// A uniform key width and the stagger of a real keyboard: the argument for
// Kedmanee is that the highlighted key sits where the finger goes, which only
// holds if the rows line up in the same offset columns a physical board has.
//
// The modifiers sit where a physical board puts them — Backspace closing the
// number row, Shift opening the ZXCV row — so the indents only have to stand in
// for the keys this keyboard does not render: Tab before the second row and
// Caps Lock before the third. The last row needs none, because the Shift key
// itself is the offset.
const ROW_INDENT = ['', 'pl-20', 'pl-24', '']

// Now that the key backgrounds carry finger colour, an indigo highlight would
// be one more hue competing with them. Maximum contrast against every tint,
// in the page's own black and white, keeps the next key unmistakable.
const ACTIVE_CLASSES = 'ring-2 ring-black font-semibold dark:ring-white'

// 2.25 key units, the width of a physical left Shift.
const SHIFT_WIDTH = 'w-28'

function toggleLayer() {
  layer.value = layer.value === 1 ? 0 : 1
}
</script>

<template>
  <!-- mousedown is prevented on every key so the input keeps focus: a learner
       can mix clicking and typing without clicking back into the field. -->
  <!-- A definite width, not w-fit: the shift layer carries one key more than the
       base layer, and a board that changed width when the layer flipped would
       move every key out from under the finger aiming at it. The number row is
       the widest, so it sets `--board`, the width of the whole exercise column. -->
  <div class="flex w-[var(--board)] flex-col gap-1 rounded-xl bg-black/5 p-4 dark:bg-white/5">
    <div
      v-for="(keys, row) in rows"
      :key="row"
      :class="['flex w-full gap-1', ROW_INDENT[row]]"
    >
      <!-- Left Shift opens the last row, as it does on a physical keyboard. -->
      <button
        v-if="row === 3"
        type="button"
        :class="[KEY_CLASSES, SHIFT_WIDTH, 'text-sm', tint('l-pinky'), layer === 1 ? ACTIVE_CLASSES : '']"
        :title="fingerName('l-pinky')"
        :aria-pressed="layer === 1"
        @mousedown.prevent
        @click="toggleLayer()"
      >
        ⇧ Shift
      </button>

      <button
        v-for="key in keys"
        :key="key.char"
        type="button"
        lang="th"
        :class="[KEY_CLASSES, 'w-12', tint(key.finger), key.char === nextChar ? ACTIVE_CLASSES : '']"
        :title="fingerName(key.finger)"
        :aria-label="`${key.char}, ${fingerName(key.finger)}`"
        @mousedown.prevent
        @click="store.append(key.char)"
      >
        {{ key.label }}
      </button>

      <!-- Backspace closes the number row, where the physical key lives. -->
      <button
        v-if="row === 0"
        type="button"
        :class="[KEY_CLASSES, 'w-20 text-sm', tint('r-pinky'), diverged ? ACTIVE_CLASSES : '']"
        :title="fingerName('r-pinky')"
        aria-label="Backspace"
        @mousedown.prevent
        @click="store.backspace()"
      >
        ⌫
      </button>

      <button
        v-if="row === 3"
        type="button"
        :class="[KEY_CLASSES, 'grow text-sm', tint('r-pinky'), layer === 1 ? ACTIVE_CLASSES : '']"
        :title="fingerName('r-pinky')"
        :aria-pressed="layer === 1"
        @mousedown.prevent
        @click="toggleLayer()"
      >
        ⇧ Shift
      </button>
    </div>

    <div class="flex w-full justify-center gap-1">
      <button
        type="button"
        :class="[KEY_CLASSES, 'w-96 text-sm', tint(spaceKey.finger), spaceKey.char === nextChar ? ACTIVE_CLASSES : '']"
        :title="fingerName(spaceKey.finger)"
        :aria-label="spaceKey.label"
        @mousedown.prevent
        @click="store.append(spaceKey.char)"
      >
        {{ spaceKey.label }}
      </button>
    </div>

    <!-- Colour is only half an answer without the names, and the hands mirror,
         so one set of five covers both. -->
    <ul class="mt-2 flex justify-center gap-4 text-xs opacity-70">
      <li v-for="item in LEGEND" :key="item.finger" class="flex items-center gap-1.5">
        <span :class="['size-3 rounded-sm', item.swatch]" />
        {{ item.name }}
      </li>
    </ul>
  </div>
</template>
