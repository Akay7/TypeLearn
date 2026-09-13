## MODIFIED Requirements

### Requirement: Answer checking
The typed answer SHALL be checked against the target sentence automatically as
soon as it is long enough to be a complete attempt, and SHALL also be checkable
on demand. For the MVP the comparison SHALL happen client-side, with no backend
write. When a correct answer is checked, the next exercise SHALL load
automatically unless the completion-stats setting is on, in which case the
frontend SHALL wait for the learner to continue past the post-check summary
before advancing (see the `practice-stats` capability).

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
  automatically or on demand, and the completion-stats setting is off
- **THEN** a green "correct" result is shown and the next exercise loads
  automatically

#### Scenario: Correct answer with the post-check summary enabled
- **WHEN** an answer exactly matching the target sentence is checked, whether
  automatically or on demand, and the completion-stats setting is on
- **THEN** the post-check summary appears in place of the answer field,
  itself confirming the answer was correct, and the frontend waits for the
  learner to continue past it rather than advancing on its own

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

### Requirement: Session flows without configuration
The MVP SHALL run with no login, no account, and no configuration by the learner.

#### Scenario: First visit
- **WHEN** a new visitor opens the application
- **THEN** they reach a playable exercise directly, with no sign-in, setup, or language selection step

#### Scenario: Advancing through exercises
- **WHEN** the learner answers correctly and the completion-stats setting is off
- **THEN** a different exercise from the catalog is presented next, automatically

#### Scenario: Advancing through exercises with the post-check summary enabled
- **WHEN** the learner answers correctly and the completion-stats setting is on
- **THEN** a different exercise from the catalog is presented once the learner
  continues past the post-check summary

#### Scenario: No exercise repeats while unseen ones remain
- **WHEN** the learner answers correctly and the session has not yet presented every exercise in the catalog
- **THEN** the exercise presented next is one the session has not shown before

#### Scenario: The catalog is exhausted
- **WHEN** the learner answers the last remaining exercise of the catalog correctly
- **THEN** practice continues from the beginning of the catalog rather than ending in a blank screen or an error

### Requirement: A verdict does not move the page
The feedback the learner gets for a check SHALL NOT change the position of
anything else on screen. The keyboard is a positional aid — its argument is that
the highlighted key sits where the finger goes — so a verdict that pushes it
down defeats the feature it appears next to, at the moment the learner is most
dependent on it. This guarantee covers the answer field only while it is still
in play: once a correct check replaces it with the post-check summary (see
`practice-stats`), the field's own content is expected to change — what must
not move is everything around it.

#### Scenario: The keyboard stays put through a check
- **WHEN** the learner checks an answer and an incorrect verdict appears, or a
  correct verdict appears with the completion-stats setting off
- **THEN** the input field and the on-screen keyboard occupy exactly the
  positions they held before the check

#### Scenario: The keyboard stays put when the summary replaces the field
- **WHEN** a correct verdict appears with the completion-stats setting on
- **THEN** the sentence, the hint row, and the on-screen keyboard occupy
  exactly the positions they held before the check, even though the answer
  field's own content is replaced by the summary

#### Scenario: Space is reserved before any verdict exists
- **WHEN** an exercise is presented and no answer has been checked yet
- **THEN** the feedback area already occupies its full height, empty, so the
  first verdict of the exercise fills reserved space rather than claiming new
  space

#### Scenario: The two verdicts are the same height
- **WHEN** a correct verdict is replaced by an incorrect one, or the reverse
- **THEN** the surrounding layout does not shift, because neither verdict is
  taller than the space reserved for it

### Requirement: Audio playback
The clip SHALL play on its own when an exercise is presented, before any typing,
because the exercise is something the learner is meant to hear first. The
learner SHALL also be able to play it again on demand any number of times, and
the play control SHALL reflect whether the clip is currently playing: while it
plays, the control SHALL read as a pause action, and activating it SHALL pause
playback in place rather than restart it. Browsers may refuse to start audio
before the learner has interacted with the page; where that happens the
frontend SHALL say so and leave the play control as the way through, rather
than failing silently.

#### Scenario: Playing on presentation
- **WHEN** an exercise is presented
- **THEN** the clip at that exercise's `audioUrl` starts playing without the
  learner activating anything

#### Scenario: Playing audio
- **WHEN** the learner activates the play control while the clip is stopped
- **THEN** the clip at the exercise's `audioUrl` plays through an HTML5 `<audio>`
  element

#### Scenario: The control shows as Pause while playing
- **WHEN** the clip is playing, whether started automatically or by the learner
- **THEN** the control reads as Pause rather than Play

#### Scenario: Pausing keeps the current position
- **WHEN** the learner activates Pause while the clip is playing
- **THEN** playback stops immediately without resetting its position, and the
  control switches back to reading as Play

#### Scenario: Resuming continues from where it paused
- **WHEN** the learner activates Play after pausing
- **THEN** playback resumes from the position it was paused at, rather than
  starting over from the beginning

#### Scenario: Replaying
- **WHEN** the learner activates Play after the clip has finished playing on
  its own
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
