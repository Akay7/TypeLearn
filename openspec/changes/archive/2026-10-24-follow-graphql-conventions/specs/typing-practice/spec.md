## MODIFIED Requirements

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
- **THEN** the clip at that exercise's `originalAudio.url` starts playing without the
  learner activating anything

#### Scenario: Playing audio
- **WHEN** the learner activates the play control while the clip is stopped
- **THEN** the clip at the exercise's `originalAudio.url` plays through an HTML5 `<audio>`
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
