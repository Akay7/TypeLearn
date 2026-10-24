## MODIFIED Requirements

### Requirement: Exercise content is unaffected by interface language
The interface language SHALL govern only the application's own chrome and,
when the learner has turned it on, the language of the exercise's optional
translation. It SHALL NOT alter the exercise content itself: the target
sentence, its audio, and any other data delivered by the exercise API render
exactly as the API provides them regardless of which interface language is
selected.

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

#### Scenario: Translation follows the interface language
- **WHEN** "Show translation" is on and the interface language is Russian
- **THEN** the translation shown beneath the Thai sentence is the Russian one,
  and the Thai sentence itself is unchanged
