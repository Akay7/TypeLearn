## 1. Data model

- [x] 1.1 Add `Translation` and `TranslationRating` models to `exercises/models.py` per design D1 (every CharField with explicit `max_length`, origin/status choices, denormalized `up_votes`/`down_votes`, `published_at`). Verify that `manage.py check` passes.
- [x] 1.2 Add constraints and indexes: a partial unique `(exercise, language)` where `origin=machine`, unique `(exercise, language, text)`, unique `(translation, client_id)` on ratings, and an index on `(exercise, language, status)`. Generate the migration, and verify that `makemigrations --check` is clean after it.
- [x] 1.3 Add model tests in `tests/test_models.py`: the constraints reject duplicates, and the shown-translation ordering (net score desc, then `published_at` desc) picks the right row. Verify with `pytest`.

## 2. Settings and shared helpers

- [x] 2.1 Add these settings to `typelearn/settings.py`, each read from the environment with a default: `SUPPORTED_INTERFACE_LANGUAGES`, `TRANSLATION_SOURCE_LANGUAGE`, `TRANSLATION_MAX_LENGTH`, `TRANSLATION_PROPOSALS_PER_HOUR`, `TRANSLATION_RATINGS_PER_HOUR`, and `TRUSTED_PROXY_COUNT`. Verify that `manage.py check` passes.
- [x] 2.2 Implement the client-address helper (REMOTE_ADDR or trusted `X-Forwarded-For` hop, HMAC with `SECRET_KEY`) and client-id validation. Verify with unit tests covering 0 and 1 trusted proxies and spoofed extra hops.

## 3. GraphQL read side

- [x] 3.1 Add the `Translation` type, the `TranslationOrigin` enum, and `Exercise.translation(language: String!)`, resolved from an explicit ordered `Prefetch` (design D2). An unsupported language returns null. Verify with schema tests: deck with translations, unknown language returns null, and pending or rejected translations are never returned.
- [x] 3.2 Add a query-count test showing that `deck(size: 50) { translation(language: "en") { text } }` uses a constant number of queries (`django_assert_max_num_queries`).

## 4. GraphQL mutations

- [x] 4.1 Add the `Mutation` type with `rateTranslation` (UP/DOWN/NONE; upsert or delete the rating and update the denormalized counts with `F()` in one transaction; published translations only). Verify with tests: idempotent per client, changing a vote, withdrawing a vote, and rating an unpublished translation fails with `NOT_PUBLISHED`.
- [x] 4.2 Add `proposeTranslation` (store a pending learner translation; validate the exercise, language, blank or over-long text, duplicate, and client id, using the error codes from design D6). Verify with a test for each code and for the stored pending row.
- [x] 4.3 Add database-counted rate limits per client id and per address hash to both mutations (design D4). Verify with tests: requests over the configured limit return `RATE_LIMITED` and store nothing.
- [x] 4.4 Wire `mutation=Mutation` into `build_schema()`. Rewrite the `csrf_exempt` comment in `typelearn/urls.py` and the schema module docstring per design D5. Verify with a test that a GET carrying a mutation is refused, and with the existing schema tests.

## 5. Moderation admin

- [x] 5.1 Register the `Translation` admin: default pending filter, filters on status, origin, and language, read-only columns for the exercise sentence and the currently shown translation, and bulk "Approve"/"Reject" actions that set `published_at`. Verify with an admin test that approving publishes a row and makes it the shown translation, and that rejecting hides it.
- [x] 5.2 Add an admin action (or management command) that recomputes `up_votes`/`down_votes` from the rating rows. Verify with a test that it repairs deliberately corrupted counts.

## 6. Translation fixture and batch translation

- [x] 6.1 Add a fixture module in `exercises/translation/` (design D7): `<dir>/<source>.yaml`, defaulting to `exercises/fixtures/translations/`; load (missing file is empty, an invalid file is an error, entries without a sentence are skipped), and an atomic, byte-stable save (fixed key order, Unicode as itself, no line wrapping, temp file + `os.replace`). Add PyYAML as a runtime dependency. Verify with unit tests: round trip of awkward text, a stable re-save, missing and invalid files, and missing languages.
- [x] 6.2 Create the provider interface and `OfflineProvider`. Verify with a unit test of deterministic output.
- [x] 6.3 Add the `anthropic` SDK to the dev dependency group and implement `AnthropicProvider` (structured JSON-array output, length and blank validation, key read from `ANTHROPIC_API_KEY` in the developer's shell, fails early when the key is missing; model, effort and refusal fallback passed in, not read from settings). Verify with unit tests using a stubbed client: a good batch, a wrong length, a blank item, and a missing key.
- [x] 6.4 Extract `select_from_release` from `load_corpus`, and implement `translate_catalog CORPUS_ROOT` (design D8: the full selection read from the release with no database, target defaults, `--languages/--locale/--provider/--model/--effort/--batch-size/--limit/--dir`, requesting only the missing languages, the offline provider refusing the committed fixture, saves every 30 s and on exit, failure summary, non-zero exit). Verify with command tests: a fresh run, no database queries, a re-run makes no provider calls and leaves the file byte-identical, a resume after a failed batch, an interrupted run keeps what came back, new sentences and languages only, hand corrections kept, and the source language excluded.
- [x] 6.5 Rewrite `load_translations` to read the fixture (match by sentence, then sentence id; create missing machine rows; update changed text while clearing its ratings; leave learner rows alone; skip over-long text; report counts; a missing file is a no-op, an invalid one fails). Verify with command tests: loading into a fresh catalog, an idempotent re-load that keeps ratings, a changed text clearing ratings, unmatched entries reported, and a database rebuild restoring everything with zero provider calls.
- [ ] 6.6 Run `translate_catalog` against the Thai release with a real key: first `--limit 20`, reviewing the output and the cost, then the full run. Commit `exercises/fixtures/translations/th.yaml`.

## 7. Chart

- [ ] 7.1 Change the ingest Job command to `load_corpus ... && load_translations`. Verify with `helm template` output, and by ingesting in a local cluster once the fixture exists.
- [x] 7.2 Keep provider keys and translation out of the chart, the Tiltfile, and `.env.example`: no translate Job, no `translate` values, no `_API_KEY` secret rule. Verify that `helm template` renders no Job other than ingest.

## 8. Frontend

- [x] 8.1 Add a persisted `showTranslation` setting (default false) to `stores/settings.js`, and a checkbox group in `SettingsMenu.vue`. Verify with store tests for the default, persistence, and unavailable storage, and a component test for the toggle.
- [x] 8.2 Add a client-id helper (`crypto.randomUUID()` persisted under `typelearn.clientId`, with an in-memory fallback). Verify with unit tests.
- [x] 8.3 Add `stores/translation.js` (design D9): fetch the rest of the deck's translations in one `exercises(filters: {id: {inList: $ids}})` request when enabled, keep an `exerciseId:language` translation cache, refetch on enable, language change, or a new deck, and add `rate`/`propose` actions that map error codes to i18n keys. Verify with store tests using a mocked `fetch`: no translation fetched while off, refetch on language switch, none for the source language, and error-code mapping.
- [x] 8.4 Create `TranslationPanel.vue` (text with `lang`, up/down toggles reflecting session state, "no translation yet" note, a suggest form with textarea, validation messages, and confirmation) and mount it in `SentenceView.vue` below the sentence. Verify with component tests for each state.
- [x] 8.5 Guard the physical-keyboard input path so that keystrokes aimed at another editable element never reach the answer. Verify with a test that typing in the suggestion textarea leaves `typed` unchanged.
- [x] 8.6 Add all new strings to `locales/en.json`, nested by component, with plurals if needed. Verify that the locale keys test passes.
- [x] 8.7 Add a Playwright e2e spec with GraphQL fixtures: enable the setting, see the translation, switch language, rate, and submit a suggestion. Verify that it passes in `npm run test:e2e`.

## 9. Docs and specs housekeeping

- [x] 9.1 Document the translation fixture and running `translate_catalog` once on a developer's machine (the key in the shell only, the `--limit` trial, cost, correcting by hand) in `docs/development.md`, where deployments get their translations from in `docs/deployment.md`, and `TRUSTED_PROXY_COUNT` for the Gateway. Verify that the documented commands run as written.
- [x] 9.2 Add decision-log entries to `specs/roadmap.md`: batch MT over on-demand, machine translations committed as a YAML fixture made once on a developer's machine, anonymous plus moderated writes, the CSRF exemption kept with its reasoning, and DB-counted rate limits.
- [x] 9.3 Run the full backend and frontend test suites and `openspec validate add-phrase-translations --strict`. Verify that all of them pass.
