## ADDED Requirements

### Requirement: Exercise presentation
The frontend SHALL display one exercise at a time in a single centered column: the target sentence in large text, and a length hint below it.

#### Scenario: Loading the first exercise
- **WHEN** the learner opens the application
- **THEN** an exercise is fetched from the API and its sentence is rendered in large text, with no console error

#### Scenario: Length hint
- **WHEN** an exercise is displayed
- **THEN** a hint showing the expected character count is rendered beneath the sentence

### Requirement: Audio playback
The learner SHALL be able to play the exercise's audio on demand and replay it any number of times.

#### Scenario: Playing audio
- **WHEN** the learner activates the play control
- **THEN** the clip at the exercise's `audioUrl` plays through an HTML5 `<audio>` element

#### Scenario: Replaying
- **WHEN** the learner activates replay while a clip is playing or after it ended
- **THEN** playback restarts from the beginning

### Requirement: On-screen Thai keyboard
The frontend SHALL provide a custom on-screen keyboard of Thai consonants, vowels, tone marks, and symbols, with no external keyboard dependency.

#### Scenario: Typing with the keyboard
- **WHEN** the learner clicks a key
- **THEN** that character is appended to the typed answer and appears in the input field immediately

#### Scenario: Next-key highlight
- **WHEN** the learner has typed a correct prefix of the target sentence
- **THEN** the key for the next expected character is visually highlighted

#### Scenario: Physical keyboard also works
- **WHEN** the learner types Thai characters using their physical keyboard
- **THEN** the input field and the typed answer update the same way as with on-screen keys

### Requirement: Answer checking
The learner SHALL be able to check the typed answer against the target sentence. For the MVP the comparison SHALL happen client-side, with no backend write.

#### Scenario: Correct answer
- **WHEN** the learner checks an answer exactly matching the target sentence
- **THEN** a green "correct" result is shown and the next exercise loads automatically

#### Scenario: Incorrect answer
- **WHEN** the learner checks an answer that does not match
- **THEN** a red "incorrect" result is shown, the expected sentence is revealed, and the learner may keep trying

#### Scenario: Checking via Enter
- **WHEN** the learner presses Enter in the input field
- **THEN** the answer is checked exactly as if the Check control had been activated

#### Scenario: No attempt is persisted
- **WHEN** any answer is checked
- **THEN** no request is sent to record the attempt

### Requirement: Session flows without configuration
The MVP SHALL run with no login, no account, and no configuration by the learner.

#### Scenario: First visit
- **WHEN** a new visitor opens the application
- **THEN** they reach a playable exercise directly, with no sign-in, setup, or language selection step

#### Scenario: Advancing through exercises
- **WHEN** the learner answers correctly
- **THEN** a different exercise from the catalog is presented next
