## ADDED Requirements

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
