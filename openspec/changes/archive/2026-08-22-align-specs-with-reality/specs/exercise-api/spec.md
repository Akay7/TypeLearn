## ADDED Requirements

### Requirement: GraphQL endpoint
The backend SHALL expose a GraphQL endpoint at `/graphql/` backed by Strawberry, with introspection available in development.

#### Scenario: Endpoint responds
- **WHEN** a client POSTs a valid GraphQL query to `/graphql/`
- **THEN** the response is HTTP 200 with a JSON body containing a `data` key

#### Scenario: Introspection in development
- **WHEN** an introspection query is issued in development
- **THEN** the schema is returned, allowing a client to discover the available fields

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

### Requirement: audioUrl is directly playable
`audioUrl` SHALL be a URL an HTML5 `<audio>` element can load without further transformation by the client.

#### Scenario: Playing a returned clip
- **WHEN** the frontend sets an `<audio>` element's `src` to the `audioUrl` from a query result
- **THEN** the clip loads and plays

### Requirement: Cross-origin requests from the dev frontend are allowed
The Vite dev server runs on a different origin than Django. The backend SHALL permit cross-origin GraphQL requests from the development frontend origin.

#### Scenario: Browser request from the dev server
- **WHEN** the frontend running on the Vite dev origin issues a GraphQL request
- **THEN** the browser receives the required CORS headers and the request succeeds
