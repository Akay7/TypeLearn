/**
 * The layouts this application knows.
 *
 * Two kinds, because a keyboard has two kinds. A *primary* layout is the one an
 * exercise is practised on, chosen by its language — Kedmanee for Thai. A
 * *companion* is a layout that is simply always there, the way an English
 * layout is installed beside Thai on every machine in Thailand: no exercise
 * selects it, and the keyboard switches to it for a character the primary
 * cannot produce.
 *
 * That is what makes `!` a solved problem rather than a compromise. Kedmanee
 * has no key for it, and the two bad answers — invent a key, which reshapes the
 * board and teaches a keystroke nobody can reproduce, or delete the character
 * from the sentence, which shows the learner something other than what was
 * ingested — are both avoided by doing what the typist does: switch layout.
 *
 * How an exercise names its language is still deliberately open: it needs a
 * field on `Exercise`, a value at ingestion, and a GraphQL field, and the right
 * shape of all three depends on how a second corpus is actually ingested. Until
 * then `layoutFor` is given nothing and answers with the only primary there is.
 */

import { KEDMANEE } from './kedmanee'
import { US_QWERTY } from './qwerty'
import { keyFor, modifierFor } from './layout'

const PRIMARY = new Map([[KEDMANEE.language, KEDMANEE]])

const COMPANIONS = [US_QWERTY]

/**
 * The layout an exercise in `language` is practised on.
 *
 * With one primary registered, every exercise gets it — including an exercise
 * that names no language, which today is all of them. Once there are several
 * and an exercise asks for one that is not registered, that is a catalog and a
 * keyboard disagreeing about what is being practised: it throws rather than
 * silently teaching the wrong board.
 */
export function layoutFor(language) {
  const registered = PRIMARY.get(language)

  if (registered) {
    return registered
  }

  if (PRIMARY.size === 1) {
    return PRIMARY.values().next().value
  }

  throw new Error(`No keyboard layout is registered for ${JSON.stringify(language)}`)
}

/**
 * Every layout the keyboard may show for `primary`, in the order it prefers
 * them: the exercise's own first, so a character both layouts carry — `?`, `%`,
 * a bracket — never moves the board.
 */
export function layoutsAvailable(primary) {
  return [primary, ...COMPANIONS.filter((layout) => layout !== primary)]
}

/**
 * Where `char` can be typed: the layout holding it and the modifier that
 * reaches it, or `undefined` if none of these layouts can.
 */
export function reach(char, layouts) {
  for (const layout of layouts) {
    if (keyFor(layout, char)) {
      return { layout, modifier: modifierFor(layout, char) }
    }
  }

  return undefined
}

/**
 * `text` without the characters *no* available layout can type.
 *
 * Not the same rule as `withoutUntypable`, which asks one layout: a `!` stays,
 * because the keyboard can reach it by switching to the Latin layout, and only
 * something genuinely off every board — an emoji, a CJK character, a
 * typographic dash — is dropped. What is left is a sentence the learner can
 * finish on the keys in front of them, still written the way the corpus wrote
 * it wherever that is possible at all.
 *
 * Runs in code points, like everything in `checking.js`. Removing a character
 * can leave two spaces where the corpus had one, and this text is what the
 * learner sees as well as types, so runs of spaces collapse and the ends are
 * trimmed — which is what `compare` and `isComplete` already do to both sides.
 */
export function withoutUnreachable(text, layouts) {
  return [...text]
    .filter((char) => layouts.some((layout) => keyFor(layout, char)))
    .join('')
    .replace(/ +/g, ' ')
    .trim()
}

export { KEDMANEE, US_QWERTY }
export { FINGER_NAMES } from './board'
export {
  keyFor,
  keyboardModel,
  modifierControls,
  modifierFor,
  withoutUntypable,
} from './layout'
