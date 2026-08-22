## MODIFIED Requirements

### Requirement: audioUrl is directly playable
`audioUrl` SHALL be an absolute URL — scheme, host, port, and media path — that an HTML5 `<audio>` element can load without further transformation by the client. A site-relative path is not sufficient: in development the frontend is served from the Vite origin while the clips are served by Django on another origin, so a relative path would resolve against the wrong host.

#### Scenario: Playing a returned clip
- **WHEN** the frontend sets an `<audio>` element's `src` to the `audioUrl` from a query result
- **THEN** the clip loads and plays

#### Scenario: Absolute URL in the response
- **WHEN** a client queries `{ exercises(limit: 1) { audioUrl } }`
- **THEN** the returned value begins with `http://` or `https://` and includes the backend host, not a bare `/media/...` path

#### Scenario: Fetched from a different origin
- **WHEN** the frontend running on the Vite dev origin plays a clip using the returned `audioUrl`
- **THEN** the request reaches the Django media route and returns the audio file

## ADDED Requirements

### Requirement: Single exercise lookup
The schema SHALL expose an `exercise(id: ID!)` query returning the matching exercise, or null when no exercise has that id.

#### Scenario: Existing id
- **WHEN** a client queries `exercise` with the id of an ingested exercise
- **THEN** that exercise is returned with its `sentence` and `audioUrl` populated

#### Scenario: Unknown id
- **WHEN** a client queries `exercise` with an id no row has
- **THEN** the response contains `null` for the field rather than an error

### Requirement: GraphiQL is available in development
The `/graphql/` endpoint SHALL serve the GraphiQL explorer when `DEBUG` is on, so the schema can be exercised by hand without a frontend.

#### Scenario: Opening the endpoint in a browser
- **WHEN** a developer opens `/graphql/` in a browser with `DEBUG` on
- **THEN** the GraphiQL interface loads and can run `{ exercises(limit: 1) { sentence audioUrl } }` against the live database
