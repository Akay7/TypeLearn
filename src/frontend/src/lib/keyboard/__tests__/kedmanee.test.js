import { describe, expect, it } from 'vitest'

import { ANSI, FINGER_NAMES } from '../board'
import { KEDMANEE } from '../kedmanee'
import { keyFor, modifierFor, withoutUntypable } from '../layout'

/** Every key of every layer, flattened, with where it sits. */
function allKeys() {
  return KEDMANEE.layers.flatMap((layer, index) =>
    layer.rows.flatMap((keys, row) => keys.map((key, col) => ({ ...key, layer: index, row, col }))),
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

// Punctuation Kedmanee itself carries. The guarantee runs this way round: the
// layout is the board, and a sentence asking for something it cannot produce —
// `!`, which Thai typists reach on a Latin layer — has that character removed
// before the learner sees it, rather than the board growing a key for it.
const PUNCTUATION = [' ', '?']

const on = (char) => keyFor(KEDMANEE, char)

describe('the Kedmanee table', () => {
  it('types all 44 consonants', () => {
    expect(CONSONANTS).toHaveLength(44)
    expect(CONSONANTS.filter((char) => !on(char))).toEqual([])
  })

  it('types every vowel sign, tone mark, and symbol', () => {
    expect([...VOWELS_AND_MARKS, ...SYMBOLS].filter((char) => !on(char))).toEqual([])
  })

  it('types every Thai digit', () => {
    expect(THAI_DIGITS.filter((char) => !on(char))).toEqual([])
  })

  it('types the space that separates Thai phrases', () => {
    expect(on(' ')).toBeDefined()
  })

  it('types the punctuation Kedmanee carries', () => {
    expect(PUNCTUATION.filter((char) => !on(char))).toEqual([])
  })

  it('does not invent a key Kedmanee has no room for', () => {
    // `!` is the one that was here. It is not on a Thai keyboard, and the board
    // is not the place to solve a sentence that needs it.
    expect(on('!')).toBeUndefined()
  })

  it('places no character on two different keys', () => {
    const chars = allKeys().map((key) => key.char)

    expect(new Set(chars).size).toBe(chars.length)
  })

  it('round-trips every key through keyFor', () => {
    for (const key of allKeys()) {
      const found = on(key.char)

      expect(found, `no index entry for ${JSON.stringify(key.char)}`).toBeDefined()
      expect(KEDMANEE.layers[found.layer].rows[found.row][found.col].char).toBe(key.char)
    }
  })

  it('indexes the characters the layers hold, and the space bar', () => {
    // The space is on no layer — it is the board's, and on every layer at once.
    const chars = new Set(allKeys().map((key) => key.char))

    expect(KEDMANEE.index.size).toBe(chars.size + 1)
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

  it('puts the home keys under the fingers that rest on them', () => {
    // The eight home positions, in order: ฟ ห ก ด on the left (the a-s-d-f
    // keys) and ่ า ส ว on the right (j-k-l-;), little finger outwards.
    const homeRow = KEDMANEE.layers[0].rows[2]
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
    expect(KEDMANEE.space.finger).toBe('thumb')
  })
})

describe('key labels', () => {
  const labelOf = (char) => {
    const key = on(char)
    return KEDMANEE.layers[key.layer].rows[key.row][key.col].label
  }

  it('shows a combining mark on a dotted circle so it is visible alone', () => {
    expect(labelOf('่')).toBe('◌่')
  })

  it('leaves a spacing character as itself', () => {
    expect(labelOf('ก')).toBe('ก')
  })

  it('does not decorate SARA AM, which stands on its own', () => {
    expect(labelOf('ำ')).toBe('ำ')
  })

  it('names the space bar rather than rendering an invisible key', () => {
    expect(KEDMANEE.space.label).toBe('space')
  })
})

describe('the layers', () => {
  it('has an unshifted and a shifted layer, and no third', () => {
    // Kedmanee's own count, not the keyboard's: a layout with an AltGr layer
    // declares three, and neither knows about the other.
    expect(KEDMANEE.layers.map((layer) => layer.modifier)).toEqual([null, 'shift'])
  })

  it('sits on the ANSI board', () => {
    expect(KEDMANEE.board).toBe(ANSI)
  })

  it('reaches ฅ and ฒ with Shift', () => {
    expect(modifierFor(KEDMANEE, 'ฅ')).toBe('shift')
    expect(modifierFor(KEDMANEE, 'ฒ')).toBe('shift')
  })

  it('reaches ก and า without Shift', () => {
    expect(modifierFor(KEDMANEE, 'ก')).toBeNull()
    expect(modifierFor(KEDMANEE, 'า')).toBeNull()
  })

  it('never moves the keyboard for a space', () => {
    // The space bar is on every layer, so it belongs to none of them.
    expect(modifierFor(KEDMANEE, ' ')).toBeNull()
  })
})

describe('what Kedmanee can be asked for', () => {
  const strip = (text) => withoutUntypable(KEDMANEE, text)

  it('removes a character no key produces', () => {
    // `!` is the one the corpus actually carries, and the one the board used to
    // grow a key for.
    expect(strip('สวัสดี!')).toBe('สวัสดี')
  })

  it('removes characters no Thai keyboard has at all', () => {
    // A stray Latin letter or Arabic digit is the same defect, and would
    // otherwise make an exercise silently impossible to finish.
    expect(strip('ก a ข 5 ค')).toBe('ก ข ค')
  })

  it('leaves a sentence the board can type exactly as it is', () => {
    const sentence = 'ฉันไม่เข้าใจ ช่วยพูดอีกครั้งได้ไหม'

    expect(strip(sentence)).toBe(sentence)
  })

  it('keeps the punctuation Kedmanee does carry', () => {
    expect(strip('อะไรนะ? (จริง) ๑๐%')).toBe('อะไรนะ? (จริง) ๑๐%')
  })

  it('keeps the space, which is a phrase boundary in Thai', () => {
    expect(strip('ขอบคุณ มาก')).toBe('ขอบคุณ มาก')
  })

  it('leaves no doubled space where a character was removed', () => {
    // The learner types what they see; a space they cannot account for is a
    // keystroke with no visible reason.
    expect(strip('ก ! ข')).toBe('ก ข')
  })

  it('trims the ends', () => {
    expect(strip('! ก ข !')).toBe('ก ข')
  })

  it('returns nothing for a sentence with nothing typeable in it', () => {
    expect(strip('hello!')).toBe('')
  })

  it('leaves every character of every key alone', () => {
    const chars = allKeys().map((key) => key.char).join('')

    expect(strip(chars)).toBe(chars)
  })
})
