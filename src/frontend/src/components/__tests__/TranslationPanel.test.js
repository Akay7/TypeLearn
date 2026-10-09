// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '../../i18n'
import { useExerciseStore } from '../../stores/exercise'
import { useSettingsStore } from '../../stores/settings'
import { useTranslationStore } from '../../stores/translation'
import AnswerInput from '../AnswerInput.vue'
import CompletionStats from '../CompletionStats.vue'
import TranslationPanel from '../TranslationPanel.vue'

const TRANSLATION = { id: 't1', text: 'Hello', origin: 'MACHINE', upVotes: 0, downVotes: 0 }

/** A fetch whose answers the test controls, one mutation reply at a time. */
function backend({ translation = TRANSLATION, mutation = () => ({}) } = {}) {
  return vi.fn(async (url, init) => {
    const { query } = JSON.parse(init.body)
    const body = query.includes('query Translations')
      ? { data: { exercises: [{ id: '1', translation }] } }
      : mutation(query)
    return { ok: true, status: 200, json: async () => body }
  })
}

async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await nextTick()
    await Promise.resolve()
  }
}

function setup({ show = true, language = 'en' } = {}) {
  const settings = useSettingsStore()
  settings.showTranslation = show
  settings.interfaceLanguage = language
  const exercise = useExerciseStore()
  exercise.deck = [{ id: '1', sentence: 'สวัสดี', audioUrl: '/1.mp3' }]
  exercise.status = 'ready'
  return { settings, exercise }
}

async function mountPanel(component = TranslationPanel) {
  const wrapper = mount(component, { global: { plugins: [i18n] }, attachTo: document.body })
  await settle()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  vi.stubGlobal('navigator', { language: 'en-US' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('what the panel shows', () => {
  it('renders nothing while the setting is off', async () => {
    vi.stubGlobal('fetch', backend())
    setup({ show: false })

    const wrapper = await mountPanel()

    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('renders nothing for an exercise already in the interface language', async () => {
    vi.stubGlobal('fetch', backend())
    setup({ language: 'th' })

    const wrapper = await mountPanel()

    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('shows the translation, marked with its language, and both rating controls', async () => {
    vi.stubGlobal('fetch', backend())
    setup({ language: 'en' })

    const wrapper = await mountPanel()

    const text = wrapper.get('button[lang="en"]')
    expect(text.text()).toBe('Hello')
    expect(wrapper.get('[aria-label="Good translation"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[aria-label="Bad translation"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Suggest a better translation')
  })

  it('says there is no translation yet, and offers to suggest one', async () => {
    vi.stubGlobal('fetch', backend({ translation: null }))
    setup()

    const wrapper = await mountPanel()

    expect(wrapper.text()).toContain('No translation yet.')
    expect(wrapper.text()).toContain('Suggest a translation')
    expect(wrapper.find('[aria-label="Good translation"]').exists()).toBe(false)
  })

  it('says so quietly when the translation cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    setup()

    const wrapper = await mountPanel()

    expect(wrapper.text()).toContain('The translation could not be loaded.')
  })

  it('expands a clamped translation on request', async () => {
    vi.stubGlobal('fetch', backend())
    setup()
    const wrapper = await mountPanel()
    const text = wrapper.get('button[lang="en"]')

    expect(text.classes()).toContain('line-clamp-2')
    await text.trigger('click')

    expect(text.classes()).not.toContain('line-clamp-2')
    expect(text.attributes('aria-expanded')).toBe('true')
  })
})

describe('rating', () => {
  it('marks the chosen rating as pressed', async () => {
    vi.stubGlobal(
      'fetch',
      backend({ mutation: () => ({ data: { rateTranslation: { ...TRANSLATION, upVotes: 1 } } }) }),
    )
    setup()
    const wrapper = await mountPanel()

    await wrapper.get('[aria-label="Good translation"]').trigger('click')
    await settle()

    expect(wrapper.get('[aria-label="Good translation"]').attributes('aria-pressed')).toBe('true')
  })

  it('names a refusal', async () => {
    vi.stubGlobal(
      'fetch',
      backend({ mutation: () => ({ errors: [{ message: 'no', extensions: { code: 'RATE_LIMITED' } }] }) }),
    )
    setup()
    const wrapper = await mountPanel()

    await wrapper.get('[aria-label="Bad translation"]').trigger('click')
    await settle()

    expect(wrapper.text()).toContain('Too many at once. Try again later.')
  })
})

describe('suggesting', () => {
  it('sends the suggestion, closes the form and thanks the learner', async () => {
    const fetch = backend({ mutation: () => ({ data: { proposeTranslation: { accepted: true } } }) })
    vi.stubGlobal('fetch', fetch)
    setup()
    const wrapper = await mountPanel()

    await wrapper.get('button.text-indigo-600').trigger('click')
    await wrapper.get('textarea').setValue('Hi there')
    await wrapper.get('form').trigger('submit')
    await settle()

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.text()).toContain('Thanks — it will appear after review.')
    expect(fetch.mock.calls.some(([, init]) => init.body.includes('Hi there'))).toBe(true)
  })

  it('explains a blank suggestion and keeps the form open', async () => {
    vi.stubGlobal('fetch', backend())
    setup()
    const wrapper = await mountPanel()

    await wrapper.get('button.text-indigo-600').trigger('click')
    await wrapper.get('form').trigger('submit')
    await settle()

    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.text()).toContain('Write a translation first.')
  })
})

describe('typing a suggestion never touches the answer', () => {
  // The answer field, the post-check summary and the panel on one page, the
  // way SentenceView puts them together.
  const Page = defineComponent({
    components: { AnswerInput, CompletionStats, TranslationPanel },
    template: '<div><TranslationPanel /><AnswerInput /><CompletionStats /></div>',
  })

  it('leaves the typed answer and its verdict alone', async () => {
    vi.stubGlobal('fetch', backend())
    const { exercise } = setup()
    const translation = useTranslationStore()
    const wrapper = await mountPanel(Page)
    expect(translation.state).toBe('ready')

    await wrapper.get('button.text-indigo-600').trigger('click')
    const textarea = wrapper.get('textarea')
    await textarea.setValue('สวัสดี')
    await textarea.trigger('keyup', { key: 'Enter' })
    await settle()

    expect(exercise.typed).toBe('')
    expect(exercise.result).toBe(null)
  })

  it('does not let Enter in a suggestion move on from the summary', async () => {
    vi.stubGlobal('fetch', backend())
    const { exercise } = setup()
    exercise.deck = [...exercise.deck, { id: '2', sentence: 'ขอบคุณ', audioUrl: '/2.mp3' }]
    exercise.result = 'correct'
    mount(CompletionStats, { global: { plugins: [i18n] }, attachTo: document.body })
    const textarea = document.createElement('textarea')
    document.body.append(textarea)
    await settle()

    // Past Vue entirely, bubbling from the textarea to the document the way a
    // real keystroke does, so only the summary's own guard stands in the way.
    textarea.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await settle()
    expect(exercise.index).toBe(0)

    // The control: the same Enter from the page itself does move on.
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await settle()
    expect(exercise.index).toBe(1)
  })
})
