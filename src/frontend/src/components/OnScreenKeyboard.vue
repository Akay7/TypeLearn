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

const KEY_CLASSES = 'relative h-12 rounded-lg text-lg transition-colors'

// The on-screen equivalent of the tactile bump a physical keyboard puts on F
// and J: a short bar on the key an index finger rests on when it isn't
// reaching anywhere, so a learner has an anchor to return to. A bar, not a
// dot: a round dot reads as the dotted circle Kedmanee already draws under a
// combining mark's label (◌ + the mark itself, in kedmanee.js) — and ่, the
// right index finger's own home key, is one of those marks, so a dot there
// would be mistaken for the character rather than an indicator about it. The
// bar sits on its own visual channel regardless — a shape at the bottom of
// the key rather than a colour or a border — so it survives being drawn
// under the next-key highlight ring and over any finger tint. Sized as a
// fraction of the key's own width rather than a fixed number of pixels, so it
// scales sensibly on both a normal key and the narrower legend swatch.
const HOME_MARKER_CLASSES =
  'pointer-events-none absolute inset-x-0 bottom-1.5 mx-auto h-1 w-[45%] rounded-full bg-black/50 dark:bg-white/60'

// A colour per finger, so the column a key belongs to is readable at a glance:
// position alone does not say which finger reaches it. Pinky, ring, and
// middle still mirror across hands — one hue for both — because four colours
// are told apart reliably and eight are not. The index fingers are the
// exception: they anchor the home row, so knowing *which* index finger a key
// belongs to matters more than it does for the others. Rather than a hue of
// its own, the right index finger gets a different shade of the same blue —
// close enough to read as "the other index finger" rather than an unrelated
// finger, distinct enough to tell the two apart.
const FINGER_TINT = {
  'l-pinky': 'bg-rose-500/15 hover:bg-rose-500/30 dark:bg-rose-400/20 dark:hover:bg-rose-400/35',
  'l-ring': 'bg-amber-500/15 hover:bg-amber-500/30 dark:bg-amber-400/20 dark:hover:bg-amber-400/35',
  'l-middle': 'bg-emerald-500/15 hover:bg-emerald-500/30 dark:bg-emerald-400/20 dark:hover:bg-emerald-400/35',
  'l-index': 'bg-sky-500/15 hover:bg-sky-500/30 dark:bg-sky-400/20 dark:hover:bg-sky-400/35',
  'r-index': 'bg-blue-600/15 hover:bg-blue-600/30 dark:bg-blue-400/25 dark:hover:bg-blue-400/40',
  'r-middle': 'bg-emerald-500/15 hover:bg-emerald-500/30 dark:bg-emerald-400/20 dark:hover:bg-emerald-400/35',
  'r-ring': 'bg-amber-500/15 hover:bg-amber-500/30 dark:bg-amber-400/20 dark:hover:bg-amber-400/35',
  'r-pinky': 'bg-rose-500/15 hover:bg-rose-500/30 dark:bg-rose-400/20 dark:hover:bg-rose-400/35',
  thumb: 'bg-violet-500/15 hover:bg-violet-500/30 dark:bg-violet-400/20 dark:hover:bg-violet-400/35',
}

// One entry per finger, except the mirrored trio (pinky/ring/middle) which
// still cover both hands with one swatch each. The index fingers get one
// entry per hand, since they are the pair this keyboard tells apart by colour.
const LEGEND = [
  { finger: 'l-pinky', name: 'little', swatch: 'bg-rose-500/40' },
  { finger: 'l-ring', name: 'ring', swatch: 'bg-amber-500/40' },
  { finger: 'l-middle', name: 'middle', swatch: 'bg-emerald-500/40' },
  { finger: 'l-index', name: 'left index', swatch: 'bg-sky-500/40' },
  { finger: 'r-index', name: 'right index', swatch: 'bg-blue-600/40' },
  { finger: 'thumb', name: 'thumb', swatch: 'bg-violet-500/40' },
]

const tint = (finger) => FINGER_TINT[finger] ?? ''
const fingerName = (finger) => FINGER_NAMES[finger] ?? ''

// Read out alongside the finger name, so the marker means the same thing to a
// screen reader that it does visually.
const homeSuffix = (cell) => (cell.home ? ', rest position' : '')

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
        :aria-label="
          cell.kind === 'char'
            ? `${cell.char}, ${fingerName(cell.finger)}${homeSuffix(cell)}`
            : cell.ariaLabel
        "
        :aria-pressed="cell.kind === 'modifier' ? cell.active : undefined"
        @mousedown.prevent
        @click="press(cell)"
      >
        {{ cell.label }}
        <span v-if="cell.home" :class="HOME_MARKER_CLASSES" aria-hidden="true" />
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

      <!-- Colour is only half an answer without the names, and most fingers
           still mirror across hands, so this stays short despite covering
           nine finger positions. -->
      <ul class="flex grow flex-wrap justify-center gap-x-4 gap-y-1 text-xs opacity-70">
        <li v-for="item in LEGEND" :key="item.finger" class="flex items-center gap-1.5">
          <span :class="['size-3 rounded-sm', item.swatch]" />
          {{ item.name }}
        </li>
        <!-- Not a finger colour, so it sits outside the data-driven list: the
             dot itself, on a neutral swatch, explained the way each colour is. -->
        <li class="flex items-center gap-1.5">
          <span class="relative size-3 rounded-sm bg-black/10 dark:bg-white/10">
            <span :class="HOME_MARKER_CLASSES" />
          </span>
          rest position
        </li>
      </ul>

      <!-- Balances the control, so the legend is centred on the board rather
           than on whatever space the control leaves. -->
      <div v-if="available.length > 1" :class="[SWITCH_WIDTH, 'shrink-0']" aria-hidden="true" />
    </div>
  </div>
</template>
