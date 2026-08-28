# exercise-api Specification

## Purpose
TBD - created by archiving change align-specs-with-reality. Update Purpose after archive.
## Requirements
### Requirement: GraphQL endpoint
The backend SHALL expose a GraphQL endpoint at `/graphql/` backed by Strawberry, with introspection available in development.

#### Scenario: Endpoint responds
- **WHEN** a client POSTs a valid GraphQL query to `/graphql/`
- **THEN** the response is HTTP 200 with a JSON body containing a `data` key

#### Scenario: Introspection in development
- **WHEN** an introspection query is issued in development
- **THEN** the schema is returned, allowing a client to discover the available fields

### Requirement: GraphiQL is available in development
The `/graphql/` endpoint SHALL serve the GraphiQL explorer when `DEBUG` is on, so the schema can be exercised by hand without a frontend.

#### Scenario: Opening the endpoint in a browser
- **WHEN** a developer opens `/graphql/` in a browser with `DEBUG` on
- **THEN** the GraphiQL interface loads and can run `{ exercises(limit: 1) { sentence audioUrl } }` against the live database

### Requirement: Schema field names are camelCase
Strawberry converts Python `snake_case` field names to `camelCase` in the GraphQL schema by default. The published contract SHALL be written in the casing the schema actually emits, so documented queries execute as written.

Schema:
```graphql
type Exercise {
  id: ID!
  sentence: String!
  sentenceId: String
  audioUrl: String!
  upVotes: Int!
  difficulty: Int!
}

type Query {
  exercises(limit: Int): [Exercise!]!
  exercise(id: ID!): Exercise
}
```

#### Scenario: Documented query executes
- **WHEN** a client sends `{ exercises { id sentence audioUrl difficulty } }`
- **THEN** the query validates and returns data, with no "Cannot query field" error

#### Scenario: snake_case field names are not part of the contract
- **WHEN** a client sends `{ exercises { sentence up_votes } }`
- **THEN** the query fails validation, because the schema exposes `upVotes`

### Requirement: Exercises query returns the MVP catalog
The `exercises` query SHALL return the ingested exercises from the database, optionally limited by the `limit` argument.

#### Scenario: Returning the full catalog
- **WHEN** a client queries `exercises` with no arguments against a database holding the 100 MVP exercises
- **THEN** 100 items are returned

#### Scenario: Limiting results
- **WHEN** a client queries `{ exercises(limit: 1) { id sentence audioUrl } }`
- **THEN** exactly one exercise is returned with all three fields populated

#### Scenario: Empty catalog
- **WHEN** a client queries `exercises` before ingestion has run
- **THEN** an empty list is returned rather than an error

### Requirement: Single exercise lookup
The schema SHALL expose an `exercise(id: ID!)` query returning the matching exercise, or null when no exercise has that id.

#### Scenario: Existing id
- **WHEN** a client queries `exercise` with the id of an ingested exercise
- **THEN** that exercise is returned with its `sentence` and `audioUrl` populated

#### Scenario: Unknown id
- **WHEN** a client queries `exercise` with an id no row has
- **THEN** the response contains `null` for the field rather than an error

### Requirement: audioUrl is directly playable
`audioUrl` SHALL be an absolute URL — scheme, host, port, and media path — that an HTML5 `<audio>` element can load without further transformation by the client. It is built from the incoming request, so it names whatever origin the client reached the API through, and no deployment has to configure a media host separately.

#### Scenario: Playing a clip
- **WHEN** the frontend sets an `<audio>` element's `src` to an exercise's `audioUrl`
- **THEN** the clip loads and plays, with no path rewriting in the client

#### Scenario: Absolute URL in the response
- **WHEN** a client queries `{ exercises(limit: 1) { audioUrl } }`
- **THEN** the returned value begins with `http://` or `https://` and includes the host, not a bare `/media/...` path

#### Scenario: The URL names the origin the client used
- **WHEN** the API is reached through the Gateway
- **THEN** `audioUrl` carries that same origin, so the clip is fetched from where the rest of the application is served
