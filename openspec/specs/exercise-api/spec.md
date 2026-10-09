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
  deck(size: Int!): [Exercise!]!
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

### Requirement: A random deck of exercises
The schema SHALL expose a `deck(size: Int!)` query that returns a random sample of the catalog. It exists so a client can practise from a catalog of any size without downloading all of it. The sample SHALL hold no exercise twice. Its order SHALL be random, and so SHALL be its membership whenever the catalog is larger than the sample. `size` SHALL be capped by the server, so the query cannot be used to fetch the whole catalog of a large deployment in one request.

#### Scenario: Requesting a deck
- **WHEN** a client queries `{ deck(size: 50) { id sentence audioUrl } }` against a catalog of more than 50 exercises
- **THEN** exactly 50 distinct exercises are returned with all three fields populated

#### Scenario: Two decks differ
- **WHEN** a client requests two decks of 50 from a catalog of several thousand exercises
- **THEN** the two responses are not the same list in the same order

#### Scenario: The catalog is smaller than the deck
- **WHEN** a client requests a deck larger than the catalog
- **THEN** every exercise in the catalog is returned once, in random order, rather than an error

#### Scenario: The size is capped
- **WHEN** a client requests a deck larger than the server's maximum
- **THEN** at most the maximum number of exercises is returned

#### Scenario: A size below one
- **WHEN** a client requests a deck with a size of zero or less
- **THEN** the response carries a GraphQL error naming the argument, and no exercises

#### Scenario: Empty catalog
- **WHEN** a client requests a deck before ingestion has run
- **THEN** an empty list is returned rather than an error
