## Context

See proposal.md - Why. The whole GraphQL layer is `exercises/schema.py`. The
schema has no authentication, and its only writes are the two anonymous
translation mutations. They refuse bad input with a `GraphQLError` carrying a
stable `extensions.code`, which the frontend maps to a message in the learner's
language (`KNOWN_ERRORS` in `src/frontend/src/stores/translation.js`; any other
code gets a generic message). `MUTATIONS_DEFAULT_HANDLE_ERRORS` is not set, so
Strawberry-Django's `OperationInfo` unions are not in use.

Measured against a real database, `{ deck(size: 5) { id audioUrl } }` runs six
queries: one for the deck, then one per row for the deferred `original_audio`
column.

## Goals / Non-Goals

**Goals:**
- Every refusal the API makes carries a code.
- Each fact the schema depends on (the origins, the maximum text length, what
  makes a proposal invalid) is declared once, on the model.
- The schema follows the Strawberry-Django conventions literally where they
  apply: standard pagination, model inputs through `data`, a mutation
  namespace, and a create that returns its model's type. The two breaking
  changes this causes are made together with the frontend.

**Non-Goals:**
- Adopting `OperationInfo` / `handle_django_errors`. It would change every
  mutation's return type into a union and break the frontend's error handling,
  for no behavioural gain. The conventions themselves say to follow the repo's
  existing error pattern when that setting is not adopted, and here that
  pattern is the coded `GraphQLError`.
- The frontend's own `MAX_TRANSLATION_LENGTH = 500`, a client-side pre-check
  mirroring the column. It is a separate codebase's copy, and the server
  refuses anything it lets through.

## Decisions

**`audioUrl` declares its column with an `only=` hint.** The resolver becomes
`@strawberry_django.field(only=['original_audio'])`. The optimizer then
selects the column in the list query instead of deferring it.
Alternative considered: disabling the optimizer's `only` optimisation for the
type. Rejected, because it would widen every query to stop one field's N+1.
(Superseded below: the field is replaced by `original_audio: auto`, which the
optimizer selects on its own because it names the column.)

**File fields are published by one project-wide `File` type.**
`typelearn.graphql` declares `File { url }` and registers it in
Strawberry-Django's `field_type_map` for `FileField` and `ImageField`. The
map is looked up by exact field class, so each class needs its own entry.
`Exercise.original_audio` is then a plain `auto` field, exposed by the
model's own name. `url` is absolute, built from the request, as the clip URL
requirement asks.
The map is read when a type is defined, so the override must run before any
`strawberry_django.type` is declared. It runs when `typelearn.graphql` is
imported, and `exercises/schema.py` imports that module before defining its
types.
Alternatives considered:
- Keeping `audioUrl` as a computed string. It worked, but it is a related
  value flattened into a scalar.
- A one-off `AudioFile` type annotated on the one field. That is the same
  shape, but each future file field would have to remember it, and forgetting
  would silently publish `DjangoFileType`'s `path`, the file's location on the
  server, and its `size`, read from disk per row (`ImageField` adds width and
  height, read by opening the image). The project-wide override makes the safe
  type the default.

**`TranslationOrigin` is `strawberry.enum(models.Translation.Origin,
name='TranslationOrigin')`, and `origin` becomes a plain annotated field.**
Strawberry publishes a `TextChoices` class by member name and serialises the
raw column value (`'machine'`) to `MACHINE`. That was checked on a scratch
schema before choosing this. Alternative considered: annotating `origin` as
`auto` with `GENERATE_ENUMS_FROM_CHOICES`. Rejected, because the generated
enum is named after the app and model, which would rename the published type.

**`proposeTranslation` validates with `full_clean()` and translates Django's
error codes.** The mutation builds the unsaved `Translation` and calls
`full_clean()`. Each resulting error is mapped onto the API's existing
refusals:

| Django | field | API code |
| --- | --- | --- |
| `blank` | `text` | `BLANK` |
| `max_length` | `text` | `TOO_LONG` |
| `unique_together` | `__all__` (`unique_translation_text`) | `DUPLICATE` |
| anything else | — | `INVALID` |

The API's English messages stay as they are, so the visible behaviour does
not change. `INVALID` should never be reached, because every other field is
filled in by the server. It exists so that an unforeseen validation failure
still has a code rather than becoming an uncoded error. Validation runs where
the blank and length checks ran before, ahead of the rate limit. This moves
the duplicate check ahead of the rate limit too, which costs one indexed query
on a request that would otherwise be refused.
Alternative considered: keeping the hand-written checks and only reading the
length from the model. Rejected, because it leaves the duplicate check as a
second copy of `unique_translation_text`.

The `IntegrityError` fallback and its savepoint stay. `full_clean()` checks
uniqueness before the insert, so a concurrent identical suggestion can still
win the race. The savepoint is there so that catching the error leaves any
surrounding transaction usable, not for atomicity.

**The column is the maximum.** `Translation.TEXT_MAX_LENGTH = 500` is
declared on the model, and `text` is declared with `max_length` set to it, so
no migration results. The provider's `validated()` and `load_translations`
read the constant. The `TRANSLATION_MAX_LENGTH` setting is deleted. Tests that
need a small limit patch the constant, which both readers look up at call
time.

**`exercises` uses the library's own pagination, on a plain list.** It
becomes `strawberry_django.field(pagination=True)` with no resolver. The
library then publishes `filters`, `ordering` and `pagination` itself, and
applies them in that order. Applying them in that order is the only reason
`LimitedField` and the resolver existed, so both are deleted. Without the
argument nothing is sliced, so the frontend's `Translations` query (200 ids,
no pagination) is unaffected. With it, the library defaults `limit` to
`PAGINATION_DEFAULT_LIMIT` and caps it at `PAGINATION_MAX_LIMIT`, both 100.
The cap is declared in `settings.py` as
`STRAWBERRY_DJANGO['PAGINATION_MAX_LIMIT']`, read from
`STRAWBERRY_PAGINATION_MAX_LIMIT` like the other query limits, so it is a
visible, configurable part of the contract rather than a dependency's
default.
Alternatives considered: `offset_paginated`, which returns
`{ results totalCount pageInfo }`. Rejected, because it changes the response
shape the frontend reads and nothing needs a total count. Keeping `limit` as an
alias was also rejected: no client sends it, and two ways to page is the
duplication this change removes.

**Mutations take model inputs through `data`, under a `translation`
namespace.** The two inputs are declared with `@strawberry_django.input`:

- `TranslationCreateInput`, over `Translation`, with `exercise`, `language`,
  `text` and `client_id` as `auto`. The foreign key becomes the standard
  `OneToManyInput { set: ID }`. `clientId` is published nullable because the
  column is `blank=True` (machine rows have none). The mutation's UUID check
  refuses a missing value as `INVALID_CLIENT_ID`, as it refuses a malformed
  one.
- `TranslationRatingInput`, over `TranslationRating`, with `translation` and
  `client_id` as `auto`. `value` is annotated `TranslationRatingValue`,
  because `NONE` (withdraw) is part of the deployed wire format and is no
  value a stored rating holds, and `auto` would publish a bare `Int`.

Both mutations live on `TranslationMutations`, which the root `Mutation`
exposes as `translation`. The namespace's wrapper field carries no permission
extension, because the API has no authentication, so the field exists only as
the namespace. No `name=` is given, so the exposed names stay `rateTranslation`
and `proposeTranslation`.
Deliberately not followed literally: the conventions name a create's method
`create_<model_name>`. The point of that rule is to avoid a bare
`create`/`update`, whose generated union names would collide.
`propose_translation` already avoids that, and "propose" carries meaning that
"create" loses: the row waits for a moderator. `rate_translation` creates,
changes or deletes a rating, so it is no create at all.

**One applier sets an input onto a row: `typelearn.graphql.update_model_instance_based_on_input(data, instance, field_errors)`.**
It lives in the project package, the equivalent of the conventions'
`config.graphql`. For each field the input actually carries, it does one of
three things:

- **A `{ set: id }` relation:** resolves the related row and assigns it. An id
  no row has, a malformed id, or `set: null` adds `Not found.` to
  `field_errors[<field>]`. Every relation an input carries here is required,
  so clearing one is not supported; it is added when a nullable relation is
  first exposed.
- **An enum:** assigns the member's `.value`.
- **Anything else:** assigns it as given.

`UNSET` fields and many-to-many relations are skipped. The convention's
signature takes a `user`; this API has none, so the parameter is left out.
`field_errors` holds `ValidationError`s rather than strings, so each keeps a
code (`not_found`) and goes through the same refusal table as `full_clean()`'s
errors. A resolver therefore does three things: build the row with only what
the input cannot carry (`origin`, `status`, `address_hash`), apply the input,
and refuse on `field_errors` before validating. `object_or_fail` is deleted.

**An unpublished translation is refused as if it did not exist.** A
translation is visible only once published. After the applier, the rating
resolver locks the translation and checks it. If the translation is missing or
not published, the resolver assigns rather than appends
`field_errors['translation']`, replacing any `Not found.` the applier left. The
two cases then produce one response, with the same code (`NOT_FOUND`) and the
same message (no id is interpolated into it). A parametrized test asserts the
literal response for a pending row, a rejected row, an id no row has, and a
malformed id. This supersedes the `NOT_PUBLISHED` code that
`add-phrase-translations`' design lists. Its design and tasks are left as the
record of what was built then; its spec delta carries the new behaviour.

**`proposeTranslation` returns the stored row**, cast to `TranslationType`.
It is the caller's own text, so returning it reveals nothing. The suggestion
stays out of `Exercise.translation`, which shows published rows only.
`ProposeTranslationResult` is deleted. The frontend never read `accepted`, so
it only changes which field it selects.

**`deck` refuses through `fail('INVALID_SIZE', …)`,** the module's existing
helper, keeping the message that names the argument.

**Mutations are atomic by decorator.** `rate_translation` was already almost
entirely inside a `with transaction.atomic()`. It becomes `@transaction.atomic`
under the mutation decorator, and both mutations use
`@strawberry_django.mutation`. That decorator applies no error handling here
because the default is off. `refresh_from_db()` after the `F()` update stays,
since the counts really did change, but is narrowed to the two count fields.

**Tests follow the test conventions.** In each module, GraphQL documents are
constants at the top, with arguments passed as variables rather than
formatted into the string. They are followed by helpers, then flat test
functions marked `@pytest.mark.django_db()`. Every response is assigned and
inspected, including setup calls, which now assert the state they produce.
Error assertions check `len(body['errors']) == 1` before reading the code.
Literals shared between setup and assertion become named locals.

## Risks / Trade-offs

- [The duplicate check now runs before the rate limit] → A rate-limited
  client sending a duplicate is told `DUPLICATE` instead of `RATE_LIMITED`.
  Both refuse and store nothing. The order of two refusals is not part of
  the contract.
- [`full_clean()` validates fields the old code did not, such as `client_id`
  and `address_hash` length and the `origin`/`status` choices] → All of them
  are set by the server from already-validated input. An unforeseen failure
  surfaces as `INVALID`, not as a stored bad row.
- [A deployment that set `TRANSLATION_MAX_LENGTH`] → None of the chart,
  `.env.example` or the docs ever set it, and any value above 500 already
  failed at the database. A lower value stops having an effect, which the
  proposal states.

- [`exercises(limit:)` stops validating] → The only callers are the spec's
  examples and hand-run GraphiQL queries. The frontend never sends it, and
  `src/frontend` was searched to confirm this.

- [The mutations' shape changes] → The frontend changes in the same commit.
  The two images roll out separately, though, so a tab already open on the old
  bundle gets an error on rate and propose until it reloads. Reading still
  works. The window is one rollout, and a failed rating or suggestion shows the
  generic message rather than losing anything silently.

## Migration Plan

No data or database migration. Deploy the backend and the frontend together.
Rolling back is deploying both previous images. A backend rolled back alone
breaks rate and propose for the new bundle, so roll back as a pair.
