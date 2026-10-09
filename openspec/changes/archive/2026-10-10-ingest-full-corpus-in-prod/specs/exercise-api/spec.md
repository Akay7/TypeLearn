## MODIFIED Requirements

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

## ADDED Requirements

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
