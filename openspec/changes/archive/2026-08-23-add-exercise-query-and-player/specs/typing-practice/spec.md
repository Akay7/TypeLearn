## ADDED Requirements

### Requirement: Loading and failure states
The frontend SHALL tell the learner what is happening while an exercise is being fetched, and SHALL show a readable message instead of a blank screen when the exercise cannot be obtained.

#### Scenario: While fetching
- **WHEN** the application has issued the exercise query and no response has arrived
- **THEN** a loading indication is rendered in place of the sentence

#### Scenario: Backend unreachable
- **WHEN** the exercise query fails — the backend is down, the request is blocked by CORS, or the response carries GraphQL errors
- **THEN** a plain error message is rendered explaining that the exercise could not be loaded, and the browser console carries the underlying error

#### Scenario: Empty catalog
- **WHEN** the query succeeds but returns no exercises
- **THEN** a message stating that no exercises are available is rendered, rather than an empty sentence area or a crash
