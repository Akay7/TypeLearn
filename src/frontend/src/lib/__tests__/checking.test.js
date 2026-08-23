import { describe, expect, it } from 'vitest'

import { compare, dropLast, hasDiverged, isComplete, nextExpected } from '../checking'

// "Hello" — five code points, two of which are a vowel sign and a tone mark
// that attach to the consonant before them.
const SENTENCE = 'สวัสดี'

describe('compare', () => {
  it('accepts an exact match', () => {
    expect(compare(SENTENCE, SENTENCE)).toBe(true)
  })

  it('rejects a missing tone mark', () => {
    expect(compare('สวสดี', SENTENCE)).toBe(false)
  })

  it('forgives whitespace the learner left at the ends', () => {
    expect(compare(`  ${SENTENCE} `, SENTENCE)).toBe(true)
  })

  it('treats an internal space as content, because Thai separates phrases with it', () => {
    expect(compare('สวัสดี ครับ', 'สวัสดีครับ')).toBe(false)
  })

  it('rejects an empty answer', () => {
    expect(compare('', SENTENCE)).toBe(false)
  })

  it('matches across normalization forms', () => {
    // NFD and NFC of the same text are the same answer to a learner reading
    // the screen, so they must be the same answer to the checker.
    expect(compare(SENTENCE.normalize('NFD'), SENTENCE.normalize('NFC'))).toBe(true)
  })
})

describe('isComplete', () => {
  it('is false while the answer is shorter than the target', () => {
    expect(isComplete('สวัส', SENTENCE)).toBe(false)
  })

  it('is true at exactly the target length', () => {
    expect(isComplete(SENTENCE, SENTENCE)).toBe(true)
  })

  it('is true past the target length, because an overlong answer is finished too', () => {
    expect(isComplete(`${SENTENCE}ก`, SENTENCE)).toBe(true)
  })

  it('is false for an empty answer', () => {
    expect(isComplete('', SENTENCE)).toBe(false)
  })

  it('ignores whitespace at the ends, exactly as compare does', () => {
    // The trailing space compare forgives must not decide when to check.
    expect(isComplete(`${SENTENCE} `, SENTENCE)).toBe(true)
    expect(isComplete('สวัส ', SENTENCE)).toBe(false)
  })

  it('counts combining marks as the characters the learner typed', () => {
    // Four consonants and two marks: an answer of four bare consonants is not
    // complete, however close it looks on screen.
    expect(isComplete('สวสด', SENTENCE)).toBe(false)
    expect(isComplete('สวสดีก', SENTENCE)).toBe(true)
  })

  it('measures against the target, not against any idea of a word', () => {
    expect(isComplete('ก', 'ก')).toBe(true)
  })
})

describe('nextExpected', () => {
  it('points at the first character before anything is typed', () => {
    expect(nextExpected('', SENTENCE)).toBe('ส')
  })

  it('advances one code point at a time through combining marks', () => {
    const typed = []

    for (const char of SENTENCE) {
      expect(nextExpected(typed.join(''), SENTENCE)).toBe(char)
      typed.push(char)
    }
  })

  it('returns null once the answer diverges', () => {
    expect(nextExpected('สม', SENTENCE)).toBeNull()
  })

  it('returns null when the divergence is only in a tone mark', () => {
    expect(nextExpected('สวี', SENTENCE)).toBeNull()
  })

  it('returns null when the sentence is fully typed', () => {
    expect(nextExpected(SENTENCE, SENTENCE)).toBeNull()
  })

  it('returns null when the answer runs past the sentence', () => {
    expect(nextExpected(`${SENTENCE}ก`, SENTENCE)).toBeNull()
  })

  it('expects the space in a sentence with a phrase boundary', () => {
    expect(nextExpected('สวัสดี', 'สวัสดี ครับ')).toBe(' ')
  })
})

describe('hasDiverged', () => {
  it('is false before anything is typed', () => {
    expect(hasDiverged('', SENTENCE)).toBe(false)
  })

  it('is false part-way through a correct answer', () => {
    expect(hasDiverged('สวั', SENTENCE)).toBe(false)
  })

  it('is false for a finished answer, which is not an error but a cue to check', () => {
    expect(hasDiverged(SENTENCE, SENTENCE)).toBe(false)
  })

  it('forgives the trailing space the checker forgives', () => {
    expect(hasDiverged(`${SENTENCE} `, SENTENCE)).toBe(false)
  })

  it('is true for a wrong character', () => {
    expect(hasDiverged('สม', SENTENCE)).toBe(true)
  })

  it('is true when the answer runs past the end of the sentence', () => {
    expect(hasDiverged(`${SENTENCE}ก`, SENTENCE)).toBe(true)
  })

  it('is true when only a tone mark is wrong', () => {
    expect(hasDiverged('สวี', SENTENCE)).toBe(true)
  })

  it('separates the two states nextExpected collapses into null', () => {
    // Both return no next character; only one of them is a mistake.
    expect(nextExpected(SENTENCE, SENTENCE)).toBeNull()
    expect(nextExpected('สม', SENTENCE)).toBeNull()
    expect(hasDiverged(SENTENCE, SENTENCE)).toBe(false)
    expect(hasDiverged('สม', SENTENCE)).toBe(true)
  })
})

describe('dropLast', () => {
  it('removes a whole combining mark, not half of one', () => {
    expect(dropLast('สวั')).toBe('สว')
  })

  it('walks a sentence back to empty', () => {
    let typed = SENTENCE

    for (let i = 0; i < [...SENTENCE].length; i += 1) {
      typed = dropLast(typed)
    }

    expect(typed).toBe('')
  })

  it('leaves an empty answer empty', () => {
    expect(dropLast('')).toBe('')
  })
})
