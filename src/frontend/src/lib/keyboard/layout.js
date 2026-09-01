import { SPACE_ROW } from './board'

/**
 * A layout: what each position of a board types, on each of its layers.
 *
 * The layer count belongs to the layout, not to this file. Kedmanee needs two —
 * unshifted and Shift. German, French, Spanish and Polish need three: their
 * `@`, `€` and, in Polish's case, every diacritic the language has, live on a
 * layer reached with AltGr, so a keyboard that assumed a base/shift pair could
 * not type Polish at all. Everything here works in "the layer holding this
 * character", never "the shift layer".
 *
 * What a layout cannot do is compose: one key press, one character. Hangul jamo
 * forming a syllable, Vietnamese tone composition and Chinese candidate
 * selection are outside this model — there the next expected character has no
 * single key to point at, which is the whole basis of the highlight. Thai is
 * unusually well suited here precisely because it does not compose.
 */

/**
 * Define a layout, refusing one that does not fit its board.
 *
 * The check is the reason the board and the layout are separate files. A layer
 * with a row of the wrong length is a keyboard that changes shape when a
 * modifier is pressed, and it used to be absorbed silently by extending the
 * finger table to match. Now it throws where the layout is written, naming the
 * row and both counts, because that is the only moment anyone can act on it.
 */
export function defineLayout({ language, name, shortName, board, layers, decorate = () => false }) {
  if (!layers.length) {
    throw new Error(`${name}: a layout needs at least one layer`)
  }

  if (layers[0].modifier != null) {
    throw new Error(`${name}: the first layer is the base layer and is reached with no modifier`)
  }

  const modifiers = layers.slice(1).map((layer) => layer.modifier)

  for (const modifier of modifiers) {
    if (!modifier) {
      throw new Error(`${name}: every layer after the first names the modifier that reaches it`)
    }

    if (!board.furniture.some((key) => key.modifier === modifier)) {
      throw new Error(`${name}: the ${board.name} board has no ${modifier} key to reach that layer`)
    }
  }

  if (new Set(modifiers).size !== modifiers.length) {
    throw new Error(`${name}: two layers cannot be reached by the same modifier`)
  }

  const built = layers.map((layer, index) => ({
    modifier: layer.modifier ?? null,
    rows: buildRows(layer.rows, board, decorate, `${name}: layer ${index}`),
  }))

  return Object.freeze({
    language,
    name,
    // What the layout switcher shows when this layout is the one on screen.
    shortName: shortName ?? language.toUpperCase(),
    board,
    layers: built,
    space: { char: ' ', label: board.space.label, finger: board.space.finger },
    index: indexOf(built),
  })
}

function buildRows(rows, board, decorate, where) {
  if (rows.length !== board.rows.length) {
    throw new Error(
      `${where} has ${rows.length} rows, but the ${board.name} board has ${board.rows.length}`,
    )
  }

  return rows.map((chars, row) => {
    const { fingers } = board.rows[row]

    if (chars.length !== fingers.length) {
      throw new Error(
        `${where}, row ${row} has ${chars.length} keys, but that row of the ` +
          `${board.name} board has ${fingers.length} positions`,
      )
    }

    return chars.map((char, col) => ({
      char,
      // A keycap's label is not always its character: a mark with no advance
      // width would collapse onto the edge of the key, so a layout whose script
      // has them says so and they are shown the way Unicode charts do. Tests
      // read `char` and never have to strip the decoration.
      label: decorate(char) || char,
      finger: fingers[col],
    }))
  })
}

/**
 * Where each character lives. Built once per layout: the UI asks this on every
 * keystroke, and scanning the rows each time would be ~90 comparisons a render.
 */
function indexOf(layers) {
  const index = new Map()

  layers.forEach((layer, layerIndex) => {
    layer.rows.forEach((keys, row) => {
      keys.forEach((key, col) => {
        if (!index.has(key.char)) {
          index.set(key.char, { layer: layerIndex, row, col })
        }
      })
    })
  })

  // The space bar is on every layer, so it names none: a learner typing a space
  // is never sent to another layer for it.
  index.set(' ', { layer: null, space: true })

  return index
}

/** Where `char` sits, or `undefined` if this layout cannot type it. */
export function keyFor(layout, char) {
  return layout.index.get(char)
}

/**
 * `text` with every character this layout cannot produce removed.
 *
 * The layout decides, through its own index, rather than a list of allowed
 * characters kept beside it: a key added or removed changes what exercises ask
 * for in the same edit. Each layout answers for itself — Kedmanee has no `!`,
 * ЙЦУКЕН no `«`, and neither needs to know about the other.
 *
 * Runs in code points, like everything in `checking.js`: the app's unit is one
 * thing the learner typed, never one UTF-16 unit.
 *
 * Removing a character can leave two spaces where the corpus had one, and what
 * this returns is what the learner sees as well as types — so a doubled space
 * would be a keystroke with no visible reason. Runs of spaces collapse to one
 * and the ends are trimmed, which is what `compare` and `isComplete` already do
 * to both sides of a comparison.
 */
export function withoutUntypable(layout, text) {
  return [...text]
    .filter((char) => layout.index.has(char))
    .join('')
    .replace(/ +/g, ' ')
    .trim()
}

/**
 * The modifier that reaches the layer holding `char`, or `undefined` when this
 * layout cannot type it at all.
 *
 * `null` means "no modifier" — the base layer, and also the space bar, which is
 * on every layer and so never moves the keyboard.
 */
export function modifierFor(layout, char) {
  const key = layout.index.get(char)

  if (!key) {
    return undefined
  }

  return key.layer === null ? null : layout.layers[key.layer].modifier
}

/** The modifier controls this layout needs, in the board's own order. */
export function modifierControls(layout) {
  const used = new Set(layout.layers.map((layer) => layer.modifier).filter(Boolean))

  return layout.board.furniture.filter((key) => used.has(key.modifier))
}

/**
 * Everything the keyboard draws, for one modifier state: rows of cells, in the
 * order they are rendered, each cell knowing what it is and what pressing it
 * does.
 *
 * The component binds to this and decides nothing itself, which is what keeps
 * the layer count out of the template — and lets a three-layer layout be tested
 * without a browser.
 */
export function keyboardModel(layout, activeModifier = null) {
  const layer =
    layout.layers.find((candidate) => candidate.modifier === activeModifier) ?? layout.layers[0]

  // Furniture this layout actually has: a modifier key whose layer the layout
  // does not declare is not drawn, so the same board carries a two-layer Thai
  // layout and a three-layer German one without either knowing about the other.
  const used = new Set(modifierControls(layout))
  const drawn = layout.board.furniture.filter((key) => !key.modifier || used.has(key))

  const controls = (row, side) =>
    drawn
      .filter((key) => key.row === row && key.side === side)
      .map((key) => toControl(key, activeModifier))

  const rows = layout.board.rows.map((definition, row) => ({
    indent: definition.indent,
    cells: [
      ...controls(row, 'start'),
      ...layer.rows[row].map((key, col) => ({
        kind: 'char',
        width: definition.widths[col] ?? layout.board.keyWidth,
        ...key,
      })),
      ...controls(row, 'end'),
    ],
  }))

  return {
    rows,
    space: {
      cells: [
        ...controls(SPACE_ROW, 'start'),
        { kind: 'char', width: layout.board.space.width, ...layout.space },
        ...controls(SPACE_ROW, 'end'),
      ],
    },
  }
}

function toControl(key, activeModifier) {
  return {
    kind: key.modifier ? 'modifier' : 'action',
    id: key.id,
    label: key.label,
    ariaLabel: key.ariaLabel ?? key.label,
    width: key.width,
    finger: key.finger,
    modifier: key.modifier ?? null,
    action: key.action ?? null,
    active: Boolean(key.modifier) && key.modifier === activeModifier,
  }
}
