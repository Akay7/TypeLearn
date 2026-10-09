/**
 * Whether a key event belongs to a text field other than the answer.
 *
 * The exercise listens for some keys on the whole document — Enter to move on
 * from the summary — because the answer field is not always the one focused.
 * But a learner writing in another field (a suggested translation) is typing
 * prose, not answering, and none of those keys mean anything there. The answer
 * field is marked `data-answer-field`; every other editable element is
 * "elsewhere".
 */
export function typingElsewhere(event) {
  const target = event.target
  if (!target || typeof target.closest !== 'function') return false
  if (target.closest('[data-answer-field]')) return false
  return Boolean(
    target.isContentEditable || target.closest('textarea, input, select, [contenteditable="true"]'),
  )
}
