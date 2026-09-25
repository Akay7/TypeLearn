## ADDED Requirements

### Requirement: The answer row fits a phone-width screen
On a viewport 360 CSS pixels wide or wider, the answer field and the check
control SHALL share their row without either crowding the other out: the
check control SHALL shrink to a compact control, and the answer field SHALL
keep most of the row's width. A compact control SHALL keep the same
accessible name as its full-size form. On every width, and in every
supported interface language, a control's label SHALL fit within the
control rather than running past its edge.

#### Scenario: The field keeps most of the row on a phone
- **WHEN** an exercise is displayed on a 360px-wide viewport
- **THEN** the check control is at most 56px wide, and the answer field is
  more than twice as wide as it

#### Scenario: The compact control keeps its name
- **WHEN** the check control is shown in its compact form
- **THEN** assistive technology announces it with the same name as the
  full-size control ("Check" in English)

#### Scenario: A long translation fits its control
- **WHEN** the interface language gives a control a label longer than the
  English one
- **THEN** the label stays within the control's bounds rather than
  overflowing it
