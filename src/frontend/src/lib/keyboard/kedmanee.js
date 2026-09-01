/**
 * Kedmanee — the standard Thai keyboard — as data on the ANSI board.
 *
 * The rows are the character rows of a physical Thai keyboard, in order, so a
 * key highlighted on screen sits where the finger goes on a real one. Two
 * layers, because that is what Kedmanee has: what a key types unshifted, and
 * what it types with Shift held. Both cover the same positions, and a row of
 * the wrong length is refused by `defineLayout` rather than quietly reshaping
 * the board.
 *
 * Note what is not here. `!` is not on a Thai keyboard — Thai typists reach it
 * by switching to a Latin layer, which a learner here cannot do — and the
 * corpus does contain it. A character this layout cannot produce is handled by
 * not asking for it (`withoutUntypable`), never by inventing a key: a board
 * that grows a key under Shift is no longer the board the learner's fingers are
 * being taught.
 */

import { ANSI } from './board'
import { defineLayout } from './layout'

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
]

// prettier-ignore
const SHIFT = [
  ['%', '+', '๑', '๒', '๓', '๔', 'ู', '฿', '๕', '๖', '๗', '๘', '๙'],
  ['๐', '"', 'ฎ', 'ฑ', 'ธ', 'ํ', '๊', 'ณ', 'ฯ', 'ญ', 'ฐ', ',', 'ฅ'],
  ['ฤ', 'ฆ', 'ฏ', 'โ', 'ฌ', '็', '๋', 'ษ', 'ศ', 'ซ', '.'],
  ['(', ')', 'ฉ', 'ฮ', 'ฺ', '์', '?', 'ฒ', 'ฬ', 'ฦ'],
]

export const KEDMANEE = defineLayout({
  language: 'th',
  name: 'Kedmanee',
  shortName: 'ไทย',
  board: ANSI,
  layers: [
    { modifier: null, rows: BASE },
    { modifier: 'shift', rows: SHIFT },
  ],
  // A Thai tone mark or vowel sign has no advance width and would collapse onto
  // the edge of its key, so it is drawn on a dotted circle the way Unicode
  // charts show it. Arabic harakat, Hebrew niqqud and Devanagari matras need the
  // same treatment over a different set of characters — which is why the rule
  // belongs to the layout rather than to the keyboard.
  decorate: (char) => (COMBINING.test(char) ? DOTTED_CIRCLE + char : null),
})
