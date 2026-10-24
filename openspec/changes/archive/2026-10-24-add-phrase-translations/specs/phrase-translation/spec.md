## Purpose

Lets a learner see what the phrase they are typing means, in a language they
read, and lets learners improve those translations by rating them and proposing
better ones.

## ADDED Requirements

### Requirement: Show-translation setting
The Settings menu SHALL offer a "Show translation" on/off control. It SHALL be
off by default. Its value SHALL persist across reloads on the same browser on a
best-effort basis, the same as the other settings: when storage is unavailable,
the choice still applies for the current session.

#### Scenario: Default is off
- **WHEN** a learner with no stored preference opens the application
- **THEN** no translation is shown with the exercise

#### Scenario: Turning it on
- **WHEN** the learner enables "Show translation" in the Settings menu
- **THEN** the current exercise shows its translation (if one exists)
  immediately, without a page reload

#### Scenario: Choice survives a reload
- **WHEN** the learner enables the setting and reloads the page
- **THEN** the setting is still enabled

### Requirement: Translation follows the interface language
When the setting is on, the exercise SHALL show the translation of its sentence
into the current interface language. It SHALL be shown beneath the target
sentence, visually subordinate to it, and marked with that language. When the
interface language changes, the shown translation SHALL change to the new
language without a page reload.

#### Scenario: Translation in the interface language
- **WHEN** the setting is on, the interface language is French, and the
  exercise has a published French translation
- **THEN** that French translation is shown beneath the Thai sentence

#### Scenario: Switching interface language
- **WHEN** the setting is on and the learner switches the interface language
  from French to German
- **THEN** the German translation replaces the French one for the current
  exercise

#### Scenario: Interface language is the exercise's language
- **WHEN** the interface language is the same as the exercise's own language
  (Thai interface, Thai exercise)
- **THEN** no translation and no rating or proposal controls are shown

#### Scenario: No translation exists
- **WHEN** the setting is on and the exercise has no published translation into
  the interface language
- **THEN** a short "No translation yet" note is shown with an offer to suggest
  one, and the exercise otherwise works normally

#### Scenario: Translation never blocks practice
- **WHEN** the translation cannot be loaded (network or server error)
- **THEN** the exercise remains fully usable, and the failure is shown no more
  prominently than the absent-translation note

### Requirement: Which translation is shown
For each exercise and language, at most one translation SHALL be shown: the
published translation with the highest net rating (up-votes minus down-votes).
Ties SHALL go to the most recently published one. Pending and rejected
translations SHALL never be shown.

#### Scenario: A better-rated translation wins
- **WHEN** an exercise has a published machine translation with net rating −2
  and a published learner translation with net rating +1 in the same language
- **THEN** the learner translation is shown

#### Scenario: A newly approved suggestion
- **WHEN** a moderator approves a suggestion for a translation whose net rating
  is 0, and the new translation also starts at 0
- **THEN** the newly approved translation is shown

#### Scenario: Pending suggestions are invisible
- **WHEN** a suggestion has been submitted but not yet approved
- **THEN** no learner sees it as the exercise's translation

### Requirement: Rating a shown translation
While a translation is shown, the learner SHALL be able to rate it as good or
bad. A browser SHALL hold at most one rating per translation. Rating again SHALL
replace the earlier rating, and selecting the active rating again SHALL withdraw
it. The control SHALL reflect the browser's current rating for the rest of the
session.

#### Scenario: Rating up
- **WHEN** the learner marks the shown translation as good
- **THEN** the rating is recorded and the "good" control shows as selected

#### Scenario: Changing a rating
- **WHEN** a learner who rated a translation good then marks it bad
- **THEN** the translation has one bad rating from that browser and no good
  rating from it

#### Scenario: Withdrawing a rating
- **WHEN** a learner who rated a translation good selects "good" again
- **THEN** that browser's rating is removed

#### Scenario: Rating does not disturb typing
- **WHEN** the learner rates a translation mid-exercise
- **THEN** the typed answer, the check state, and focus in the answer field are
  unchanged

### Requirement: Proposing a better translation
The learner SHALL be able to open a form to suggest a translation into the
current interface language, for any exercise, whether or not a translation is
shown. Submitting SHALL store the suggestion as pending moderation and confirm
this to the learner ("Thanks — it will appear after review"). An empty
suggestion, one identical to the shown translation, or one longer than the
maximum length SHALL be refused with a message and not stored.

#### Scenario: Suggesting after a bad translation
- **WHEN** the learner opens the suggestion form, types a translation, and
  submits it
- **THEN** the suggestion is stored as pending, a confirmation is shown, and the
  form closes

#### Scenario: Typing in the suggestion form
- **WHEN** the learner types into the suggestion form with a physical keyboard
- **THEN** the keystrokes go to the form only, never to the exercise's answer
  field, and they are not checked against the target sentence

#### Scenario: Empty suggestion
- **WHEN** the learner submits the form with only whitespace
- **THEN** nothing is stored and the form explains that a translation is required

#### Scenario: Too many suggestions
- **WHEN** a browser or address exceeds the suggestion rate limit
- **THEN** the suggestion is refused with a message asking the learner to try
  later, and the exercise keeps working

### Requirement: Moderating suggestions
Staff SHALL be able to review pending suggestions in the admin interface, see
each suggestion next to the exercise's sentence and currently shown translation,
and approve or reject them singly or in bulk. Approving SHALL publish the
suggestion. Rejecting SHALL keep it stored but never shown.

#### Scenario: Approving a suggestion
- **WHEN** a staff member approves a pending suggestion
- **THEN** it becomes a published translation and is eligible to be shown

#### Scenario: Rejecting a suggestion
- **WHEN** a staff member rejects a pending suggestion
- **THEN** it is never shown, and a later identical suggestion for the same
  exercise and language is refused as already reviewed
