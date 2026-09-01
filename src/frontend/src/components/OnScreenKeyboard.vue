<script setup>
import { computed, ref, watch } from 'vue'

import { FINGER_NAMES, keyboardModel, layoutsAvailable, reach } from '../lib/keyboard'
import { hasDiverged, nextExpected } from '../lib/checking'
import { useExerciseStore } from '../stores/exercise'

// The keyboard renders the layout it is handed and knows nothing about which
// one it is: how many layers it has, which modifiers reach them, what the keys
// type, and how a keycap is labelled are all the layout's answers.
const props = defineProps({
  layout: { type: Object, required: true },
})

const store = useExerciseStore()

// Every layout the keyboard may show: the exercise's own, and the companions
// that are always installed beside it — the Latin board a Thai typist switches
// to for a character Kedmanee has no key for.
const available = computed(() => layoutsAvailable(props.layout))

// What is on screen: which layout, and which modifier is held. Both follow the
// next expected character, and both can be moved by the learner.
const shown = ref(props.layout)
const modifier = ref(null)

// Everything drawn, for this layout in this modifier state: rows of cells, each
// knowing what it is and what pressing it does. Deciding that here rather than
// in the template is what keeps the layer count out of the markup — a
// three-layer layout renders through the same code as a two-layer one.
const board = computed(() => keyboardModel(shown.value, modifier.value))

// A new exercise can bring a different layout with it, and the board must come
// back to that exercise's own rather than staying on whatever the last
// character of the last one switched to.
watch(
  () => props.layout,
  (layout) => {
    shown.value = layout
    modifier.value = null
  },
)

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
  [nextChar, available],
  ([char, layouts]) => {
    const where = char ? reach(char, layouts) : undefined

    // A highlight the learner cannot see is worse than a keyboard that moves,
    // so both the layout and the layer follow the next key — which is what a
    // Thai typist does for `!`, a character Kedmanee has no key for at all.
    // The layouts are searched in preference order, so a character both boards
    // carry never switches away from the exercise's own.
    //
    // `undefined` means no available layout can type it, which the presented
    // sentence never contains; the space bar answers `null` because it is on
    // every layer. Neither moves the keyboard.
    if (where) {
      shown.value = where.layout
      modifier.value = where.modifier
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

// Now that the key backgrounds carry finger colour, an indigo highlight would
// be one more hue competing with them. Maximum contrast against every tint,
// in the page's own black and white, keeps the next key unmistakable.
const ACTIVE_CLASSES = 'ring-2 ring-black font-semibold dark:ring-white'

/** Whether this cell is the one worth pressing right now. */
function highlighted(cell) {
  if (cell.kind === 'char') {
    return cell.char === nextChar.value
  }

  if (cell.kind === 'modifier') {
    return cell.active
  }

  return cell.action === 'backspace' && diverged.value
}

function press(cell) {
  if (cell.kind === 'char') {
    store.append(cell.char)
  } else if (cell.kind === 'modifier') {
    // Exactly one layer is displayed: activating a modifier releases whichever
    // was held, and activating the one already held returns to the base layer.
    modifier.value = modifier.value === cell.modifier ? null : cell.modifier
  } else if (cell.action === 'backspace') {
    store.backspace()
  }
}

// Round the available layouts, the way a language key cycles the installed
// ones. The layer does not survive the switch: a modifier held on one board
// says nothing about the next.
function switchLayout() {
  const layouts = available.value
  shown.value = layouts[(layouts.indexOf(shown.value) + 1) % layouts.length]
  modifier.value = null
}

// A fixed width, so the indicator can be balanced by an equal gap on the right
// and the legend stays centred on the board whichever layout is named.
const SWITCH_WIDTH = 'w-14'
</script>

<template>
  <!-- mousedown is prevented on every key so the input keeps focus: a learner
       can mix clicking and typing without clicking back into the field. -->
  <!-- A definite width, not w-fit: the board's width is the layout's widest row
       and must not depend on which layer is showing, or a board that changed
       width when a modifier was pressed would move every key out from under the
       finger aiming at it. It sets `--board`, the width of the exercise column. -->
  <div class="flex w-[var(--board)] flex-col gap-1 rounded-xl bg-black/5 p-4 dark:bg-white/5">
    <div
      v-for="(row, index) in board.rows"
      :key="index"
      :class="['flex w-full gap-1', row.indent]"
    >
      <button
        v-for="cell in row.cells"
        :key="cell.kind === 'char' ? cell.char : cell.id"
        type="button"
        :lang="cell.kind === 'char' ? shown.language : undefined"
        :class="[
          KEY_CLASSES,
          cell.width,
          cell.kind === 'char' ? '' : 'text-sm',
          tint(cell.finger),
          highlighted(cell) ? ACTIVE_CLASSES : '',
        ]"
        :title="fingerName(cell.finger)"
        :aria-label="cell.kind === 'char' ? `${cell.char}, ${fingerName(cell.finger)}` : cell.ariaLabel"
        :aria-pressed="cell.kind === 'modifier' ? cell.active : undefined"
        @mousedown.prevent
        @click="press(cell)"
      >
        {{ cell.label }}
      </button>
    </div>

    <div class="flex w-full justify-center gap-1">
      <button
        v-for="cell in board.space.cells"
        :key="cell.kind === 'char' ? cell.char : cell.id"
        type="button"
        :class="[
          KEY_CLASSES,
          cell.width,
          'text-sm',
          tint(cell.finger),
          highlighted(cell) ? ACTIVE_CLASSES : '',
        ]"
        :title="fingerName(cell.finger)"
        :aria-label="cell.kind === 'char' ? cell.label : cell.ariaLabel"
        :aria-pressed="cell.kind === 'modifier' ? cell.active : undefined"
        @mousedown.prevent
        @click="press(cell)"
      >
        {{ cell.label }}
      </button>
    </div>

    <!-- The bottom bar: which board is on screen, and what the colours mean.
         The layout control sits in the corner, in white rather than a finger
         tint, because it is not a key — switching layout is something the
         operating system does, not a keystroke on any keycap, and a control
         that looked like a key would be read as one more thing to press while
         typing. -->
    <div class="mt-2 flex items-center gap-4">
      <button
        v-if="available.length > 1"
        type="button"
        :class="[
          SWITCH_WIDTH,
          'shrink-0 rounded-md border border-black/15 bg-white px-2 py-1 text-xs font-medium text-black',
          'transition-colors hover:bg-black/5 dark:border-white/25',
        ]"
        :aria-label="`Keyboard layout: ${shown.name} — switch`"
        @mousedown.prevent
        @click="switchLayout()"
      >
        {{ shown.shortName }}
      </button>

      <!-- Colour is only half an answer without the names, and the hands mirror,
           so one set of five covers both. -->
      <ul class="flex grow justify-center gap-4 text-xs opacity-70">
        <li v-for="item in LEGEND" :key="item.finger" class="flex items-center gap-1.5">
          <span :class="['size-3 rounded-sm', item.swatch]" />
          {{ item.name }}
        </li>
      </ul>

      <!-- Balances the control, so the legend is centred on the board rather
           than on whatever space the control leaves. -->
      <div v-if="available.length > 1" :class="[SWITCH_WIDTH, 'shrink-0']" aria-hidden="true" />
    </div>
  </div>
</template>
