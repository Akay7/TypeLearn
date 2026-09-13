# practice-stats Specification

## Purpose
Gives the learner a running sense of how much practice they've done, by
tracking correct symbols, key presses, and completed exercises per day in
the browser, and surfacing today's and the last week's totals right after a
correct check — alongside the exercise's own audio playing again.

## Requirements

### Requirement: Daily practice counters are tracked in the browser
The frontend SHALL count, for the local calendar day, the number of symbols
typed correctly, the number of key presses, and the number of exercises
completed, and SHALL keep these counts in browser storage with no backend
request and no database record. Counts SHALL persist across a page reload
within the same day, and at least the last 7 calendar days of counts SHALL
remain available for the totals below.

A key press is counted for every character-affecting action on the answer
field — appending a character or removing one — whether performed on the
physical keyboard or the on-screen one. A symbol is counted as correct when,
at the moment it is typed, it matches the character the target sentence
expects at that position. Pressing a wrong key and then removing it SHALL
count as two key presses and zero correct symbols.

#### Scenario: A correctly typed character is counted
- **WHEN** the learner types a character that matches the next expected
  character of the target sentence
- **THEN** today's correct-symbol count increases by one, and today's
  key-press count also increases by one

#### Scenario: A wrong character followed by its correction is two key presses
- **WHEN** the learner types a character that does not match the next
  expected character, then removes it
- **THEN** today's key-press count increases by two in total, and today's
  correct-symbol count does not increase

#### Scenario: An exercise completed correctly is counted
- **WHEN** a checked answer matches the target sentence
- **THEN** today's exercises-completed count increases by one

#### Scenario: Counts survive a reload on the same day
- **WHEN** the page is reloaded on the same calendar day
- **THEN** the counts accumulated earlier that day are unchanged

#### Scenario: A new calendar day starts its own counts
- **WHEN** practice happens on a calendar day with no prior counts recorded
- **THEN** that day's counts start at zero, independent of any previous day's
  totals

### Requirement: Post-check summary shows today's and the last 7 days' totals
When the completion-stats setting is on, the frontend SHALL show, right after
a correct check, the current totals for correct symbols, key presses, and
exercises completed — both for today and summed across the last 7 calendar
days including today.

#### Scenario: Summary follows a correct check
- **WHEN** a checked answer is correct and the completion-stats setting is on
- **THEN** today's and the last 7 days' correct-symbol, key-press, and
  exercises-completed totals are displayed, including the exercise just
  completed

#### Scenario: No summary when the setting is off
- **WHEN** a checked answer is correct and the completion-stats setting is off
- **THEN** no summary is displayed

### Requirement: The summary replaces the answer field, not the keyboard
Once a checked answer is correct, the answer field and the Check control have
nothing further to do, so the summary SHALL appear in their place rather
than as a separate element elsewhere on the page. The on-screen keyboard, if
the learner has it on, SHALL be left exactly as it is — neither hidden nor
replaced — and the sentence and hint above the answer field SHALL NOT change
position. The summary SHALL NOT be a modal or an overlay that blocks
interaction with the rest of the page.

#### Scenario: The summary takes the answer field's place
- **WHEN** the summary is displayed after a correct check
- **THEN** it appears where the answer field and Check control were, and no
  summary content appears anywhere else on the page

#### Scenario: The on-screen keyboard is undisturbed
- **WHEN** the summary is displayed after a correct check and the learner has
  the on-screen keyboard on
- **THEN** the keyboard stays visible, in the same position, exactly as it
  was before the check

#### Scenario: Nothing above the answer field moves
- **WHEN** the summary is displayed after a correct check
- **THEN** the sentence and the hint row above the answer field occupy
  exactly the positions they held before the check

#### Scenario: The summary does not block the page
- **WHEN** the summary is displayed
- **THEN** it does not dim, cover, or prevent interaction with any other part
  of the page

### Requirement: The completed sentence's audio plays with the summary
While the summary is shown, the clip for the exercise that was just
completed SHALL play automatically, reinforcing the sound the learner just
typed from memory. This reuses the exercise's own existing playback
control — the same one shown for every exercise, see `typing-practice`'s
"Audio playback" requirement for how Play and Pause behave — rather than a
second copy of it, so the learner can pause it, or play it again once it
has finished, exactly as with any other clip, and never sees two controls
for the one clip.

#### Scenario: The clip plays automatically
- **WHEN** the summary is displayed after a correct check
- **THEN** the audio clip for the exercise just completed starts playing
  without the learner activating anything

#### Scenario: Only one control for the clip
- **WHEN** the summary is displayed after a correct check
- **THEN** exactly one playback control for that exercise's clip is shown,
  not a second one alongside it

#### Scenario: No automatic replay when the setting is off
- **WHEN** a checked answer is correct and the completion-stats setting is off
- **THEN** the completed exercise's clip is not played again on its own —
  the exercise's own playback control remains, as it does for any exercise,
  available to play it manually

### Requirement: Advancing waits for the learner while the summary is shown
While the summary is displayed, the frontend SHALL NOT advance to the next
exercise on its own; the learner SHALL advance explicitly.

#### Scenario: The learner continues explicitly
- **WHEN** the summary is displayed and the learner activates the control to
  continue
- **THEN** the summary is dismissed and the next exercise is presented

#### Scenario: No automatic advance while the summary is showing
- **WHEN** the summary is displayed
- **THEN** no fixed delay on its own advances to the next exercise

### Requirement: Learner can turn the summary off
The frontend SHALL provide a setting, on by default, that the learner can
turn off to skip the summary and replay entirely and go straight to the next
exercise, the same way checking a correct answer has always worked. The
choice SHALL persist across visits the same way the existing settings do.

#### Scenario: Turning the setting off restores immediate advance
- **WHEN** the completion-stats setting is off and a checked answer is correct
- **THEN** the verdict is shown and the next exercise loads automatically,
  with no summary and no replay

#### Scenario: The setting persists
- **WHEN** the learner changes the completion-stats setting and returns to the
  application later
- **THEN** the setting keeps the value they chose

#### Scenario: On by default
- **WHEN** a learner who has never touched this setting checks a correct
  answer
- **THEN** the summary and replay are shown, because the setting defaults to
  on
