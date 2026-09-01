/**
 * The physical board: where the keys are, and which finger presses each one.
 *
 * What a key *types* is not here — that is a layout, and several of them can
 * sit on this same board (see `layout.js`). The split is what makes "every
 * layer is the same board" the shape of the data rather than a rule someone has
 * to remember: a layer is a list of characters for *these* positions, so a
 * layer with one key more is not a layer of this keyboard and is refused where
 * it is written. The version of this file that interleaved fingers with
 * characters had no way to say that, which is how a shift layer carrying an
 * eleventh key acquired a finger and went unnoticed.
 *
 * ANSI is the only board described. An ISO board — 102 keys, a shorter left
 * Shift, an extra key beside it — is expressible as another object of this
 * shape, and nothing here assumes there is one board.
 *
 * The widths and indents are Tailwind classes, because a board's geometry is
 * exactly what they express: the stagger of the rows and the 2.25 units of a
 * left Shift are properties of the keyboard, not decisions the component makes.
 */

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

/**
 * The touch-typing finger for each position, row by row.
 *
 * The standard home-row assignments: the index fingers cover two columns each,
 * and the right little finger takes everything past the last letter column. One
 * entry per position — the length of a row here *is* the length of that row on
 * every layer of every layout on this board.
 */
// prettier-ignore
const FINGERS = [
  ['l-pinky', 'l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-index', 'r-index', 'r-index', 'r-middle', 'r-ring', 'r-pinky', 'r-pinky', 'r-pinky'],
  ['l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-index', 'r-index', 'r-index', 'r-middle', 'r-ring', 'r-pinky', 'r-pinky', 'r-pinky', 'r-pinky'],
  ['l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-index', 'r-index', 'r-index', 'r-middle', 'r-ring', 'r-pinky', 'r-pinky'],
  ['l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-index', 'r-index', 'r-index', 'r-middle', 'r-ring', 'r-pinky'],
]

/**
 * One key unit — the width of an ordinary character key, and the unit every
 * measurement below is expressed in. 1u = 3rem, so 1.5u is `w-18`.
 */
const KEY_WIDTH = 'w-12'

/**
 * The stagger, as an indent per row, in the units a physical ANSI board uses:
 * Tab is 1.5u and Caps Lock 1.75u.
 *
 * The modifiers below sit where a physical board puts them — Backspace closing
 * the number row, Shift opening the ZXCV row — so these only stand in for the
 * keys this keyboard does not render: Tab before the second row and Caps Lock
 * before the third. The last row needs none, because the Shift key itself is
 * the offset.
 */
const INDENTS = ['', 'pl-18', 'pl-21', '']

/**
 * The positions that are not one unit wide, by column.
 *
 * One of them on ANSI: the key closing the QWERTY row — `\` on a US board,
 * `ฃ` and `ฅ` on Kedmanee — is 1.5u. Everything else in the character rows is
 * 1u, so this stays a list of exceptions rather than a width per key.
 */
const WIDTHS = [{}, { 12: 'w-18' }, {}, {}]

/**
 * The keys that are not characters.
 *
 * `modifier` names the layer a key selects. A layout that declares no layer for
 * that modifier does not get the key — which is what lets one board carry a
 * two-layer Thai layout and a three-layer German one without either of them
 * knowing about the other. `row` indexes the character rows, except for
 * `SPACE_ROW`, the row the space bar is on.
 */
export const SPACE_ROW = 4

const FURNITURE = [
  {
    id: 'backspace',
    row: 0,
    side: 'end',
    // 2u.
    width: 'w-24',
    finger: 'r-pinky',
    label: '⌫',
    ariaLabel: 'Backspace',
    action: 'backspace',
  },
  {
    id: 'shift-left',
    row: 3,
    side: 'start',
    // 2.25u, the width of a physical left Shift.
    width: 'w-27',
    finger: 'l-pinky',
    label: '⇧ Shift',
    modifier: 'shift',
  },
  {
    id: 'shift-right',
    row: 3,
    side: 'end',
    // Whatever is left of the row, as on a physical board.
    width: 'grow',
    finger: 'r-pinky',
    label: '⇧ Shift',
    modifier: 'shift',
  },
  {
    // Right of the space bar, where a physical board puts it. Only appears for
    // a layout that has a layer behind it — German, French, Polish, Spanish.
    id: 'altgr',
    row: SPACE_ROW,
    side: 'end',
    // 1.25u, like every key on a physical bottom row except the space bar.
    width: 'w-15',
    finger: 'thumb',
    label: 'AltGr',
    modifier: 'altgr',
  },
]

/** The 47-key ANSI board, which Kedmanee and most Latin layouts sit on. */
export const ANSI = {
  name: 'ANSI',
  keyWidth: KEY_WIDTH,
  rows: FINGERS.map((fingers, row) => ({
    fingers,
    indent: INDENTS[row],
    widths: WIDTHS[row],
  })),
  // The space bar is furniture, not a character row: it is on every layer of
  // every layout, so a layout that had to list it once per layer would be
  // repeating the board back to itself.
  // 6.25u, a physical space bar.
  space: { width: 'w-75', finger: 'thumb', label: 'space' },
  furniture: FURNITURE,
}
