## RENAMED Requirements

- FROM: `### Requirement: audioUrl is directly playable`
- TO: `### Requirement: The clip URL is directly playable`

## MODIFIED Requirements

### Requirement: Single exercise lookup
The schema SHALL expose an `exercise(id: ID!)` query returning the matching exercise, or null when no exercise has that id.

#### Scenario: Existing id
- **WHEN** a client queries `exercise` with the id of an ingested exercise
- **THEN** that exercise is returned with its `sentence` and `originalAudio.url` populated

#### Scenario: Unknown id
- **WHEN** a client queries `exercise` with an id no row has
- **THEN** the response contains `null` for the field rather than an error

### Requirement: GraphiQL is available in development
The `/graphql/` endpoint SHALL serve the GraphiQL explorer when `DEBUG` is on, so the schema can be exercised by hand without a frontend.

#### Scenario: Opening the endpoint in a browser
- **WHEN** a developer opens `/graphql/` in a browser with `DEBUG` on
- **THEN** the GraphiQL interface loads and can run `{ exercises(pagination: {limit: 1}) { sentence originalAudio { url } } }` against the live database

### Requirement: Schema field names are camelCase
Strawberry converts Python `snake_case` field names to `camelCase` in the GraphQL schema by default. The published contract SHALL be written in the casing the schema actually emits, so documented queries execute as written.

Schema:
```graphql
type File {
  url: String!
}

type Exercise {
  id: ID!
  sentence: String!
  sentenceId: String
  upVotes: Int!
  difficulty: Int!
  originalAudio: File!
}

input OffsetPaginationInput {
  offset: Int! = 0
  limit: Int
}

type Query {
  exercises(filters: ExerciseFilter, ordering: [ExerciseOrder!]! = [], pagination: OffsetPaginationInput): [Exercise!]!
  exercise(id: ID!): Exercise
  deck(size: Int!): [Exercise!]!
}
```

#### Scenario: Documented query executes
- **WHEN** a client sends `{ exercises { id sentence originalAudio { url } difficulty } }`
- **THEN** the query validates and returns data, with no "Cannot query field" error

#### Scenario: snake_case field names are not part of the contract
- **WHEN** a client sends `{ exercises { sentence up_votes } }`
- **THEN** the query fails validation, because the schema exposes `upVotes`

### Requirement: Exercises query returns the MVP catalog
The `exercises` query SHALL return the ingested exercises from the database. A client MAY page through them with `pagination: { offset, limit }`, which is applied after any `filters` and `ordering`. Without `pagination` the whole filtered list is returned. A page SHALL hold at most the server's maximum page size, however large a `limit` the client asks for.

#### Scenario: Returning the full catalog
- **WHEN** a client queries `exercises` with no arguments against a database holding the 100 MVP exercises
- **THEN** 100 items are returned

#### Scenario: Limiting results
- **WHEN** a client queries `{ exercises(pagination: {limit: 1}) { id sentence originalAudio { url } } }`
- **THEN** exactly one exercise is returned with all three fields populated

#### Scenario: Paging with an offset
- **WHEN** a client queries `exercises(pagination: {offset: 1, limit: 1})`
- **THEN** the second exercise of the unpaged list is returned, alone

#### Scenario: Paging after filtering and ordering
- **WHEN** a client passes `filters`, `ordering` and `pagination` together
- **THEN** the page is cut from the filtered, ordered list, and no error is returned

#### Scenario: The page size is capped
- **WHEN** a client asks for a `limit` larger than the server's maximum page size
- **THEN** at most the maximum number of exercises is returned

#### Scenario: Empty catalog
- **WHEN** a client queries `exercises` before ingestion has run
- **THEN** an empty list is returned rather than an error

### Requirement: The clip URL is directly playable
An exercise's clip SHALL be published as `originalAudio { url }`, and `url` SHALL be an absolute URL — scheme, host, port, and media path — that an HTML5 `<audio>` element can load without further transformation by the client. It is built from the incoming request, so it names whatever origin the client reached the API through, and no deployment has to configure a media host separately.

#### Scenario: Playing a clip
- **WHEN** the frontend sets an `<audio>` element's `src` to an exercise's `originalAudio.url`
- **THEN** the clip loads and plays, with no path rewriting in the client

#### Scenario: Absolute URL in the response
- **WHEN** a client queries `{ exercises(pagination: {limit: 1}) { originalAudio { url } } }`
- **THEN** the returned value begins with `http://` or `https://` and includes the host, not a bare `/media/...` path

#### Scenario: The URL names the origin the client used
- **WHEN** the API is reached through the Gateway
- **THEN** `originalAudio.url` carries that same origin, so the clip is fetched from where the rest of the application is served

#### Scenario: Only the URL is published
- **WHEN** a client asks an exercise's `originalAudio` for anything but `url`, such as its path on the server or its size
- **THEN** the query fails validation, because a stored file is published by its `url` alone

### Requirement: A random deck of exercises
The schema SHALL expose a `deck(size: Int!)` query that returns a random sample of the catalog. It exists so a client can practise from a catalog of any size without downloading all of it. The sample SHALL hold no exercise twice. Its order SHALL be random, and so SHALL be its membership whenever the catalog is larger than the sample. `size` SHALL be capped by the server, so the query cannot be used to fetch the whole catalog of a large deployment in one request.

#### Scenario: Requesting a deck
- **WHEN** a client queries `{ deck(size: 50) { id sentence originalAudio { url } } }` against a catalog of more than 50 exercises
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
- **THEN** the response carries exactly one GraphQL error, with the stable code `INVALID_SIZE` and a message naming the argument, and no exercises

#### Scenario: Empty catalog
- **WHEN** a client requests a deck before ingestion has run
- **THEN** an empty list is returned rather than an error

## ADDED Requirements

### Requirement: Listing exercises costs a bounded number of queries
Fetching a list of exercises through `exercises` or `deck` SHALL cost a number of database queries that does not grow with the number of exercises returned, for every field of `Exercise` that takes no argument, `originalAudio { url }` included.

#### Scenario: A deck with its audio
- **WHEN** a client queries `{ deck(size: 20) { id sentence originalAudio { url } difficulty } }` against a catalog of more than 20 exercises
- **THEN** the response is produced with a single database query

#### Scenario: The catalog with its audio
- **WHEN** a client queries `{ exercises { id originalAudio { url } } }`
- **THEN** the response is produced with a single database query, however many exercises the catalog holds
