## MODIFIED Requirements

### Requirement: Session flows without configuration
The MVP SHALL run with no login, no account, and no configuration by the learner.
Practice SHALL draw from a deck: a random sample of the catalog supplied by the
server. The frontend SHALL NOT fetch the whole catalog, so the page costs the same
to load whether the catalog holds a hundred exercises or tens of thousands.

#### Scenario: First visit
- **WHEN** a new visitor opens the application
- **THEN** they reach a playable exercise directly, with no sign-in, setup, or language selection step

#### Scenario: The page does not download the catalog
- **WHEN** the application loads against a catalog larger than one deck
- **THEN** it requests one deck of a fixed size and nothing that returns the whole catalog

#### Scenario: Advancing through exercises
- **WHEN** the learner answers correctly and the completion-stats setting is off
- **THEN** a different exercise from the deck is presented next, automatically

#### Scenario: Advancing through exercises with the post-check summary enabled
- **WHEN** the learner answers correctly and the completion-stats setting is on
- **THEN** a different exercise from the deck is presented once the learner
  continues past the post-check summary

#### Scenario: No exercise repeats while unseen ones remain
- **WHEN** the learner answers correctly and the session has not yet presented every exercise in the current deck
- **THEN** the exercise presented next is one this deck has not shown before

#### Scenario: The catalog is exhausted
- **WHEN** the learner moves past the last exercise of the current deck
- **THEN** a new deck is requested and practice continues from its first exercise, with no blank screen or error in between

#### Scenario: A new deck cannot be fetched
- **WHEN** the learner moves past the last exercise of the deck and the request for a new deck fails
- **THEN** practice continues from the beginning of the deck already held, rather than ending in an error, and the browser console carries the underlying error
