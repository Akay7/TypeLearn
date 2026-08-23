import { describe, expect, it } from 'vitest'

import { FINGER_NAMES, KEY_INDEX, LAYERS, keyFor } from '../layout'

/** Every key of every layer, flattened, with where it sits. */
function allKeys() {
  return LAYERS.flatMap((rows, layer) =>
    rows.flatMap((keys, row) => keys.map((key, col) => ({ ...key, layer, row, col }))),
  )
}

function codePoints(from, to) {
  const chars = []
  for (let point = from; point <= to; point += 1) {
    chars.push(String.fromCodePoint(point))
  }
  return chars
}

// The 44 consonants, in alphabet order. Written out rather than derived from a
// code point range: the range U+0E01-U+0E2E also contains the vowel-like ฤ and
// the point U+0E26, and an off-by-one in a range would silently weaken this.
const CONSONANTS = [
  ...'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ',
]

const VOWELS_AND_MARKS = [...'ะัาำิีึืุูเแโใไๅ็่้๊๋์ํฺ']

const SYMBOLS = [...'ๆฯฤฦ']

const THAI_DIGITS = codePoints(0x0e50, 0x0e59)

// Punctuation the ingested sentences actually contain. A learner cannot switch
// to a Latin layer, so anything the catalog uses must be on a key here.
const PUNCTUATION = [' ', '!', '?']

describe('the Kedmanee table', () => {
  it('types all 44 consonants', () => {
    expect(CONSONANTS).toHaveLength(44)
    expect(CONSONANTS.filter((char) => !keyFor(char))).toEqual([])
  })

  it('types every vowel sign, tone mark, and symbol', () => {
    expect([...VOWELS_AND_MARKS, ...SYMBOLS].filter((char) => !keyFor(char))).toEqual([])
  })

  it('types every Thai digit', () => {
    expect(THAI_DIGITS.filter((char) => !keyFor(char))).toEqual([])
  })

  it('types the space that separates Thai phrases', () => {
    expect(keyFor(' ')).toBeDefined()
  })

  it('types the punctuation the corpus uses', () => {
    expect(PUNCTUATION.filter((char) => !keyFor(char))).toEqual([])
  })

  it('places no character on two different keys', () => {
    // The space bar is the one deliberate duplicate: it is on both layers so a
    // learner never has to press Shift for it.
    const chars = allKeys()
      .map((key) => key.char)
      .filter((char) => char !== ' ')

    expect(new Set(chars).size).toBe(chars.length)
  })

  it('round-trips every key through keyFor', () => {
    for (const key of allKeys()) {
      const found = keyFor(key.char)

      expect(found, `no index entry for ${JSON.stringify(key.char)}`).toBeDefined()
      expect(LAYERS[found.layer][found.row][found.col].char).toBe(key.char)
    }
  })

  it('indexes exactly the characters the layers hold', () => {
    const chars = new Set(allKeys().map((key) => key.char))

    expect(KEY_INDEX.size).toBe(chars.size)
  })
})

describe('finger assignment', () => {
  it('gives every key a finger', () => {
    const unassigned = allKeys().filter((key) => !key.finger)

    expect(unassigned.map((key) => key.char)).toEqual([])
  })

  it('gives every key a finger that has a name', () => {
    const unnamed = allKeys().filter((key) => !FINGER_NAMES[key.finger])

    expect(unnamed.map((key) => key.char)).toEqual([])
  })

  it('assigns a key the same finger on both layers', () => {
    // The finger follows the position, not the character printed on the key.
    LAYERS[0].forEach((keys, row) => {
      keys.forEach((key, col) => {
        expect(LAYERS[1][row][col].finger).toBe(key.finger)
      })
    })
  })

  it('puts the home keys under the fingers that rest on them', () => {
    // The eight home positions, in order: ฟ ห ก ด on the left (the a-s-d-f
    // keys) and ่ า ส ว on the right (j-k-l-;), little finger outwards.
    const homeRow = LAYERS[0][2]
    const home = [0, 1, 2, 3, 6, 7, 8, 9].map((col) => homeRow[col])

    expect(home.map((key) => key.char).join('')).toBe('ฟหกด่าสว')
    expect(home.map((key) => key.finger)).toEqual([
      'l-pinky',
      'l-ring',
      'l-middle',
      'l-index',
      'r-index',
      'r-middle',
      'r-ring',
      'r-pinky',
    ])
  })

  it('gives the space bar to the thumb', () => {
    const space = keyFor(' ')

    expect(LAYERS[space.layer][space.row][space.col].finger).toBe('thumb')
  })
})

describe('key labels', () => {
  it('shows a combining mark on a dotted circle so it is visible alone', () => {
    const toneMark = keyFor('่')

    expect(LAYERS[toneMark.layer][toneMark.row][toneMark.col].label).toBe('◌่')
  })

  it('leaves a spacing character as itself', () => {
    const consonant = keyFor('ก')

    expect(LAYERS[consonant.layer][consonant.row][consonant.col].label).toBe('ก')
  })

  it('does not decorate SARA AM, which stands on its own', () => {
    const saraAm = keyFor('ำ')

    expect(LAYERS[saraAm.layer][saraAm.row][saraAm.col].label).toBe('ำ')
  })

  it('names the space bar rather than rendering an invisible key', () => {
    const space = keyFor(' ')

    expect(LAYERS[space.layer][space.row][space.col].label).toBe('space')
  })
})

describe('the layers', () => {
  it('has an unshifted and a shifted layer', () => {
    expect(LAYERS).toHaveLength(2)
  })

  it('reaches ฅ and ฒ, which are only on the shift layer', () => {
    expect(keyFor('ฅ').layer).toBe(1)
    expect(keyFor('ฒ').layer).toBe(1)
  })

  it('reaches ก and า without Shift', () => {
    expect(keyFor('ก').layer).toBe(0)
    expect(keyFor('า').layer).toBe(0)
  })
})
