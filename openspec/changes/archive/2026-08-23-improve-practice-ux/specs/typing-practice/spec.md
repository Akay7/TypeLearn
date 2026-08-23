## ADDED Requirements

### Requirement: Thai script is rendered in a looped face
The frontend SHALL render Thai text in a looped typeface it ships itself, rather
than inheriting whatever the operating system resolves for `system-ui`. A learner
who cannot yet tell Thai letters apart depends on the head — the loop that opens
most consonants — to identify them, and a loopless display face erases exactly
that cue. The face SHALL be served from the application's own origin, so the app
renders identically offline and calls no font CDN.

#### Scenario: The sentence renders with loops
- **WHEN** an exercise sentence is displayed
- **THEN** it is rendered in the bundled looped Thai face, and every consonant
  that has a head shows it as a loop

#### Scenario: Every Thai surface uses the same face
- **WHEN** Thai text appears in the sentence, the answer input, the on-screen
  keycaps, or any other place the app writes Thai
- **THEN** all of them render in the same bundled looped face, so a character
  looks the same wherever the learner meets it

#### Scenario: No network request for the font
- **WHEN** the application loads
- **THEN** the font is fetched from the application's own origin, and no request
  is made to an external font host

#### Scenario: Latin text is unaffected
- **WHEN** the interface's own English labels, hints, and controls are rendered
- **THEN** they keep the existing sans-serif stack, because the looped face is
  chosen for Thai and not for the chrome around it

### Requirement: The exercise fits on one screen
The whole exercise — sentence, controls, input, and keyboard — SHALL be visible
at once on a common laptop screen, with no scrolling. A learner touch-typing
looks between the sentence and the keys; a page that puts the board below the
fold makes them scroll away from the thing they are typing, and the finger
guidance is worth nothing to someone who cannot see it. To that end the check
control SHALL sit beside the answer field rather than below it, since a row
spent there is a row that pushes the keyboard down.

#### Scenario: Nothing is below the fold on a laptop
- **WHEN** the application is opened at a viewport of 1280×720, with the longest
  sentence the catalog can present
- **THEN** the page does not scroll: the sentence, the play control, the answer
  field, the verdict area, and every key of the keyboard are all within the
  viewport

#### Scenario: The check control is beside the field
- **WHEN** an exercise is displayed
- **THEN** the check control sits on the same row as the answer field, to its
  right, rather than on a row of its own beneath it

#### Scenario: The field lines up with the keys
- **WHEN** an exercise is displayed
- **THEN** the answer field's row spans exactly the width of the keyboard below
  it, so the exercise reads as one column rather than two of different widths

### Requirement: A verdict does not move the page
The feedback the learner gets for a check SHALL NOT change the position of
anything else on screen. The keyboard is a positional aid — its argument is that
the highlighted key sits where the finger goes — so a verdict that pushes it
down defeats the feature it appears next to, at the moment the learner is most
dependent on it.

#### Scenario: The keyboard stays put through a check
- **WHEN** the learner checks an answer and a correct or incorrect verdict
  appears
- **THEN** the input field and the on-screen keyboard occupy exactly the
  positions they held before the check

#### Scenario: Space is reserved before any verdict exists
- **WHEN** an exercise is presented and no answer has been checked yet
- **THEN** the feedback area already occupies its full height, empty, so the
  first verdict of the exercise fills reserved space rather than claiming new
  space

#### Scenario: The two verdicts are the same height
- **WHEN** a correct verdict is replaced by an incorrect one, or the reverse
- **THEN** the surrounding layout does not shift, because neither verdict is
  taller than the space reserved for it

## MODIFIED Requirements

### Requirement: Audio playback
The clip SHALL play on its own when an exercise is presented, before any typing,
because the exercise is something the learner is meant to hear first. The
learner SHALL also be able to replay it on demand any number of times. Browsers
may refuse to start audio before the learner has interacted with the page; where
that happens the frontend SHALL say so and leave the play control as the way
through, rather than failing silently.

#### Scenario: Playing on presentation
- **WHEN** an exercise is presented
- **THEN** the clip at that exercise's `audioUrl` starts playing without the
  learner activating anything

#### Scenario: Playing audio
- **WHEN** the learner activates the play control
- **THEN** the clip at the exercise's `audioUrl` plays through an HTML5 `<audio>`
  element

#### Scenario: Replaying
- **WHEN** the learner activates replay while a clip is playing or after it ended
- **THEN** playback restarts from the beginning

#### Scenario: The browser refuses to autoplay
- **WHEN** automatic playback is rejected by the browser's autoplay policy
- **THEN** a short prompt to press play is shown next to the play control, the
  underlying error reaches the console, and nothing else about the exercise is
  disturbed

#### Scenario: The prompt clears once sound is heard
- **WHEN** the learner presses play after autoplay was refused, and the clip
  plays
- **THEN** the prompt disappears, and subsequent exercises play automatically
  without it reappearing

#### Scenario: Autoplay carries no cost when it succeeds
- **WHEN** automatic playback succeeds
- **THEN** no prompt or error is shown

### Requirement: Answer checking
The typed answer SHALL be checked against the target sentence automatically as
soon as it is long enough to be a complete attempt, and SHALL also be checkable
on demand. For the MVP the comparison SHALL happen client-side, with no backend
write.

#### Scenario: Checking on completion
- **WHEN** the typed answer reaches the length of the target sentence, counted
  in the characters a learner types
- **THEN** the answer is checked automatically, with no key press or click
  beyond the character that completed it

#### Scenario: A completed answer that is wrong is still checked
- **WHEN** the typed answer reaches the target's length but does not match it
- **THEN** the incorrect verdict is shown automatically, rather than waiting for
  the learner to ask

#### Scenario: The verdict follows further typing
- **WHEN** the learner keeps typing or deletes characters after an automatic
  check
- **THEN** the stale verdict is cleared, and a new automatic check happens once
  the answer is again as long as the target

#### Scenario: Correct answer
- **WHEN** an answer exactly matching the target sentence is checked, whether
  automatically or on demand
- **THEN** a green "correct" result is shown and the next exercise loads
  automatically

#### Scenario: Incorrect answer
- **WHEN** an answer that does not match is checked
- **THEN** a red "incorrect" result is shown, the target sentence stays visible
  where it has been all along, and the learner may keep trying

#### Scenario: Checking via Enter
- **WHEN** the learner presses Enter in the input field
- **THEN** the answer is checked exactly as if the Check control had been
  activated, whatever its length

#### Scenario: Checking on demand while short
- **WHEN** the learner activates the Check control before the answer is as long
  as the target
- **THEN** the answer is checked and found incorrect, because the manual path
  stays available at any length

#### Scenario: No attempt is persisted
- **WHEN** any answer is checked, automatically or on demand
- **THEN** no request is sent to record the attempt

### Requirement: Answer state resets between exercises
When a new exercise is presented, the frontend SHALL clear everything belonging
to the previous one, so the learner starts from an empty field with no stale
verdict on screen and no leftover audio.

#### Scenario: A new exercise starts empty
- **WHEN** the next exercise is presented
- **THEN** the typed answer is empty, the input field is empty, and no correct or
  incorrect result is displayed

#### Scenario: Audio follows the new exercise
- **WHEN** the next exercise is presented
- **THEN** the clip that plays — automatically, and on any later replay — is the
  new exercise's, not the previous one's

#### Scenario: The previous clip does not overlap the new one
- **WHEN** the next exercise is presented while the previous exercise's clip is
  still playing
- **THEN** the previous clip stops, and only the new exercise's clip is heard

#### Scenario: The keyboard points at the new sentence
- **WHEN** the next exercise is presented
- **THEN** the highlighted key is the one for the first character of the new
  sentence
