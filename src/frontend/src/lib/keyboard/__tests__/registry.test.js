import { describe, expect, it } from 'vitest'

import { KEDMANEE, US_QWERTY, keyFor, layoutFor, layoutsAvailable, reach, withoutUnreachable } from '..'

const AVAILABLE = layoutsAvailable(KEDMANEE)

describe('choosing a layout', () => {
  it('gives Thai the Kedmanee board', () => {
    expect(layoutFor('th')).toBe(KEDMANEE)
  })

  it('gives an exercise that names no language the only primary there is', () => {
    // Nothing carries a language yet; the companion is never chosen this way.
    expect(layoutFor(undefined)).toBe(KEDMANEE)
  })

  it('offers the Latin board alongside, the way it is installed alongside', () => {
    expect(AVAILABLE).toEqual([KEDMANEE, US_QWERTY])
  })
})

describe('reaching a character', () => {
  it('stays on the exercise’s own board for a character it has', () => {
    expect(reach('ก', AVAILABLE)).toEqual({ layout: KEDMANEE, modifier: null })
  })

  it('stays on it for a character behind its Shift', () => {
    expect(reach('ฅ', AVAILABLE)).toEqual({ layout: KEDMANEE, modifier: 'shift' })
  })

  it('does not switch for punctuation both boards carry', () => {
    // `?` is on Kedmanee's shift layer and on QWERTY's; the exercise's own wins,
    // so the board does not move under a learner who is typing Thai.
    expect(reach('?', AVAILABLE).layout).toBe(KEDMANEE)
    expect(reach('%', AVAILABLE).layout).toBe(KEDMANEE)
  })

  it('switches to the Latin board for `!`, which Kedmanee has no key for', () => {
    expect(keyFor(KEDMANEE, '!')).toBeUndefined()
    expect(reach('!', AVAILABLE)).toEqual({ layout: US_QWERTY, modifier: 'shift' })
  })

  it('switches for a Latin letter, and finds its case', () => {
    expect(reach('a', AVAILABLE)).toEqual({ layout: US_QWERTY, modifier: null })
    expect(reach('A', AVAILABLE)).toEqual({ layout: US_QWERTY, modifier: 'shift' })
  })

  it('answers with nothing for a character on no board', () => {
    expect(reach('🙂', AVAILABLE)).toBeUndefined()
    expect(reach('好', AVAILABLE)).toBeUndefined()
  })

  it('never moves the board for a space', () => {
    expect(reach(' ', AVAILABLE)).toEqual({ layout: KEDMANEE, modifier: null })
  })
})

describe('what the learner can be asked for', () => {
  const strip = (text) => withoutUnreachable(text, AVAILABLE)

  it('keeps a character the Latin board can reach', () => {
    expect(strip('สวัสดี!')).toBe('สวัสดี!')
  })

  it('keeps Latin words whole', () => {
    expect(strip('ร้าน 7-Eleven')).toBe('ร้าน 7-Eleven')
  })

  it('removes only what is on no board at all', () => {
    expect(strip('สวัสดี 🙂')).toBe('สวัสดี')
  })

  it('leaves no doubled space behind what it removed', () => {
    expect(strip('ก 🙂 ข')).toBe('ก ข')
  })

  it('returns nothing when no board can type any of it', () => {
    expect(strip('🙂好')).toBe('')
  })
})

describe('the Latin board', () => {
  it('sits on the same positions as Kedmanee', () => {
    const shape = (layout) => layout.layers.map((layer) => layer.rows.map((keys) => keys.length))

    expect(shape(US_QWERTY)).toEqual(shape(KEDMANEE))
  })

  it('types the ASCII a corpus sentence can carry', () => {
    const ascii = [...'abcxyzABCXYZ0189!?.,;:\'"()[]{}<>-_=+/\\|@#$%^&*~`']

    expect(ascii.filter((char) => !keyFor(US_QWERTY, char))).toEqual([])
  })
})
