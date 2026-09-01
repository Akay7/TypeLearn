/**
 * US QWERTY — the Latin board, on the same ANSI positions as Kedmanee.
 *
 * It is here for the reason a Thai typist has an English layout installed: some
 * characters are not on a Thai keyboard at all. `!` is the one the corpus keeps
 * producing, and Kedmanee has no key for it — so rather than inventing a key
 * (which reshapes the board and teaches a keystroke nobody can reproduce) or
 * quietly deleting the character from the sentence, the keyboard does what the
 * typist does: it switches layout, and points at the key.
 *
 * A companion rather than a language a corpus is practised in: no exercise
 * selects it, and it is available alongside whichever layout the exercise does
 * select.
 */

import { ANSI } from './board'
import { defineLayout } from './layout'

// prettier-ignore
const BASE = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
]

// prettier-ignore
const SHIFT = [
  ['~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{', '}', '|'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', '"'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?'],
]

export const US_QWERTY = defineLayout({
  language: 'en',
  name: 'US QWERTY',
  shortName: 'EN',
  board: ANSI,
  layers: [
    { modifier: null, rows: BASE },
    { modifier: 'shift', rows: SHIFT },
  ],
  // Latin script has no mark that would collapse onto the edge of a keycap.
})
