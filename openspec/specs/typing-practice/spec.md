# typing-practice Specification

## Purpose
The learner-facing practice loop: how an exercise is presented, how its audio is
heard, how the answer is typed on screen or on a physical keyboard, and how it is
checked. Thai is the first language it serves, so the requirements that are
genuinely script-specific — the Kedmanee layout, the looped typeface — live here
too.

## Requirements
### Requirement: Exercise presentation
The frontend SHALL display one exercise at a time in a single centered column: the target sentence in large text, and a length hint below it.

#### Scenario: Loading the first exercise
- **WHEN** the learner opens the application
- **THEN** an exercise is fetched from the API and its sentence is rendered in large text, with no console error

#### Scenario: Length hint
- **WHEN** an exercise is displayed
- **THEN** a hint showing the expected character count is rendered beneath the sentence

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

### Requirement: Loading and failure states
The frontend SHALL tell the learner what is happening while an exercise is being fetched, and SHALL show a readable message instead of a blank screen when the exercise cannot be obtained.

#### Scenario: While fetching
- **WHEN** the application has issued the exercise query and no response has arrived
- **THEN** a loading indication is rendered in place of the sentence

#### Scenario: Backend unreachable
- **WHEN** the exercise query fails — the backend is down, the request errors, or the response carries GraphQL errors
- **THEN** a plain error message is rendered explaining that the exercise could not be loaded, and the browser console carries the underlying error

#### Scenario: Empty catalog
- **WHEN** the query succeeds but returns no exercises
- **THEN** a message stating that no exercises are available is rendered, rather than an empty sentence area or a crash

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

### Requirement: Virtual keyboard suppressed on phone-classified devices
The frontend SHALL classify the device as a phone when it has a small screen
and is primarily touch-operated (no hover-capable pointer such as a mouse or
trackpad), and SHALL keep the OS virtual keyboard from appearing when the
answer field is focused on such a device, unless the learner has overridden
this. A phone has no physical keyboard, and the app's own on-screen Kedmanee
keyboard already covers typing, so a second, OS-drawn keyboard only competes
for the same screen space.

#### Scenario: Focusing the field on a phone
- **WHEN** the learner taps or otherwise focuses the answer field on a
  phone-classified device, and no override is set
- **THEN** the OS virtual keyboard does not appear, and the on-screen keyboard
  remains the way to type

#### Scenario: A physical keyboard still works on a phone-classified device
- **WHEN** the learner types on a physical keyboard while the answer field is
  focused on a phone-classified device
- **THEN** the typed characters reach the field exactly as they do on any
  other device, because suppressing the virtual keyboard does not block
  physical key input

### Requirement: Virtual keyboard available by default on tablets and larger devices
The frontend SHALL leave the OS virtual keyboard free to appear when the
answer field is focused on any device not classified as a phone, unless the
learner has overridden this. Whether such a device has a physical keyboard
attached cannot be reliably determined from the browser, and many of these
devices are typed on without one, so the default SHALL favor not removing a
learner's only way to type.

#### Scenario: Focusing the field on a tablet
- **WHEN** the learner taps or otherwise focuses the answer field on a device
  not classified as a phone, and no override is set
- **THEN** the OS virtual keyboard is free to appear as it would on any other
  input field

### Requirement: Learner can override virtual keyboard visibility
The frontend SHALL provide a setting the learner can use to force the OS
virtual keyboard on or off for the answer field, overriding the device-based
default in either direction, and SHALL persist that choice across visits.
Device classification is a heuristic and can be wrong in both directions — a
tablet with a physical keyboard attached, or a phone-sized device the
heuristic misreads — so the learner needs a way to correct it.

#### Scenario: Forcing the virtual keyboard off
- **WHEN** the learner turns the setting to "off" and then focuses the answer
  field, regardless of device classification
- **THEN** the OS virtual keyboard does not appear

#### Scenario: Forcing the virtual keyboard on
- **WHEN** the learner turns the setting to "on" and then focuses the answer
  field, regardless of device classification
- **THEN** the OS virtual keyboard is free to appear

#### Scenario: The override persists
- **WHEN** the learner sets the override and later reloads the application or
  returns in a new visit, on the same device and browser
- **THEN** the same override is still in effect, without the learner setting
  it again

#### Scenario: No override set
- **WHEN** the learner has never changed the setting
- **THEN** the device-classified default governs whether the virtual keyboard
  appears, and the setting shows that this is the current, unforced state

### Requirement: The on-screen keyboard fits any viewport without shrinking below a tappable size
The on-screen keyboard's keys SHALL NOT be sized smaller than they are today
to fit a narrow viewport; where the layout's rows are wider than the
viewport, the frontend SHALL let the learner scroll the keyboard sideways to
reach the rest of it instead. A key shrunk to fit a phone stops being a
target a thumb can reliably hit, and stops being the size the finger-position
promise this keyboard makes is about.

#### Scenario: The page does not grow wider than the viewport
- **WHEN** the exercise is displayed on a viewport narrower than the
  keyboard's full width
- **THEN** the page itself does not scroll or grow wider than the viewport —
  only the keyboard's own rows do

#### Scenario: Every key stays reachable
- **WHEN** the keyboard is wider than the viewport showing it
- **THEN** every key the current layout can type, including ones initially
  off-screen, can still be reached and pressed by scrolling the keyboard

### Requirement: Learner can hide the on-screen keyboard
The frontend SHALL provide a setting, independent of the virtual keyboard
setting, that lets the learner hide the on-screen keyboard entirely, and
SHALL persist that choice across visits. A learner typing on a physical
keyboard they already know needs no help finding the keys, and the board is
a lot of screen to keep spending on a hint they are not using.

#### Scenario: Hiding the on-screen keyboard
- **WHEN** the learner turns the on-screen keyboard setting to "hide"
- **THEN** the on-screen keyboard is no longer displayed

#### Scenario: Typing still works while it is hidden
- **WHEN** the on-screen keyboard is hidden
- **THEN** the learner can still type into the answer field, whether from a
  physical keyboard or, where enabled, the OS virtual keyboard, and checking
  the answer works exactly as it does with the board shown

#### Scenario: Showing it again
- **WHEN** the learner turns the on-screen keyboard setting back to "show"
- **THEN** the on-screen keyboard is displayed again, following the current
  exercise's layout and next-key highlight as usual

#### Scenario: The choice persists
- **WHEN** the learner sets this independently of the virtual keyboard
  setting and later reloads the application or returns in a new visit
- **THEN** the on-screen keyboard's shown/hidden state is unchanged, and the
  virtual keyboard setting is unaffected by it
