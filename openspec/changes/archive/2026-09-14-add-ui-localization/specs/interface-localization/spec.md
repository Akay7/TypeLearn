## Purpose
Lets a learner see the application's own interface — its controls, hints, and
status messages — in a language they read, independent of Thai (or any other
language) being the thing they are practising.

## ADDED Requirements

### Requirement: Interface language selector
The Settings menu SHALL offer a Language control alongside its existing
controls, letting the learner choose the interface language from the full set
of supported languages: English, French, German, Thai, Russian, and
Hungarian.

#### Scenario: Choosing a language
- **WHEN** the learner opens the Settings menu and selects a language from the
  Language control
- **THEN** the interface's own text — Settings menu labels and descriptions,
  loading/error/empty states, the character-count hint, the Check button, the
  correct/incorrect verdicts, and the on-screen keyboard's legend — switches
  to that language immediately, without a page reload

#### Scenario: All six languages are offered
- **WHEN** the learner opens the Language control
- **THEN** English, French, German, Thai, Russian, and Hungarian are all
  listed as choices, each identified by its own name (e.g. "Русский", not
  "Russian" translated into the currently active language)

#### Scenario: A string not yet translated
- **WHEN** the selected language has no translation (or an empty one) for a
  piece of interface text
- **THEN** that text renders in English, never blank and never as its
  internal message key

### Requirement: Exercise content is unaffected by interface language
The interface language SHALL govern only the application's own chrome. It
SHALL NOT alter exercise content: the target sentence, its audio, and any
other data delivered by the exercise API render exactly as the API provides
them regardless of which interface language is selected.

#### Scenario: Thai exercise content stays Thai
- **WHEN** the interface language is set to English (or French, German,
  Russian, or Hungarian) and a Thai exercise is displayed
- **THEN** the target sentence is still rendered in Thai script, and the
  audio clip is unchanged

#### Scenario: Thai interface with Thai exercise content
- **WHEN** the interface language is set to Thai
- **THEN** the interface's own chrome (Settings menu, hints, messages) is
  rendered in Thai, in addition to the exercise content that was already
  Thai

### Requirement: Default interface language
On first visit, the interface language SHALL default to the browser's
reported language when that language is one of the six supported languages,
and to English otherwise. The learner's own choice, once made, SHALL always
take precedence over this default.

#### Scenario: Browser language is supported
- **WHEN** a learner with no stored language preference opens the
  application, and their browser reports a language among the six supported
  ones
- **THEN** the interface renders in that language without the learner
  choosing anything

#### Scenario: Browser language is unsupported
- **WHEN** a learner with no stored language preference opens the
  application, and their browser reports a language outside the six
  supported ones
- **THEN** the interface renders in English

### Requirement: Interface language persists across visits
The learner's chosen interface language SHALL persist across page reloads and
future visits on the same browser, on a best-effort basis consistent with the
application's other settings: when persistence is unavailable, the choice
SHALL still apply for the current session.

#### Scenario: Returning after choosing a language
- **WHEN** a learner selects a language, then reloads the page or returns in
  a later visit
- **THEN** the interface renders in that previously chosen language, without
  the learner selecting it again

#### Scenario: Storage is unavailable
- **WHEN** the browser refuses persistent storage (e.g. private browsing)
- **THEN** a language choice made during the visit still applies for the rest
  of that session, even though it will not survive a reload
