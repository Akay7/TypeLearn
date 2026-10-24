## Why

An audit of `exercises/schema.py` against the project's Strawberry-Django
conventions found one real defect and a handful of places where the code
works but has to be kept in agreement with something else by hand.

The defect: `audioUrl` is a plain `@strawberry.field`, so the optimizer does
not know it reads `original_audio` and leaves the column out of its `.only()`.
Django then fetches the deferred column once per row. The frontend's `Deck`
query selects `audioUrl` for every exercise in a 200-exercise deck, so one page
load costs about 201 queries where it should cost one.

The rest are duplications that can drift:

- `TranslationOrigin` is a hand-written copy of `Translation.Origin`, converted
  by a resolver. A new origin added to the model would be missing from the API
  until someone noticed.
- A translation's maximum length lives in two places: the column's
  `max_length=500` and the `TRANSLATION_MAX_LENGTH` setting, which only works
  while the two agree. Raising the setting turns a coded `TOO_LONG` refusal
  into a database error. The proposal mutation also re-implements the blank
  and duplicate checks that the model already declares.
- `deck` refuses a size below one with a bare `GraphQLError`, the only refusal
  in the schema without the stable code the frontend maps to a message.

The GraphQL tests also stray from the conventions: documents are written
inline or mid-file, setup calls discard their responses, and error assertions
read `errors[0]` without first asserting how many errors there are.

## What Changes

- `audioUrl` declares the column it reads, so listing exercises costs one
  query however many rows come back.
- `TranslationOrigin` is generated from `Translation.Origin`. The published
  enum is unchanged: `MACHINE`, `LEARNER`.
- `proposeTranslation` validates the new row with the model's own
  `full_clean()` and maps Django's validation codes onto the API's existing
  `BLANK`, `TOO_LONG` and `DUPLICATE` codes. The codes clients see do not
  change.
- The `TRANSLATION_MAX_LENGTH` setting is removed. The `text` column's
  `max_length` is the only maximum, and the machine-translation provider and
  `load_translations` read it from the model. No chart, environment file, or
  document sets the variable, so no deployment is affected.
- `deck(size:)` below one is refused with the code `INVALID_SIZE`.
- **BREAKING** `exercises(limit: Int)` becomes Strawberry-Django's standard
  `exercises(pagination: { offset, limit })`. The hand-written field class and
  resolver that existed only to apply `limit` after `filters` and `ordering`
  are deleted, because the library already applies pagination in that order.
  Clients gain `offset`, and a page is capped at 100 exercises by default,
  configurable through `STRAWBERRY_PAGINATION_MAX_LIMIT`. Leaving `pagination`
  out still returns the whole (filtered) list. No client sends `limit`: the
  frontend's only `exercises` query passes `filters` alone, so the rename
  breaks nothing that ships.
- **BREAKING** The two mutations take Strawberry-Django model inputs through
  a `data` argument, nested under a `translation` namespace:
  `translation { rateTranslation(data: TranslationRatingInput!) }` and
  `translation { proposeTranslation(data: TranslationCreateInput!) }`. Related
  rows are named with the standard relation input (`exercise: { set: ID }`,
  `translation: { set: ID }`), and the input is applied to the row by one
  shared applier rather than copied field by field.
- **BREAKING** `proposeTranslation` returns the stored `Translation` instead
  of `ProposeTranslationResult { accepted }`.
- Rating a pending or rejected translation is refused exactly like an id no
  translation has (`NOT_FOUND`, the same message), instead of `NOT_PUBLISHED`,
  so the response no longer reveals that a hidden suggestion exists. The
  frontend shows its generic message for both codes, so learners see no
  change.
- **BREAKING** `Exercise.audioUrl` becomes `Exercise.originalAudio { url }`:
  the model's file field is exposed by its own name instead of through a
  computed string. Every file field in the project is published as one `File`
  type, with only an absolute `url`, by overriding Strawberry-Django's type
  for `FileField` and `ImageField` once. Its default `DjangoFileType` would
  also publish the file's path on the server, and read each file's size from
  disk for every row.
- The GraphQL test modules are restructured to the test conventions: document
  constants at the top, every response inspected, error counts asserted.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `exercise-api`: a deck size below one is refused with a stable error code,
  listing exercises costs a bounded number of database queries, the
  catalog is paged with `pagination: { offset, limit }` instead of `limit`,
  and a clip is published as `originalAudio { url }` instead of `audioUrl`
  (the requirement "audioUrl is directly playable" is renamed "The clip URL
  is directly playable").
- `typing-practice`: the audio playback scenarios name `originalAudio.url`.

The mutations are specified by the still-open `add-phrase-translations`
change ("Anonymous translation mutations"), which is not in `openspec/specs/`
yet, so they cannot be modified from here. That change's own delta is amended
instead: the over-long scenario's "configured maximum", the mutations' schema
block, the unpublished-rating scenario, and the proposal's return value.

## Impact

- `src/backend/exercises/schema.py`: the `audio_url` hint, the generated
  enum, model validation in `propose_translation`, and the `deck` error code.
- `src/backend/typelearn/settings.py`: `TRANSLATION_MAX_LENGTH` removed;
  `STRAWBERRY_DJANGO['PAGINATION_MAX_LIMIT']` declared from
  `STRAWBERRY_PAGINATION_MAX_LIMIT`.
- `src/backend/exercises/schema.py`: `LimitedField` and the `exercises`
  resolver removed in favour of `strawberry_django.field(pagination=True)`.
- `docs/deployment.md`: the page cap, next to the deck cap.
- `src/backend/exercises/translation/providers.py`,
  `src/backend/exercises/management/commands/load_translations.py`: read the
  maximum from the model.
- `src/backend/exercises/tests/`: `test_schema.py` and
  `test_translation_schema.py` restructured, new tests for each fix, and the
  two tests that lowered `TRANSLATION_MAX_LENGTH` rewritten.
- `src/backend/typelearn/graphql.py` (new): the shared input applier, and the
  project-wide `File` type for file fields.
- `openspec/changes/add-phrase-translations/specs/exercise-api/spec.md`:
  the amendments listed above.
- Published schema: `exercises` takes `pagination: OffsetPaginationInput`
  instead of `limit: Int`; the mutations change shape as above.
- Frontend: `src/frontend/src/stores/exercise.js` asks for
  `originalAudio { url }` and `SentenceView.vue` plays it;
  `src/frontend/src/stores/translation.js` sends the new mutation
  documents. Its unit tests (`stores/__tests__/translation.test.js`,
  `components/__tests__/TranslationPanel.test.js`) and the e2e stub
  (`e2e/fixtures.js`, `e2e/translation.spec.js`) follow. Frontend and backend
  images roll out separately, so a tab still running the old bundle gets an
  error on rate and propose until it reloads.
