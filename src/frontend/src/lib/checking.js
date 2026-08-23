/**
 * Comparing a typed answer against the target sentence.
 *
 * Both functions work in code points, never UTF-16 units: `[...text]` rather
 * than `text.length` or `text[i]`. Thai stays inside the BMP so the two agree
 * today, but the character-at-a-time logic here is the app's model of "one
 * thing the learner typed", and that model should not depend on the encoding.
 */

/**
 * NFC, so a physical IME emitting a different byte sequence for a visually
 * identical string is not marked wrong. For Thai this is close to a no-op,
 * which is the point: it costs nothing and removes a class of bug that is
 * invisible on screen.
 */
function normalize(text) {
  return text.normalize('NFC')
}

/**
 * Exact comparison, with the ends trimmed.
 *
 * Leading and trailing whitespace is absorbed — a learner who leaves a space
 * after the last word has not made a mistake. Internal spacing is significant:
 * Thai uses the space as a phrase boundary, so an internal space is content.
 */
export function compare(typed, target) {
  return normalize(typed).trim() === normalize(target).trim()
}

/**
 * Whether the typed answer is long enough to be a finished attempt.
 *
 * This is the trigger for checking without being asked: an answer that has
 * reached the target's length is as done as it is going to get, and asking the
 * learner to press a key to be told so is a step that carries no information.
 * It says nothing about whether the answer is *right* — `compare` does that.
 *
 * Both sides are trimmed exactly as `compare` trims them, so the space a
 * learner leaves after the last word neither triggers a check early nor holds
 * one back.
 */
export function isComplete(typed, target) {
  return [...normalize(typed).trim()].length >= [...normalize(target).trim()].length
}

/**
 * The next character the learner is expected to type, or `null` when the typed
 * answer has diverged from the target or already reaches its end.
 *
 * Returning `null` on divergence is what stops the keyboard from highlighting
 * an arbitrary key once the answer is wrong.
 */
export function nextExpected(typed, target) {
  const typedChars = [...normalize(typed)]
  const targetChars = [...normalize(target)]

  if (typedChars.length >= targetChars.length) {
    return null
  }

  for (let i = 0; i < typedChars.length; i += 1) {
    if (typedChars[i] !== targetChars[i]) {
      return null
    }
  }

  return targetChars[typedChars.length]
}

/**
 * Whether the typed answer has left the target behind — a wrong character, or
 * more characters than the sentence holds.
 *
 * `nextExpected` returns `null` both when the answer has diverged and when the
 * sentence has been typed out in full, and those two states call for opposite
 * advice: one wants a correction, the other wants the Check control. This
 * separates them, so being finished is never mistaken for being wrong.
 */
export function hasDiverged(typed, target) {
  // An answer that would pass the check is on track by definition, whatever its
  // length — that is what keeps a forgiven trailing space from reading as an error.
  if (compare(typed, target)) {
    return false
  }

  const typedChars = [...normalize(typed)]
  const targetChars = [...normalize(target)]

  if (typedChars.length > targetChars.length) {
    return true
  }

  return typedChars.some((char, i) => char !== targetChars[i])
}

/** `text` without its last character, counted in code points. */
export function dropLast(text) {
  const chars = [...text]
  chars.pop()
  return chars.join('')
}
