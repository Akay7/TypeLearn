## MODIFIED Requirements

### Requirement: On-screen Thai keyboard
The frontend SHALL provide a custom on-screen keyboard of Thai consonants, vowels, tone marks, and symbols, with no external keyboard dependency. The keys SHALL be arranged in the Kedmanee layout — the standard Thai keyboard — so that the position a learner reads on screen is the position their finger takes on a physical keyboard. Characters that Kedmanee reaches through Shift SHALL be available through an on-screen Shift control that swaps the displayed layer.

#### Scenario: Typing with the keyboard
- **WHEN** the learner clicks a key
- **THEN** that character is appended to the typed answer and appears in the input field immediately

#### Scenario: Every character of a target sentence is reachable
- **WHEN** an exercise's sentence contains a character that Kedmanee places on the Shift layer
- **THEN** that character can be entered by activating Shift and clicking its key, without leaving the on-screen keyboard

#### Scenario: Next-key highlight
- **WHEN** the learner has typed a correct prefix of the target sentence
- **THEN** the key for the next expected character is visually highlighted

#### Scenario: The highlight is never hidden behind a layer
- **WHEN** the next expected character lives on a layer other than the one displayed
- **THEN** the displayed layer switches to the one holding that character, so the highlighted key is visible without the learner hunting for it

#### Scenario: No character key is highlighted once the answer diverges
- **WHEN** the typed answer is not a prefix of the target sentence
- **THEN** no character key is highlighted, rather than an arbitrary key being marked as expected

#### Scenario: A diverged answer is pointed back on track
- **WHEN** the typed answer is not a prefix of the target sentence
- **THEN** the backspace key is highlighted instead, so the keyboard always names a key worth pressing rather than going blank at the moment the learner is most lost

#### Scenario: A finished answer is not treated as a mistake
- **WHEN** the learner has typed the whole target sentence and no character remains to type
- **THEN** the backspace key is not highlighted, because the answer is complete rather than wrong

#### Scenario: Physical keyboard also works
- **WHEN** the learner types Thai characters using their physical keyboard
- **THEN** the input field and the typed answer update the same way as with on-screen keys

#### Scenario: Correcting a mistake
- **WHEN** the learner removes the last character, whether with the on-screen backspace or the physical one
- **THEN** the typed answer shortens by one character and the next-key highlight follows it back, and the backspace key stops being highlighted as soon as the answer is a correct prefix again

### Requirement: Session flows without configuration
The MVP SHALL run with no login, no account, and no configuration by the learner.

#### Scenario: First visit
- **WHEN** a new visitor opens the application
- **THEN** they reach a playable exercise directly, with no sign-in, setup, or language selection step

#### Scenario: Advancing through exercises
- **WHEN** the learner answers correctly
- **THEN** a different exercise from the catalog is presented next

#### Scenario: No exercise repeats while unseen ones remain
- **WHEN** the learner answers correctly and the session has not yet presented every exercise in the catalog
- **THEN** the exercise presented next is one the session has not shown before

#### Scenario: The catalog is exhausted
- **WHEN** the learner answers the last remaining exercise of the catalog correctly
- **THEN** practice continues from the beginning of the catalog rather than ending in a blank screen or an error

## ADDED Requirements

### Requirement: Finger guidance on the keyboard
Key position alone does not tell a learner which finger to press a key with, so the on-screen keyboard SHALL show the touch-typing finger for every key, and SHALL explain what the indication means rather than relying on an unexplained visual code.

#### Scenario: Keys are grouped by finger
- **WHEN** the keyboard is displayed
- **THEN** each key carries the colour of the finger that presses it, so the columns belonging to one finger are distinguishable from its neighbours

#### Scenario: The colours are explained
- **WHEN** the keyboard is displayed
- **THEN** a legend naming each finger accompanies it, so the colour code can be read without being guessed

#### Scenario: A key's finger does not depend on the layer
- **WHEN** the displayed layer changes between base and shift
- **THEN** the key in a given position keeps the same finger, because the finger follows the position rather than the character printed on it

#### Scenario: The modifiers are covered too
- **WHEN** the keyboard is displayed
- **THEN** Shift, Backspace, and the space bar carry finger indications on the same scheme as the character keys

#### Scenario: The next-key highlight stays legible over the colours
- **WHEN** a key is highlighted as the next expected character
- **THEN** the highlight remains distinguishable regardless of which finger colour that key carries

### Requirement: Answer state resets between exercises
When a new exercise is presented, the frontend SHALL clear everything belonging to the previous one, so the learner starts from an empty field with no stale verdict on screen.

#### Scenario: A new exercise starts empty
- **WHEN** the next exercise is presented
- **THEN** the typed answer is empty, the input field is empty, and no correct or incorrect result is displayed

#### Scenario: Audio follows the new exercise
- **WHEN** the next exercise is presented and the learner activates play
- **THEN** the clip that plays is the new exercise's, not the previous one's

#### Scenario: The keyboard points at the new sentence
- **WHEN** the next exercise is presented
- **THEN** the highlighted key is the one for the first character of the new sentence
