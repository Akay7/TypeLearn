## 1. Ingestion size (`load_corpus`)

- [x] 1.1 In `exercises/management/commands/load_corpus.py`, put `--count`
      (default 100) and a new `--all` flag in a mutually exclusive argparse
      group. Make `select_exercises` accept `count=None` to mean "every kept
      row": with no count it fails only when nothing matched ("no candidates
      matched the selection filters"), and with a count it keeps the existing
      too-few error. Verify that `load_corpus --help` lists both flags and
      that passing both exits non-zero with argparse's "not allowed with"
      error.
- [x] 1.2 Write a progress line to stdout every 1,000 exercises during the
      load loop. Verify by reading a test run's output (task 1.3 covers the
      count).
- [x] 1.3 Extend `exercises/tests/test_load_corpus.py` and verify each of
      these with a test: `--all` loads every distinct passing sentence and
      nothing else; a count selects a prefix of the `--all` order;
      `--count` with `--all` fails and writes no rows; `--all` over a corpus
      with no passing row fails with the no-candidates error and writes no
      rows; a run with `--all` after a run with a count updates the existing
      rows in place and only creates the rest. Existing tests still pass.

## 2. Random deck query (backend)

- [x] 2.1 Add `EXERCISE_DECK_MAX_SIZE` (env-overridable, default 500) to
      `typelearn/settings.py` next to the `STRAWBERRY_MAX_*` limits (which
      `.env.example` and the chart values don't list either, so neither does
      this). Verify that `python manage.py check` passes.
- [x] 2.2 Add `deck(size: Int!): [Exercise!]!` to `Query` in
      `exercises/schema.py`: `order_by('?')`, sliced to
      `min(size, EXERCISE_DECK_MAX_SIZE)`; `size < 1` raises a GraphQL error
      that names `size`. Verify in GraphiQL that `{ deck(size: 3) { id } }`
      returns 3 ids that differ between runs.
- [x] 2.3 Add tests to `exercises/tests/test_schema.py` for each `deck`
      scenario in the exercise-api delta: exact size and distinct ids; two
      decks from a large fixture differ; a size larger than the catalog
      returns the whole catalog once; the cap is enforced (override the
      setting to a small value); size 0 errors; an empty catalog returns
      `[]`. Verify that the backend suite passes in the pod.

## 3. Frontend deck (`stores/exercise.js`)

- [x] 3.1 Replace `CATALOG_QUERY` with a `Deck` query of `deck(size: DECK_SIZE)`
      where `DECK_SIZE = 200`, read `body.data.deck`, and remove the
      client-side `shuffle` (the server's order is random). Keep the
      unreachable-sentence filter. Verify that `load()` still sets `ready`
      and `empty` as before (task 3.3).
- [x] 3.2 When `next()` moves past the last exercise, fetch a new deck in the
      background without switching `status` to `loading`; on success,
      replace the deck and start at index 0 with the answer state reset; on
      failure, `console.error` and wrap to index 0 of the current deck. Guard
      against a second refill starting while one is in flight. Verify with
      task 3.3.
- [x] 3.3 Update `stores/__tests__/exercise.test.js`: mocks return
      `{ data: { deck: [...] } }`; the request body asks for `deck` with the
      fixed size and not `exercises`; advancing past the last exercise issues
      a second request and presents the new deck's first exercise; a failed
      refill logs the error and loops back to the first exercise of the old
      deck; `status` never becomes `loading` during a refill. Verify that
      `npm run test:unit` passes.
- [x] 3.4 Update `e2e/fixtures.js` (and any spec that reads the stub's shape)
      to answer the `Deck` query with `{ data: { deck: [...] } }`. Verify
      that the Playwright suite passes.

## 4. Chart

- [x] 4.1 Add `ingest.count: 100` to `chart/values.yaml` with a comment that
      explains the integer / `all` forms and why the default is small. In
      `templates/ingest-job.yaml`, map `all` → `--all`, a positive integer →
      `--count N`, and anything else → `fail` with the value and the accepted
      forms. Verify that `helm template` with `--set ingest.enabled=true
      --set ingest.corpusHostPath=/corpus` renders `--count 100` by default,
      `--all` with `ingest.count=all`, `--count 250` with `ingest.count=250`,
      and fails with the named error for `ingest.count=0` and
      `ingest.count=lots`.
- [x] 4.2 Set `ingest.count: all` in `chart/values-prod.yaml.example`, with a
      note on what it loads (about 21k exercises and clips, about 0.5 GB,
      minutes of Job time). Verify that the example renders with
      `helm template` and shows `--all`.
- [x] 4.3 Confirm that the Tiltfile's **Ingest the corpus** button passes no
      `ingest.count` and so ingests 100. Verify by reading the rendered
      command it applies.

## 5. Docs

- [x] 5.1 `docs/deployment.md`: document `ingest.count`, how to run the
      ingest Job in a deployment (delete the old Job, render with
      `ingest.enabled=true`, apply), and what `all` costs. `docs/development.md`:
      say that the button loads 100 and how to load everything locally if you
      want to (`load_corpus --all` in the pod). Verify that both docs name the
      value exactly as the chart does.
- [x] 5.2 Add a decision row to `specs/roadmap.md` recording that ingestion
      size became a per-environment setting and that the frontend moved to a
      server-side random deck. Verify that the row is present.

## 6. End-to-end check

- [x] 6.1 In the local Tilt stack, check the full path without a full local
      ingestion (the user asked that the whole batch not be loaded locally).
      Verify: the 21,429 figure by running the selection over the corpus on the
      host (21,429 exercises, 394 MB of clips); the live `deck` query returns
      random, distinct exercises, caps at the catalog size, rejects `size: 0`,
      and its `audioUrl` serves `audio/mpeg`; the live page sends exactly one
      `deck(size: 200)` request and no `exercises` request; and the Tilt
      button's render still says `--count 100`. Refilling past the end of a
      deck is covered by the store tests (3.3), not driven live.
- [x] 6.2 Run `openspec validate ingest-full-corpus-in-prod --strict` and
      verify that it passes.
