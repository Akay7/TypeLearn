import { describe, expect, it } from 'vitest'

import { ANSI } from '../board'
import { KEDMANEE } from '../kedmanee'
import {
  defineLayout,
  keyboardModel,
  keyFor,
  modifierControls,
  modifierFor,
  withoutUntypable,
} from '../layout'

/**
 * A row of `count` copies of `char` — enough to fill a board position without a
 * fixture having to spell out 47 characters it does not care about.
 */
const filled = (count, char) => Array.from({ length: count }, () => char)

/** The shape of a board's rows, which every layer of every layout must match. */
const shapeOf = (board) => board.rows.map((row) => row.fingers.length)

/**
 * Three layers on the ANSI board, standing in for the layouts that need one —
 * German, French, Spanish, Polish, whose `@`, `€` and diacritics live behind
 * AltGr. Deliberately a fixture and not a real German layout: shipping a board
 * nobody has proof-read against a physical keyboard would repeat the mistake
 * that put `!` on Kedmanee.
 */
function threeLayerFixture(overrides = {}) {
  const rowsOf = (char) => shapeOf(ANSI).map((count) => filled(count, char))

  const layers = [
    { modifier: null, rows: rowsOf('a') },
    { modifier: 'shift', rows: rowsOf('A') },
    { modifier: 'altgr', rows: rowsOf('ą') },
  ]

  // One distinguishable key per layer, so a test can ask which layer holds what.
  layers[0].rows[2][0] = 'e'
  layers[1].rows[2][0] = 'E'
  layers[2].rows[2][0] = '€'

  return defineLayout({
    language: 'xx',
    name: 'Fixture',
    board: ANSI,
    layers,
    ...overrides,
  })
}

describe('a layout must fit its board', () => {
  it('accepts a layout whose every layer covers the board', () => {
    const fixture = threeLayerFixture()

    fixture.layers.forEach((layer) => {
      expect(layer.rows.map((keys) => keys.length)).toEqual(shapeOf(ANSI))
    })
  })

  it('refuses a layer with a row of the wrong length', () => {
    // The defect this whole arrangement exists to make unrepresentable: a shift
    // layer one key longer than the base layer, which used to be absorbed by
    // extending the finger table and showed up as a board that reshaped itself.
    expect(() =>
      threeLayerFixture({
        layers: [
          { modifier: null, rows: shapeOf(ANSI).map((count) => filled(count, 'a')) },
          {
            modifier: 'shift',
            rows: shapeOf(ANSI).map((count, row) => filled(row === 3 ? count + 1 : count, 'A')),
          },
        ],
      }),
    ).toThrow(/row 3 has 11 keys, but that row of the ANSI board has 10/)
  })

  it('refuses a layout with the wrong number of rows', () => {
    expect(() =>
      threeLayerFixture({
        layers: [{ modifier: null, rows: [filled(13, 'a')] }],
      }),
    ).toThrow(/has 1 rows, but the ANSI board has 4/)
  })

  it('refuses a layer reached by a modifier the board does not have', () => {
    expect(() =>
      threeLayerFixture({
        layers: [
          { modifier: null, rows: shapeOf(ANSI).map((count) => filled(count, 'a')) },
          { modifier: 'hyper', rows: shapeOf(ANSI).map((count) => filled(count, 'A')) },
        ],
      }),
    ).toThrow(/no hyper key/)
  })

  it('refuses two layers reached by the same modifier', () => {
    expect(() =>
      threeLayerFixture({
        layers: [
          { modifier: null, rows: shapeOf(ANSI).map((count) => filled(count, 'a')) },
          { modifier: 'shift', rows: shapeOf(ANSI).map((count) => filled(count, 'A')) },
          { modifier: 'shift', rows: shapeOf(ANSI).map((count) => filled(count, 'B')) },
        ],
      }),
    ).toThrow(/same modifier/)
  })

  it('refuses a base layer that claims a modifier', () => {
    expect(() =>
      threeLayerFixture({
        layers: [{ modifier: 'shift', rows: shapeOf(ANSI).map((count) => filled(count, 'a')) }],
      }),
    ).toThrow(/first layer is the base layer/)
  })
})

describe('a layout with a third layer', () => {
  const fixture = threeLayerFixture()

  it('finds a character on whichever layer holds it', () => {
    expect(keyFor(fixture, 'e').layer).toBe(0)
    expect(keyFor(fixture, 'E').layer).toBe(1)
    expect(keyFor(fixture, '€').layer).toBe(2)
  })

  it('names the modifier that reaches it', () => {
    expect(modifierFor(fixture, 'e')).toBeNull()
    expect(modifierFor(fixture, 'E')).toBe('shift')
    expect(modifierFor(fixture, '€')).toBe('altgr')
  })

  it('offers a control for every modifier it declares', () => {
    expect(modifierControls(fixture).map((key) => key.id)).toEqual([
      'shift-left',
      'shift-right',
      'altgr',
    ])
  })

  it('does not offer a control for a modifier it has no layer for', () => {
    // The same board carries this layout and Kedmanee; only this one has AltGr.
    expect(modifierControls(KEDMANEE).map((key) => key.id)).toEqual(['shift-left', 'shift-right'])
  })

  it('answers for its own typable set', () => {
    // Each layout decides what it can be asked for, from the keys it declares.
    expect(withoutUntypable(fixture, 'e€!')).toBe('e€')
    expect(withoutUntypable(KEDMANEE, 'e€ก')).toBe('ก')
  })
})

describe('what the keyboard draws', () => {
  const fixture = threeLayerFixture()

  it('draws the board once per layer, never changing its shape', () => {
    const widths = (modifier) =>
      keyboardModel(fixture, modifier).rows.map((row) => row.cells.map((cell) => cell.width))

    expect(widths('shift')).toEqual(widths(null))
    expect(widths('altgr')).toEqual(widths(null))
  })

  it('draws the layer the held modifier reaches', () => {
    const homeKey = (modifier) => keyboardModel(fixture, modifier).rows[2].cells[0].char

    expect(homeKey(null)).toBe('e')
    expect(homeKey('shift')).toBe('E')
    expect(homeKey('altgr')).toBe('€')
  })

  it('marks the held modifier and only that one', () => {
    const held = (modifier) =>
      keyboardModel(fixture, modifier)
        .rows.flatMap((row) => row.cells)
        .concat(keyboardModel(fixture, modifier).space.cells)
        .filter((cell) => cell.active)
        .map((cell) => cell.id)

    expect(held(null)).toEqual([])
    expect(held('shift')).toEqual(['shift-left', 'shift-right'])
    expect(held('altgr')).toEqual(['altgr'])
  })

  it('puts the AltGr key beside the space bar, where a physical board has it', () => {
    expect(keyboardModel(fixture, null).space.cells.map((cell) => cell.id ?? cell.char)).toEqual([
      ' ',
      'altgr',
    ])
  })

  it('draws no key without something written on it', () => {
    // A blank key is what a piece of furniture looks like when it is declared
    // on the board but has no label to render — an empty keycap beside the
    // space bar, which a learner can only read as "press me for something".
    for (const layout of [KEDMANEE, fixture]) {
      for (const modifier of [null, 'shift', 'altgr']) {
        const model = keyboardModel(layout, modifier)
        const cells = [...model.rows.flatMap((row) => row.cells), ...model.space.cells]

        expect(cells.filter((cell) => !cell.label).map((cell) => cell.id ?? cell.char)).toEqual([])
      }
    }
  })

  it('leaves the space row to the space bar for a layout without AltGr', () => {
    expect(keyboardModel(KEDMANEE, null).space.cells.map((cell) => cell.char)).toEqual([' '])
  })

  it('keeps Backspace on the number row and Shift around the bottom row', () => {
    const model = keyboardModel(KEDMANEE, null)

    expect(model.rows[0].cells.at(-1).id).toBe('backspace')
    expect(model.rows[3].cells.at(0).id).toBe('shift-left')
    expect(model.rows[3].cells.at(-1).id).toBe('shift-right')
  })

  it('falls back to the base layer for a modifier this layout does not have', () => {
    // Kedmanee has no AltGr layer; asking for one shows the base layer rather
    // than an empty board.
    expect(keyboardModel(KEDMANEE, 'altgr').rows[2].cells[1].char).toBe(
      keyboardModel(KEDMANEE, null).rows[2].cells[1].char,
    )
  })
})

describe('a position keeps its finger', () => {
  const fixture = threeLayerFixture()

  it('across every layer of a layout', () => {
    const fingers = (layer) => layer.rows.map((keys) => keys.map((key) => key.finger))

    fixture.layers.forEach((layer) => {
      expect(fingers(layer)).toEqual(fingers(fixture.layers[0]))
    })
  })

  it('across two layouts on the same board', () => {
    // The finger belongs to the board, so a German layout and a Thai one guide
    // the same finger to the same position.
    const fingers = (layout) => layout.layers[0].rows.map((keys) => keys.map((key) => key.finger))

    expect(fingers(fixture)).toEqual(fingers(KEDMANEE))
  })
})
