## RENAMED Requirements

- FROM: `### Requirement: On-screen Thai keyboard`
- TO: `### Requirement: On-screen keyboard for the exercise's language`

## MODIFIED Requirements

### Requirement: On-screen keyboard for the exercise's language
The frontend SHALL provide a custom on-screen keyboard for the language of the exercise being practised, with no external keyboard dependency. Its keys SHALL be arranged in that language's standard layout — Kedmanee for Thai — so that the position a learner reads on screen is the position their finger takes on a physical keyboard. Characters the layout reaches through a modifier SHALL be available through an on-screen control for that modifier, which swaps the displayed layer.

Layouts SHALL be registered per language and selected by the exercise's language. While only one layout is registered, every exercise SHALL be served by it.

#### Scenario: Typing with the keyboard
- **WHEN** the learner clicks a key
- **THEN** that character is appended to the typed answer and appears in the input field immediately

#### Scenario: Every character of a target sentence is reachable
- **WHEN** an exercise's sentence contains a character that its layout places on
  a layer other than the base one
- **THEN** that character can be entered by activating that layer's modifier and
  clicking its key, without leaving the on-screen keyboard

#### Scenario: The layout follows the exercise
- **WHEN** an exercise is presented
- **THEN** the keyboard shows the layout registered for that exercise's
  language, so the board on screen is the one that language is typed on

#### Scenario: Thai is served by Kedmanee
- **WHEN** a Thai exercise is presented
- **THEN** the keyboard shows the Kedmanee layout, unchanged in its keys, its
  layers, and its finger assignments

#### Scenario: Next-key highlight
- **WHEN** the learner has typed a correct prefix of the target sentence
- **THEN** the key for the next expected character is visually highlighted

#### Scenario: The highlight is never hidden behind a layer
- **WHEN** the next expected character lives on a layer other than the one displayed
- **THEN** the displayed layer switches to the one holding that character, whichever layer that is, so the highlighted key is visible without the learner hunting for it

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
- **WHEN** the learner types characters using their physical keyboard
- **THEN** the input field and the typed answer update the same way as with on-screen keys

#### Scenario: Correcting a mistake
- **WHEN** the learner removes the last character, whether with the on-screen backspace or the physical one
- **THEN** the typed answer shortens by one character and the next-key highlight follows it back, and the backspace key stops being highlighted as soon as the answer is a correct prefix again

### Requirement: Finger guidance on the keyboard
Key position alone does not tell a learner which finger to press a key with, so the on-screen keyboard SHALL show the touch-typing finger for every key, and SHALL explain what the indication means rather than relying on an unexplained visual code. The finger SHALL be a property of the physical board rather than of the layout printed on it, so every layout on that board guides the same finger to the same position.

#### Scenario: Keys are grouped by finger
- **WHEN** the keyboard is displayed
- **THEN** each key carries the colour of the finger that presses it, so the columns belonging to one finger are distinguishable from its neighbours

#### Scenario: The colours are explained
- **WHEN** the keyboard is displayed
- **THEN** a legend naming each finger accompanies it, so the colour code can be read without being guessed

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

## ADDED Requirements

### Requirement: A layout describes one physical board
A layout SHALL declare the physical board it sits on and one layer for each modifier state it offers. Every layer SHALL cover exactly that board's key positions, so a layer decides what a key types and never how many keys there are, where they sit, or which finger presses them. The number of layers SHALL be the layout's own — two where the language needs Shift alone, three where it also needs a layer reached with AltGr — and the keyboard SHALL render whatever the layout declares rather than assuming a count.

#### Scenario: Every layer is the same board
- **WHEN** the layers of a layout are compared
- **THEN** they hold the same number of rows, the same number of keys in each
  row, and the same finger in every position

#### Scenario: A layout that does not fit its board is refused
- **WHEN** a layout declares a layer that does not cover its board's positions
- **THEN** it is refused where it is defined, rather than rendering as a keyboard
  with a key that has no finger or a position that types nothing

#### Scenario: A modifier does not reshape the keyboard
- **WHEN** the learner activates or releases any modifier
- **THEN** every key stays the size it was and stays where it was, so a finger
  already aiming at a key is still aiming at it

#### Scenario: A layout with a third layer
- **WHEN** a layout declares a layer reached with a modifier other than Shift
- **THEN** the keyboard offers a control for that modifier, switches to that
  layer to show the next expected character, and behaves in every other respect
  as a two-layer layout does

#### Scenario: One modifier at a time
- **WHEN** one modifier is active and the learner activates another
- **THEN** the second replaces the first, so exactly one layer is displayed

### Requirement: A character the layout cannot type is reached on another layout
The learner SHALL be able to type every character of the sentence they are shown, using the on-screen keyboard alone. Where the exercise's own layout has no key for a character, the keyboard SHALL switch to a layout that does and point at the key, rather than the sentence being edited or a key being invented — which is what a typist does, and the only one of the three that leaves both the board and the sentence honest.

Layouts SHALL be available beside the exercise's own the way a second layout is installed on a real machine, and the exercise's own SHALL be preferred for any character both can produce. A character no available layout can produce SHALL be removed as the exercise is presented, because there is no keystroke to ask for; the catalog SHALL NOT be edited.

#### Scenario: The board follows the character
- **WHEN** the next expected character has no key on the exercise's layout but
  has one on a layout available beside it
- **THEN** the keyboard switches to that layout and highlights the key, so the
  learner is shown which symbol to press rather than left with a board that
  cannot produce it

#### Scenario: The sentence is not edited to fit the board
- **WHEN** an ingested sentence contains a character the exercise's layout
  cannot type but another available layout can
- **THEN** it is displayed and asked for exactly as it was ingested

#### Scenario: The learner can see which board is on screen
- **WHEN** more than one layout is available
- **THEN** the keyboard shows which one is displayed and lets the learner switch
  between them, so a board that changed language is never mistaken for a board
  that changed its mind

#### Scenario: The exercise's own layout is preferred
- **WHEN** the next expected character can be typed on both the exercise's
  layout and another available one
- **THEN** the board does not move, because a learner practising Thai should not
  be sent to a Latin board for a bracket Kedmanee also has

#### Scenario: A character on no board at all
- **WHEN** a sentence contains a character no available layout can produce — an
  emoji, a CJK character, a typographic dash
- **THEN** it is removed as the exercise is presented, since no keystroke could
  ever satisfy it, while the stored sentence stays as the corpus wrote it

#### Scenario: Nothing left to practise
- **WHEN** a sentence holds nothing any available layout can type
- **THEN** it is left out of the session rather than presented as an exercise
  that is already complete

#### Scenario: One sentence, displayed and typed
- **WHEN** an exercise is presented
- **THEN** the sentence on screen, the character-count hint, the answer check
  and the keyboard's next-key highlight all describe the same string

### Requirement: One key press produces one character
The keyboard model SHALL assume that pressing one key produces one character of the target sentence. Languages whose writing is composed from several key presses — Hangul jamo forming a syllable, Vietnamese tone composition, Chinese candidate selection — are outside this model, because the next expected character has no single key to point at. No layout SHALL be registered for such a language until the model is extended to describe composition, and the limitation SHALL be stated rather than left to be discovered.

#### Scenario: A layout maps a key press to a character
- **WHEN** any registered layout is inspected
- **THEN** every key on every layer produces exactly one character of the
  language's text, with no key that only contributes to one

#### Scenario: A composing script is not served by a layout
- **WHEN** a language requires several key presses to compose one character
- **THEN** no layout is registered for it, and the reason is recorded, rather
  than a keyboard being shown whose keys cannot produce that language's text
