## ADDED Requirements

### Requirement: Exercise translation field
The `Exercise` type SHALL expose `translation(language: String!): Translation`,
which returns the translation currently shown for that language under the
phrase-translation selection rule, or null when there is none. `language` is a
lowercase base language subtag (for example `fr`). An unsupported language SHALL
produce null, not an error. Fetching translations for a deck SHALL NOT issue a
query per exercise.

Schema addition:
```graphql
type Translation {
  id: ID!
  language: String!
  text: String!
  origin: TranslationOrigin!   # MACHINE | LEARNER
  upVotes: Int!
  downVotes: Int!
}

enum TranslationOrigin { MACHINE LEARNER }

type Exercise {
  # ...existing fields
  translation(language: String!): Translation
}
```

#### Scenario: Translation with the deck
- **WHEN** a client queries `{ deck(size: 5) { id sentence translation(language: "en") { id text } } }`
- **THEN** each exercise carries its shown English translation, or null

#### Scenario: Unknown language
- **WHEN** a client asks for `translation(language: "xx")`
- **THEN** the field is null and the response has no error

#### Scenario: Bounded queries
- **WHEN** a deck of 200 exercises is fetched with their translations
- **THEN** the number of database queries does not grow with the deck size

### Requirement: Anonymous translation mutations
The schema SHALL expose two mutations. They are the only writes the API
accepts.

```graphql
enum TranslationRatingValue { UP DOWN NONE }

type Mutation {
  rateTranslation(translationId: ID!, clientId: String!, value: TranslationRatingValue!): Translation!
  proposeTranslation(exerciseId: ID!, language: String!, text: String!, clientId: String!): ProposeTranslationResult!
}

type ProposeTranslationResult { accepted: Boolean! }
```

`clientId` is an opaque random identifier that the browser generates and keeps.
It carries no authority beyond deduplicating ratings and scoping rate limits.
`rateTranslation` with `NONE` withdraws the caller's rating, and it applies only
to published translations. `proposeTranslation` stores a pending suggestion.
Invalid input (unknown ids, unsupported language, blank or over-long text,
malformed client id, a duplicate of an existing translation) SHALL return a
GraphQL error with a stable, machine-readable code and store nothing.

#### Scenario: Rating is idempotent per client
- **WHEN** the same `clientId` sends `rateTranslation(..., value: UP)` twice
- **THEN** the translation's `upVotes` increased by one in total, not two

#### Scenario: Rating an unpublished translation
- **WHEN** a client rates a pending or rejected translation
- **THEN** the response is an error and no rating is stored

#### Scenario: Proposal stored as pending
- **WHEN** a client proposes a valid new translation
- **THEN** `accepted` is true and a pending learner translation exists, which
  the `translation` field does not return

#### Scenario: Over-long proposal
- **WHEN** a client proposes text longer than the configured maximum
- **THEN** the response is an error with a length code and nothing is stored

### Requirement: Write rate limits
Each mutation SHALL be rate-limited per client id and per client address, with
limits set in configuration. A request over a limit SHALL be refused with a
rate-limit error code and SHALL store nothing.

#### Scenario: Exceeding the proposal limit
- **WHEN** one client address sends more proposals within the window than the
  configured limit
- **THEN** the proposals over the limit are refused with the rate-limit code

### Requirement: Writes carry no ambient credentials
The GraphQL endpoint SHALL NOT authenticate anonymous mutations by cookie or
session. The only identity a mutation carries is the `clientId` in its
arguments. The endpoint MAY therefore remain exempt from Django's CSRF check,
since a forged cross-site request can do nothing that the attacker could not
already do directly. A mutation that relies on a session or cookie SHALL NOT be
added under this exemption.

#### Scenario: Cross-site form post
- **WHEN** another site submits a form-encoded POST to `/graphql/`
- **THEN** it gains no privilege a direct anonymous request would not have, and
  a non-JSON body is not executed as a mutation
