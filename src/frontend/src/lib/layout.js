/**
 * The Kedmanee layout — the standard Thai keyboard — as data.
 *
 * The rows below are the character rows of a physical Thai keyboard, in order,
 * so a key highlighted on screen sits where the finger goes on a real one.
 * Two layers: what a key types unshifted, and what it types with Shift held.
 *
 * One key is not Kedmanee's: `!` closes the shift row. Thai typists reach it by
 * switching to a Latin layer, which a learner here has no way to do — and the
 * corpus sentences contain it, so without this key those exercises could not be
 * typed on screen at all. Any character the catalog uses has to be on a key.
 *
 * The table is authored as bare characters and expanded into key objects at
 * module load, because a keycap's `label` is not always its `char`: a Thai tone
 * mark or vowel sign has no advance width and would collapse onto the edge of
 * the key, so it is displayed on a dotted circle the way Unicode charts show it.
 * Tests read `char` and never have to strip that decoration.
 */

// Thai marks that attach to the preceding character instead of standing alone:
// SARA AM (U+0E33) is deliberately absent — it is a spacing character.
const COMBINING = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/
const DOTTED_CIRCLE = '◌'

// prettier-ignore
const BASE = [
  ['_', 'ๅ', '/', '-', 'ภ', 'ถ', 'ุ', 'ึ', 'ค', 'ต', 'จ', 'ข', 'ช'],
  ['ๆ', 'ไ', 'ำ', 'พ', 'ะ', 'ั', 'ี', 'ร', 'น', 'ย', 'บ', 'ล', 'ฃ'],
  ['ฟ', 'ห', 'ก', 'ด', 'เ', '้', '่', 'า', 'ส', 'ว', 'ง'],
  ['ผ', 'ป', 'แ', 'อ', 'ิ', 'ื', 'ท', 'ม', 'ใ', 'ฝ'],
  [' '],
]

// prettier-ignore
const SHIFT = [
  ['%', '+', '๑', '๒', '๓', '๔', 'ู', '฿', '๕', '๖', '๗', '๘', '๙'],
  ['๐', '"', 'ฎ', 'ฑ', 'ธ', 'ํ', '๊', 'ณ', 'ฯ', 'ญ', 'ฐ', ',', 'ฅ'],
  ['ฤ', 'ฆ', 'ฏ', 'โ', 'ฌ', '็', '๋', 'ษ', 'ศ', 'ซ', '.'],
  ['(', ')', 'ฉ', 'ฮ', 'ฺ', '์', '?', 'ฒ', 'ฬ', 'ฦ', '!'],
  [' '],
]

/**
 * The touch-typing finger for each column, row by row.
 *
 * Both layers share the physical key positions, so which finger presses a key
 * depends only on where the key sits — never on what character is printed on
 * it. These are the standard home-row assignments: the index fingers cover two
 * columns each, and the right little finger takes everything past the last
 * letter column.
 *
 * The fourth row carries eleven entries because the shift layer's added `!`
 * extends it by one; the base layer uses the first ten.
 */
// prettier-ignore
const FINGERS = [
  ['l-pinky', 'l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-index', 'r-index', 'r-index', 'r-middle', 'r-ring', 'r-pinky', 'r-pinky', 'r-pinky'],
  ['l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-index', 'r-index', 'r-index', 'r-middle', 'r-ring', 'r-pinky', 'r-pinky', 'r-pinky', 'r-pinky'],
  ['l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-index', 'r-index', 'r-index', 'r-middle', 'r-ring', 'r-pinky', 'r-pinky'],
  ['l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-index', 'r-index', 'r-index', 'r-middle', 'r-ring', 'r-pinky', 'r-pinky'],
  ['thumb'],
]

/** Human-readable names, for the legend and each key's tooltip. */
export const FINGER_NAMES = {
  'l-pinky': 'left little finger',
  'l-ring': 'left ring finger',
  'l-middle': 'left middle finger',
  'l-index': 'left index finger',
  'r-index': 'right index finger',
  'r-middle': 'right middle finger',
  'r-ring': 'right ring finger',
  'r-pinky': 'right little finger',
  thumb: 'thumb',
}

function toKey(char, finger) {
  if (char === ' ') {
    return { char, label: 'space', finger }
  }
  return { char, label: COMBINING.test(char) ? DOTTED_CIRCLE + char : char, finger }
}

/** `LAYERS[layer][row][col]` — layer 0 is unshifted, layer 1 is shifted. */
export const LAYERS = [BASE, SHIFT].map((rows) =>
  rows.map((row, rowIndex) => row.map((char, col) => toKey(char, FINGERS[rowIndex][col]))),
)

export const BASE_LAYER = 0
export const SHIFT_LAYER = 1

/**
 * Where each character lives. Built once: the UI asks this on every keystroke,
 * and searching the rows each time would be a scan of ~90 entries per render.
 */
export const KEY_INDEX = new Map()

LAYERS.forEach((rows, layer) => {
  rows.forEach((keys, row) => {
    keys.forEach((key, col) => {
      // The space bar is on both layers; the first one found wins, so a
      // learner typing a space is never sent to the shift layer for it.
      if (!KEY_INDEX.has(key.char)) {
        KEY_INDEX.set(key.char, { layer, row, col })
      }
    })
  })
})

/** The key holding `char`, or `undefined` if this layout cannot type it. */
export function keyFor(char) {
  return KEY_INDEX.get(char)
}
