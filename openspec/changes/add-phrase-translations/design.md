## Context

See proposal.md for the motivation. The current state that shapes this design:

- The API is read-only and anonymous. `typelearn/urls.py` wraps `/graphql/` in
  `csrf_exempt` with a note that it "must be revisited before the first
  mutation". This change adds that first mutation.
- There are no user accounts. The session and auth middleware exist only for the
  admin.
- The frontend practises from a server-drawn deck of 200 exercises
  (`deck(size)`), fetched once and advanced locally. Settings live in
  `stores/settings.js` as localStorage-backed refs. The interface language is one
  of `SUPPORTED_LANGUAGES` (`en fr de th ru hu`).
- Exercises carry no language field. The corpus is Thai, and the keyboard layout
  already defaults on the absence of a language.
- Clips are already treated as a costly, deterministic by-product of the
  corpus: they are written once to the media volume (one shared host directory in
  development, an RWX PVC in a deployment) and survive database rebuilds.
- A deployment may hold about 21k exercises. Several gunicorn workers and
  possibly several pods serve the API, and there is no shared cache service.

## Goals / Non-Goals

**Goals:**
- One data model that covers machine translations, learner suggestions, and
  ratings, with the "shown" choice cheap to compute for a whole deck.
- Mutations that are safe to expose anonymously: deduplicated, rate-limited, and
  moderated before anything a learner wrote is shown to other learners.
- Translation generation that is repeatable, resumable, and paid for once. The
  output outlives any one database, and no provider key exists outside the
  machine that ran it.

**Non-Goals:**
- User accounts, or crediting suggestions to a person.
- Translating on demand at request time.
- A moderation UI outside Django admin.
- Putting learner translations or ratings in the fixture. They are runtime
  writes, and belong to the database and its backups like any other user data.
- Word-by-word glosses or transliteration. This change covers only
  whole-sentence translation.
- Adding a `language` field to `Exercise`. The source language is a setting
  until a second corpus language exists.

## Decisions

### D1. One `Translation` table for machine and learner text, plus `TranslationRating`

`Translation(exercise FK, language CharField(max_length=8), text
CharField(max_length=500), origin {machine, learner}, status {published, pending,
rejected}, provider CharField(max_length=64, blank), client_id
CharField(max_length=64, blank), address_hash CharField(max_length=64, blank),
up_votes, down_votes, published_at null, created_at)`.

`TranslationRating(translation FK, client_id CharField(max_length=64), value
±1, address_hash, updated_at)`, unique on `(translation, client_id)`.

A suggestion is a `Translation` in `pending`, so approving it is a status flip,
not a copy between tables. A partial unique constraint on `(exercise, language)`
where `origin=machine` makes `load_translations` idempotent as a database
guarantee. Machine rows are a loaded copy of the fixture (D7); learner rows are
original data. A unique constraint on `(exercise, language, text)` stops identical
duplicates, including re-submitting rejected text.

*Alternative:* separate `Suggestion` and `Translation` tables. Rejected: approval
would duplicate rows, and the admin would need two changelists for the same
kind of thing.

### D2. Vote counts are denormalized onto `Translation`

`up_votes` and `down_votes` are updated in the same transaction as the rating
row, with `F()` expressions, using the old and new value of the rating (insert,
change, or delete). The "shown" rule then becomes an ordering: `status=published,
language=L`, ordered by `(up_votes - down_votes) DESC, published_at DESC`.

For a deck, `Exercise.translation(language)` is resolved with a `Prefetch` of
that ordered queryset. The first element is taken in Python, so 200 exercises
cost one extra query. Strawberry-django's optimizer does not handle a field with
an argument on its own, so the field declares its prefetch explicitly
(`strawberry_django.field(prefetch_related=...)` with a callable that reads the
argument). An index on `(exercise, language, status)` backs it.

*Alternative:* compute the aggregate from ratings at read time. Rejected:
annotating 200 prefetched rows with an aggregate subquery on every deck fetch
costs more than a counter update on a rare write.

### D3. Anonymous identity: browser client id plus hashed address

The frontend generates `crypto.randomUUID()` once and stores it under
`typelearn.clientId`. If storage is unavailable, it keeps the id in memory for
the session. The server validates the client id as a UUID. The client address is
taken from `REMOTE_ADDR`, or from the right-most untrusted `X-Forwarded-For` hop
when `TRUSTED_PROXY_COUNT` > 0. It is stored only as
`HMAC(SECRET_KEY, address)`, never in the clear.

The client id is trivially spoofable, which is why rate limits also key on the
address hash and why suggestions are moderated. Ratings only reorder
already-published translations, so ballot-stuffing can promote one reviewed text
over another but cannot publish anything new.

### D4. Rate limits counted from the database

Limits are checked by counting the caller's own rows in a sliding window:
`Translation(origin=learner)` created per client id and per address hash in the
last hour, and `TranslationRating` updated per client id and per address hash in
the last hour. The limits are settings (`TRANSLATION_PROPOSALS_PER_HOUR`,
default 20; `TRANSLATION_RATINGS_PER_HOUR`, default 300).

*Alternative:* the Django cache framework. Rejected: the only cache available is
per-process LocMem, which gives each gunicorn worker and pod its own counter.
The rows exist anyway, so counting them is exact everywhere at the cost of one
indexed `COUNT`.

### D5. Keep the CSRF exemption and replace its comment with the reasoning

The mutations carry no ambient credential. No cookie or session identifies the
caller; the only identity is `clientId` in the request body. A cross-site forged
request can therefore do nothing an attacker could not do by calling the API
directly. Strawberry's view already refuses to run mutations over GET, and only
JSON bodies are sent by the frontend. The comment in `urls.py` is rewritten to
say that the exemption holds only while no mutation relies on the session. The
schema module docstring is updated to match.

*Alternative:* drop the exemption and fetch a CSRF token. Rejected: it adds a
round trip and a cookie to protect nothing, and it would need a token endpoint.

### D6. Mutation errors use stable codes in `extensions`

Validation failures raise `GraphQLError(message, extensions={'code': ...})` with
codes `NOT_FOUND`, `UNSUPPORTED_LANGUAGE`, `BLANK`, `TOO_LONG`, `DUPLICATE`,
`INVALID_CLIENT_ID`, `NOT_PUBLISHED`, and `RATE_LIMITED`. The frontend maps each
code to an i18n key. It does not match on the English message.

### D7. Machine translations are a committed YAML fixture, not database rows of record

The fixture is `src/backend/exercises/fixtures/translations/<source>.yaml`,
committed and shipped in the backend image. `--dir` overrides the directory for
both commands. One entry per source sentence, holding every target language:

```yaml
format: 1
source: th
generated_by: anthropic claude-opus-5
sentences:
- sentence: ฉันชอบกินข้าวผัด
  sentence_id: 7f3c2a…
  en: I like eating fried rice.
  ru: Я люблю есть жареный рис.
```

A missing language key means "not translated yet". `generated_by` is
file-level provenance, and it is copied into `Translation.provider`.

- **Why committed, rather than on a volume:** translation happens once, on a
  developer's machine. Committing the result is the only way to get it to every
  worktree, CI and every deployment without a Secret, a Job, a volume to seed,
  or a copy step, so the provider key never leaves that one shell. The
  alternatives each move a key or a file around by hand. Common Voice sentence
  text is CC0, so the repository may contain it, even though it deliberately
  does not contain the corpus's audio.
- **Why keyed by sentence, not by database id:** database ids differ between
  worktrees and rebuilds. `Exercise.sentence` is unique and is exactly what was
  translated. `sentence_id` is carried alongside for traceability and as a
  fallback match.
- **Why YAML, one entry per sentence:** it can be read, reviewed in a diff, and
  corrected by editing one line. All of a sentence's languages sit together.
  Unicode is written as itself (`allow_unicode`), keys are written in a fixed
  order (sentence, id, then the languages in interface order), and lines never
  wrap, so a re-save of the same content is byte-identical. The C loader and
  dumper are used when libyaml is present. A full catalog is about 10 MB and
  loads in about 2 s.
- **Durability without locks:** one developer runs the command, so there is no
  concurrent writer to guard against. Each save writes a temporary file and
  `os.replace`s it, so an interruption leaves the previous file whole. Saves
  happen at most every 30 seconds and on exit, including Ctrl-C and errors,
  which bounds what a crash can lose without rewriting 10 MB after every batch.
- **Corrections:** edit the line. `load_translations` replaces the loaded text
  and clears its ratings (D8).

*Alternative:* a JSONL sidecar per language pair on the media volume, written by
an in-cluster Job with the key in the release Secret (the previous draft).
Rejected: it puts a provider key into every environment that might translate,
needs a Job, an nginx deny rule and file locking on RWX storage, and still needs
a manual copy to seed another deployment.
*Alternative:* keep machine translations only in the database. Rejected: every
fresh database would either pay the provider again or need a dump and restore.

### D8. `translate_catalog` fills the fixture; `load_translations` imports it

`translate_catalog CORPUS_ROOT [--locale th] [--manifest validated.tsv]
[--languages en,fr,...] [--provider anthropic|offline] [--model M] [--effort E]
[--no-refusal-fallback] [--batch-size 25] [--limit N] [--dir PATH]`

- The input is every sentence the ingestion selection admits (`load_corpus`'s
  `select_from_release`, with no count), read straight from the release. No
  database is touched, so the command runs on a developer's host without the
  cluster. Because any ingestion count selects a prefix of that selection, the
  fixture covers both a 100-exercise development catalog and a full deployment.
- The source language is `--locale`, defaulting to `TRANSLATION_SOURCE_LANGUAGE`
  (`th`). The target default is `SUPPORTED_INTERFACE_LANGUAGES` minus the
  source. That list is a backend setting mirroring the frontend's list, because
  the backend validates `language` arguments against it too.
- For each target, only the entries missing that language are sent, and new
  sentences are appended in selection order.
- Provider options are command flags, not settings. Only this command uses
  them, and only on a developer's machine.
- The provider interface is
  `translate(sentences: list[str], source: str, target: str) -> list[str]`,
  in `exercises/translation/`. `OfflineProvider` returns `"[{target}] {sentence}"`
  and requires an explicit `--dir`, so its placeholders cannot land in the
  committed file. `AnthropicProvider` sends one batch per request and asks for a
  JSON array of exactly `len(sentences)` strings, using structured output. The
  array is validated for length, every item must be a non-blank string within
  `max_length`, and a batch that fails validation is rejected as a whole. The
  key comes from `ANTHROPIC_API_KEY` in the developer's shell. The SDK is a
  dev-group dependency and is imported lazily, so the production image has none.
  Retries use the SDK's built-in backoff. The default model is `claude-opus-5`,
  and `--effort` is the cost lever. A policy decline is re-run on Anthropic's
  recommended fallback model in the same call (`fallbacks: "default"`, turned
  off with `--no-refusal-fallback`). A refusal that survives that fails only its
  batch. An authentication, permission, or unknown-model error stops the whole
  run instead, since every batch would fail the same way.
- Failed batches are listed at the end, and the exit code is non-zero if there
  were any. The command never touches the database.

`load_translations [--dir PATH] [--languages ...]`

- Reads `<source>.yaml`. Each target language present is matched against
  `Exercise.sentence` in chunks, falling back to `sentence_id`.
- For each match, the machine row for `(exercise, target)` is created if
  missing. If it exists with different text, the text is updated, its
  `TranslationRating` rows are deleted, and its counts are zeroed in the same
  transaction. If the text is identical, nothing happens. Learner rows are
  never touched. A text over `TRANSLATION_MAX_LENGTH` (a hand edit) is skipped
  and reported rather than failing the load.
- It reports created, updated, unchanged, and unmatched counts. A missing file
  is a quiet no-op. A file that is not a valid fixture fails loudly, since it is
  a broken commit. The ingest Job runs it after `load_corpus`.

*Alternative:* have `translate_catalog` write both fixture and database.
Rejected: two writers of machine rows. One path in, from the file, keeps the
fixture authoritative.

### D8a. Chart and Tilt

- The ingest Job's command becomes `load_corpus ... && load_translations`. There
  is no translate Job, no provider key in any Secret or `.env`, and nothing in
  the Tiltfile.
- The chart sets `TRUSTED_PROXY_COUNT: "1"` for every environment: every
  request comes through the Gateway, whose Envoy appends the client's address
  to `X-Forwarded-For`.

### D9. Frontend: its own store, one request per deck and language, separate component

- `settings.showTranslation` is a persisted boolean, default `false`. The
  Settings menu adds a `kind: 'checkbox'` group, reusing the existing checkbox
  template.
- The translation state lives in its own `stores/translation.js`, not in the
  exercise store: nothing about checking an answer depends on it, and a failure
  there must never reach practice. It watches the deck, the setting, and the
  interface language. When the setting is on and the interface language is not
  the source language, one `exercises(filters: {id: {inList: $ids}}) {
  translation(language: $language) }` request fetches whatever the rest of the
  deck is missing in that language. The ids go in a variable because 200 of them
  inline would exceed `STRAWBERRY_MAX_TOKENS`. Results are cached by
  `exerciseId:language`, so switching back to a language costs nothing, and the
  deck query is unchanged. The source language is the language of the
  exercise's keyboard layout, the same default the keyboard already uses.
- A new `TranslationPanel.vue` sits under the sentence in `SentenceView.vue`. It
  shows the text with `lang` set, the thumbs up/down toggles, and a "Suggest a
  better translation" disclosure containing a `<textarea>` and Submit. It is
  kept out of the fixed-height answer row so it cannot push the keyboard around
  mid-exercise. The text is clamped to two lines in a reserved height, and
  expands on tap.
- Keystroke isolation: the answer is typed through the input's own `v-model`, so
  keystrokes in a textarea cannot reach it. The one document-level key path is
  the summary's Enter-to-advance (`CompletionStats.vue`), which now ignores
  events from any editable element other than the one marked
  `data-answer-field` (`lib/editable.js`). The textarea also stops its own key
  events. The guard is unit-tested against a control case.
- The browser's own ratings are held in the store by translation id for the
  session, so the toggles reflect what was sent. They are not persisted:
  the server is the source of truth, and nothing reads them back across
  reloads.

### D10. Admin moderation

The `Translation` admin has list filters on status, origin, and language, a
default filter of `status=pending`, and a read-only column showing the
exercise's sentence and the currently shown translation for that language.
Bulk actions "Approve" (sets `published` and `published_at=now()`) and "Reject"
are provided.

## Risks / Trade-offs

- [LLM translations of contextless fragments are wrong or over-literal] →
  Ratings demote them, learner suggestions replace them, and the prompt asks for
  a faithful, natural translation without commentary.
- [Batch cost and duration at about 21k × 5 pairs] → Batching (25 sentences per
  request) keeps it to about 4.3k requests. The run is resumable, and `--limit`
  allows a trial run before the full spend. The model is configurable, so a
  cheaper model can be chosen for the bulk run.
- [Spam or abuse in suggestions] → Nothing is shown before approval. There are
  per-client and per-address limits, and a length cap. The unique constraint
  blocks repeat submissions of rejected text.
- [Vote manipulation by rotating client ids] → The address-keyed limit bounds
  it. The worst outcome is reordering already-approved texts.
- [`X-Forwarded-For` misconfiguration makes every request share one address and
  hit the limit together] → `TRUSTED_PROXY_COUNT` is explicit, the deployment
  docs state the value for the Gateway, and a test covers the header parsing.
- [Denormalized counts drift from rating rows] → Every rating write updates both
  in one transaction. An admin action or management command can recompute the
  counts from the rating rows if they ever diverge.
- [A 10 MB machine-generated file in the repository] → It changes rarely (once,
  then small edits), its diffs are line-per-translation, and the text is CC0.
- [The fixture can drift from the corpus when a new release is ingested] →
  Unmatched entries are reported, and re-running `translate_catalog` on the new
  release requests only the new sentences.
- [A later file edit changes text that learners have rated] → Changed text
  clears that row's ratings (D8), so votes never describe text they were not
  cast on.
- [A privacy surface: storing addresses] → Only an HMAC is stored, keyed by
  `SECRET_KEY`, used only for limits. This is noted in the deployment docs.
- [Conflict with the in-flight `ingest-full-corpus-in-prod` change, which also
  edits the exercise-api spec and `schema.py`] → This change only adds
  requirements (no MODIFIED blocks on the requirement that change touches) and
  should be implemented after that change is archived.

## Migration Plan

1. Deploy the migration and code. The feature is inert until translations
   exist: the field returns null, and the setting defaults to off.
2. On a developer's machine, run `translate_catalog --limit 20` against the
   release to check quality and cost, then the full run. Review and commit the
   fixture. Each deployment picks it up at its next release plus ingest (or
   `load_translations` in a backend pod), with no provider spend.
3. Rollback: revert the release. The new tables are additive and can be left in
   place, or dropped by migrating `exercises` back. The fixture stays in the
   repository, so a later roll-forward reloads it for free.

## Open Questions

- The exact prompt wording and default batch size for the LLM provider. Tune
  them during the `--limit` trial run. This does not change the interface.
- Whether ratings should later feed back into machine re-translation (for
  example, re-translating texts with a net score ≤ −3 using a stronger model).
  This is left for a follow-up.
