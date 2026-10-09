// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { typingElsewhere } from '../editable'

function eventOn(html, selector) {
  document.body.innerHTML = html
  return { target: document.querySelector(selector) }
}

describe('typingElsewhere', () => {
  it('is false for the answer field', () => {
    expect(typingElsewhere(eventOn('<input data-answer-field>', 'input'))).toBe(false)
  })

  it('is true for a textarea or another input', () => {
    expect(typingElsewhere(eventOn('<textarea></textarea>', 'textarea'))).toBe(true)
    expect(typingElsewhere(eventOn('<input>', 'input'))).toBe(true)
  })

  it('is false for the page itself and for buttons', () => {
    expect(typingElsewhere({ target: document.body })).toBe(false)
    expect(typingElsewhere(eventOn('<button>Next</button>', 'button'))).toBe(false)
    expect(typingElsewhere({ target: null })).toBe(false)
  })
})
