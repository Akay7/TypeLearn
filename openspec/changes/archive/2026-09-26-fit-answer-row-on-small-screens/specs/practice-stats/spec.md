## ADDED Requirements

### Requirement: The summary fits the answer row on a phone-width screen
On a viewport 360 CSS pixels wide or wider, and in every supported interface
language, the post-check summary SHALL fit entirely within the space the
answer field and its verdict row occupied: none of its totals SHALL extend
past that space's edges, onto the on-screen keyboard below it, or past the
edge of the screen. The control to continue SHALL occupy exactly the
position and size the check control had, so the learner finds it where
their attention already is.

#### Scenario: The totals fit on a phone
- **WHEN** the summary is displayed on a 360px-wide viewport, in any
  supported interface language
- **THEN** every total and its label is within the space the answer field
  and verdict row occupied, and nothing of the summary overlaps the
  on-screen keyboard

#### Scenario: Continue takes the check control's place
- **WHEN** the summary replaces the answer field, at any viewport width
- **THEN** the control to continue has exactly the position and size the
  check control had before the check
