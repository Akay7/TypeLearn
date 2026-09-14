// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, SUPPORTED_LANGUAGES } from '../../i18n'
import { useSettingsStore } from '../../stores/settings'
import SettingsMenu from '../SettingsMenu.vue'

async function mountOpen() {
  const wrapper = mount(SettingsMenu, { global: { plugins: [i18n] } })
  await wrapper.get('button[aria-haspopup="true"]').trigger('click')
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  vi.stubGlobal('navigator', { language: 'en-US' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the language control', () => {
  it('lists all six supported languages by their own endonym', async () => {
    const wrapper = await mountOpen()
    const options = wrapper.findAll('#interface-language option')

    expect(options).toHaveLength(SUPPORTED_LANGUAGES.length)
    expect(options.map((o) => o.element.value)).toEqual(SUPPORTED_LANGUAGES)
    expect(options.map((o) => o.text())).toEqual([
      'English',
      'Français',
      'Deutsch',
      'ไทย',
      'Русский',
      'Magyar',
    ])
  })

  it('updates settings.interfaceLanguage when the learner picks one', async () => {
    const settings = useSettingsStore()
    const wrapper = await mountOpen()

    await wrapper.get('#interface-language').setValue('de')

    expect(settings.interfaceLanguage).toBe('de')
  })
})

describe('choosing a language', () => {
  it("switches the menu's own text immediately, without remounting", async () => {
    const settings = useSettingsStore()
    const wrapper = await mountOpen()

    expect(wrapper.text()).toContain('Virtual keyboard')
    expect(wrapper.text()).toContain('On-screen keyboard')

    settings.interfaceLanguage = 'fr'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Clavier virtuel')
    expect(wrapper.text()).toContain("Clavier à l'écran")
    expect(wrapper.text()).not.toContain('Virtual keyboard')
  })

  it("updates the button's accessible name too", async () => {
    const settings = useSettingsStore()
    const wrapper = mount(SettingsMenu, { global: { plugins: [i18n] } })

    expect(wrapper.get('button[aria-haspopup="true"]').attributes('aria-label')).toBe('Settings')

    settings.interfaceLanguage = 'ru'
    await wrapper.vm.$nextTick()

    expect(wrapper.get('button[aria-haspopup="true"]').attributes('aria-label')).toBe('Настройки')
  })
})

describe('every supported locale', () => {
  const warnings = []

  beforeEach(() => {
    warnings.length = 0
    vi.spyOn(console, 'warn').mockImplementation((message) => warnings.push(String(message)))
  })

  for (const locale of SUPPORTED_LANGUAGES) {
    it(`renders the menu in ${locale} with no key falling back to a raw key`, async () => {
      const settings = useSettingsStore()
      const wrapper = await mountOpen()

      settings.interfaceLanguage = locale
      await wrapper.vm.$nextTick()

      // Every label/description this menu renders — none of them should ever
      // read as their own dot-prefixed key, which is vue-i18n's fallback when
      // even English is missing the message.
      for (const text of wrapper.text().split(/\s+/)) {
        expect(text).not.toMatch(/^settings\./)
      }

      // A key a partial translation lacks falls back to English, and that is
      // fine (see i18n.js). A key English lacks has nowhere left to fall back to.
      expect(warnings.filter((w) => w.includes("key in 'en' locale messages"))).toEqual([])
    })
  }
})
