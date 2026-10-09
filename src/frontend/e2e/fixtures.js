/**
 * What every e2e test stands on: a stubbed deck and a stubbed clip.
 *
 * Nothing here talks to Django or PostgreSQL. The app's only two outbound
 * requests are the GraphQL deck and the audio file, so intercepting both
 * makes the suite hermetic — it runs on a laptop with no corpus ingested and in
 * CI with no services at all — and it makes the deck deterministic, which
 * matters because the server draws a real one at random.
 */

// Both sentences are typable from the on-screen keyboard, and `ณ` on the second
// one lives on the shift layer, so the tests that click their way through it
// also exercise the layer switching the keyboard does on its own.
export const SENTENCES = ['สวัสดี', 'ขอบคุณ']

/**
 * The longest sentence the catalog can hold: ingestion caps selection at 25
 * characters. Layout questions are asked with this one, because a layout that
 * fits the average sentence and not the longest one does not fit.
 */
export const LONGEST = 'ฉันกินข้าวเช้าแล้วไปทำงาน'

/**
 * A real, decodable clip, built rather than committed: a couple of seconds of
 * 8 kHz PCM is a few tens of kilobytes of Buffer here and no binary in git.
 * Long enough that a test asking "is it still playing?" gets a truthful answer.
 */
function wavClip({ seconds = 2, rate = 8000, freq = 440 } = {}) {
  const samples = Math.floor(seconds * rate)
  const data = Buffer.alloc(samples * 2)

  for (let i = 0; i < samples; i += 1) {
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000), i * 2)
  }

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // PCM header length
  header.writeUInt16LE(1, 20) // PCM, uncompressed
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28) // byte rate
  header.writeUInt16LE(2, 32) // block align
  header.writeUInt16LE(16, 34) // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)

  return Buffer.concat([header, data])
}

const CLIP = wavClip()

/**
 * Serve a deck and a clip for the rest of the test.
 *
 * `sentences` decides how many exercises the deck holds. One is the way to ask
 * a question about a single exercise without the answer being disturbed by the
 * advance: finishing a deck draws a new one, and every draw is answered with
 * this same deck, so what follows a correct answer is the same sentence, laid
 * out identically.
 *
 * `translations` maps an exercise's position in the deck to its translation
 * per language (`{ 0: { en: 'Hello' } }`); an exercise it leaves out has none.
 * Ratings and suggestions are accepted, and every GraphQL request is recorded
 * in the returned array, so a test can ask what the app actually sent.
 */
export async function mockBackend(page, sentences = SENTENCES, { translations = {} } = {}) {
  const requests = []
  const translationOf = (id, language) => {
    const text = translations[id]?.[language]
    return text
      ? { id: `t${id}-${language}`, text, origin: 'MACHINE', upVotes: 0, downVotes: 0 }
      : null
  }

  await page.route('**/graphql/', (route) => {
    const body = route.request().postDataJSON()
    requests.push(body)
    const { query, variables = {} } = body

    if (query.includes('query Translations')) {
      return route.fulfill({
        json: {
          data: {
            exercises: variables.ids.map((id) => ({
              id,
              translation: translationOf(id, variables.language),
            })),
          },
        },
      })
    }
    if (query.includes('mutation Rate')) {
      const [, id, language] = variables.id.match(/^t(\d+)-(\w+)$/)
      return route.fulfill({
        json: {
          data: {
            rateTranslation: {
              ...translationOf(id, language),
              upVotes: variables.value === 'UP' ? 1 : 0,
              downVotes: variables.value === 'DOWN' ? 1 : 0,
            },
          },
        },
      })
    }
    if (query.includes('mutation Propose')) {
      return route.fulfill({ json: { data: { proposeTranslation: { accepted: true } } } })
    }

    return route.fulfill({
      json: {
        data: {
          deck: sentences.map((sentence, i) => ({
            id: String(i),
            sentence,
            audioUrl: `/media/clip-${i}.wav`,
            difficulty: 1,
          })),
        },
      },
    })
  })

  await page.route('**/media/*.wav', (route) =>
    route.fulfill({ contentType: 'audio/wav', body: CLIP }),
  )

  return requests
}

/**
 * Make `play()` reject the way a browser refusing autoplay rejects it.
 *
 * Autoplay policies differ per browser and shift between versions, so a test
 * that waited for a real refusal would be testing Chromium. This asks the
 * question the code actually answers: what happens when the promise rejects.
 * The page can lift it — `window.__blockAutoplay = false` — which is how the
 * "learner presses play and the prompt goes away" path gets tested.
 */
export async function refuseAutoplay(page) {
  await page.addInitScript(() => {
    window.__blockAutoplay = true
    const play = HTMLMediaElement.prototype.play

    HTMLMediaElement.prototype.play = function patchedPlay() {
      if (window.__blockAutoplay) {
        return Promise.reject(
          new DOMException('play() failed because the user did not interact', 'NotAllowedError'),
        )
      }
      return play.call(this)
    }
  })
}

/** The sentence currently on screen, whichever the shuffled deck landed on. */
export function sentenceOnScreen(page) {
  return page.locator('p[lang="th"]').first().innerText()
}

/** Type `text` the way a learner does with the on-screen keyboard, key by key. */
export async function clickThrough(page, text) {
  for (const char of text) {
    // The keyboard switches to whichever layer holds the next expected key, so
    // the key is on screen by the time this looks for it.
    await page.locator(`button[aria-label^="${char},"]`).click()
  }
}

/**
 * Opens the settings menu and turns the post-check summary off.
 *
 * The setting defaults to on, so any test that is really about the plain
 * verdict + auto-advance loop — rather than the summary itself, covered in
 * `completion-stats.spec.js` — calls this first to get that behavior back.
 */
export async function disableCompletionStats(page) {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('checkbox', { name: 'Summary on complete' }).click()
}
