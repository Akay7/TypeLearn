## MODIFIED Requirements

### Requirement: Finger guidance on the keyboard
Key position alone does not tell a learner which finger to press a key with, so the on-screen keyboard SHALL show the touch-typing finger for every key, and SHALL explain what the indication means rather than relying on an unexplained visual code. The finger SHALL be a property of the physical board rather than of the layout printed on it, so every layout on that board guides the same finger to the same position. The two index fingers SHALL each carry their own colour, distinct from each other and from every other finger, so a highlighted index-finger key also says which hand reaches it; every other finger SHALL keep sharing one colour between its left and right instance. Each index finger's home-row key SHALL carry a visible resting-position marker, the on-screen equivalent of the tactile bump a physical keyboard puts on F and J, so a learner has an anchor to return to between keystrokes.

#### Scenario: Keys are grouped by finger
- **WHEN** the keyboard is displayed
- **THEN** each key carries the colour of the finger that presses it, so the columns belonging to one finger are distinguishable from its neighbours

#### Scenario: The index fingers are distinguishable by hand
- **WHEN** the keyboard is displayed
- **THEN** the left index finger's keys carry a different colour from the right index finger's keys, so the two are told apart without reading a label

#### Scenario: Other fingers still mirror across hands
- **WHEN** the keyboard is displayed
- **THEN** the pinky, ring, and middle fingers each keep one colour shared between their left and right instance, so the palette does not grow beyond what is needed to tell the index fingers apart

#### Scenario: The colours are explained
- **WHEN** the keyboard is displayed
- **THEN** a legend naming each finger accompanies it, including the two index-finger colours as distinct entries, so the colour code can be read without being guessed

#### Scenario: A key's finger does not depend on the layer
- **WHEN** the displayed layer changes to any other layer of the layout
- **THEN** the key in a given position keeps the same finger, because the finger follows the position rather than the character printed on it

#### Scenario: A key's finger does not depend on the layout
- **WHEN** two layouts on the same physical board are compared
- **THEN** a given position carries the same finger in both, because the finger belongs to the board

#### Scenario: The modifiers are covered too
- **WHEN** the keyboard is displayed
- **THEN** every modifier the layout declares, along with Backspace and the space bar, carries a finger indication on the same scheme as the character keys

#### Scenario: The next-key highlight stays legible over the colours
- **WHEN** a key is highlighted as the next expected character
- **THEN** the highlight remains distinguishable regardless of which finger colour that key carries

#### Scenario: An index finger's home key is marked
- **WHEN** the keyboard is displayed
- **THEN** the key each index finger rests on when no other key is being reached — F and J on a Latin board, their Kedmanee equivalents on the Thai board — carries a visible marker distinct from the highlight used for the next expected character

#### Scenario: The home marker does not depend on the layout or layer
- **WHEN** the displayed layout or layer changes
- **THEN** the home marker stays on the same position — the index fingers' home key on the physical board — because it marks a position, not a character

#### Scenario: The home marker survives the next-key highlight
- **WHEN** the key carrying the home marker is also the next expected character
- **THEN** both the home marker and the highlight are visible on that key, so neither indication is lost to the other

#### Scenario: The home marker is explained
- **WHEN** the keyboard is displayed
- **THEN** the legend states what the resting-position marker means, alongside the finger colours
