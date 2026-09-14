// @vitest-environment happy-dom
//
// Exercise content (the target sentence and its audio) has to stay exactly
// what the API delivered no matter which interface language is active — see
// specs/interface-localization/spec.md, "Exercise content is unaffected by
// interface language". `shallow: true` stubs AnswerInput, AudioPlayer, and
// OnScreenKeyboard, so this exercises only SentenceView's own template (the
// sentence text and the character-count hint) without their onMounted side
// effects (autoplay, focusing the field, keyboard modelling).
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '../../i18n'
import { useExerciseStore } from '../../stores/exercise'
import { useSettingsStore } from '../../stores/settings'
import SentenceView from '../SentenceView.vue'

const EXERCISE = { id: '1', sentence: 'สวัสดี', audioUrl: '/media/clip.mp3', language: 'th' }

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  vi.stubGlobal('navigator', { language: 'en-US' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('changing the interface language', () => {
  it('leaves the target sentence and its audio URL untouched', async () => {
    const settings = useSettingsStore()
    const exercise = useExerciseStore()
    exercise.deck = [EXERCISE]
    exercise.status = 'ready'

    const wrapper = mount(SentenceView, { shallow: true, global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain(EXERCISE.sentence)

    settings.interfaceLanguage = 'ru'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain(EXERCISE.sentence)
    expect(exercise.current.sentence).toBe(EXERCISE.sentence)
    expect(exercise.current.audioUrl).toBe(EXERCISE.audioUrl)
  })

  it("still translates the view's own chrome around that unchanged content", async () => {
    const settings = useSettingsStore()
    const exercise = useExerciseStore()
    exercise.deck = [EXERCISE]
    exercise.status = 'ready'

    const wrapper = mount(SentenceView, { shallow: true, global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('symbols')

    settings.interfaceLanguage = 'de'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Zeichen')
    // The sentence is Thai either way — the interface language governs the
    // hint's language, never the content it is a hint about.
    expect(wrapper.text()).toContain(EXERCISE.sentence)
  })

  it('does not affect the loading, error, or empty states either', async () => {
    const settings = useSettingsStore()
    const exercise = useExerciseStore()
    exercise.status = 'error'

    const wrapper = mount(SentenceView, { shallow: true, global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Could not load an exercise')

    settings.interfaceLanguage = 'hu'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('nem sikerült betölteni')
    expect(exercise.status).toBe('error')
  })
})
