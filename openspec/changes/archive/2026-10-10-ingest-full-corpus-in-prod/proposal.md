## Why

Ingestion is capped at 100 exercises, but the Thai corpus has 21,429 distinct
sentences that pass the same quality and beginner filters. Production should
offer all of them. Local development should not have to: the full set is about
21k clips and slows down every fresh cluster for no benefit, so the size needs
to be a per-environment setting rather than a new constant.

Loading the full set also exposes a problem in the frontend. It fetches the
entire catalog in one query and shuffles it in the browser. With 100 exercises
that is fine. With about 21k it means several megabytes of JSON on every page
load. The server should hand out a random deck of limited size instead.

## What Changes

- `load_corpus` gains `--all`: select every sentence that passes the existing
  filters instead of the first N. It cannot be combined with `--count`. Without
  either flag the command still selects 100, so running it by hand keeps its
  current behaviour.
- With `--all`, the "not enough candidates" check becomes "no candidates at all".
  A full-corpus run is short only if the filters matched nothing.
- The chart gains `ingest.count`, which is either a positive integer or `all`,
  with a default of `100`. The ingest Job passes it through as `--count N` or
  `--all`. An invalid value makes rendering fail with a named error.
  `values-prod.yaml.example` sets `all`. The Tilt button keeps the default, so
  local clusters ingest 100.
- The GraphQL schema gains `deck(size: Int!): [Exercise!]!`, which returns up to
  `size` exercises in random order. `size` is capped on the server, so the field
  cannot be used to pull the whole catalog.
- The frontend requests a deck (200 exercises) instead of the whole catalog, and
  no longer shuffles it itself. When the learner reaches the end of a deck, it
  requests a new one rather than looping over the same 200.
- **BREAKING (spec only)**: the corpus-ingestion requirement "select exactly 100"
  becomes "select N, or all". The typing-practice promise that nothing repeats
  until the whole catalog has been seen now applies within a deck, not across the
  whole catalog.
- `docs/deployment.md` and `docs/development.md` describe the setting and how
  much the full ingestion takes (count, disk, time).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `corpus-ingestion`: the selection size is a parameter (a count, or all
  candidates) instead of a fixed 100; the "too few candidates" check and the
  clip-copy requirement follow that size.
- `exercise-api`: adds the `deck(size)` query, which returns a random, capped
  sample of the catalog.
- `typing-practice`: the practice session draws from a server-supplied random
  deck and fetches a new deck when it runs out; the "no repeats" guarantee is
  scoped to a deck.
- `production-deployment`: the amount of the corpus the ingest Job loads is a
  chart value, set per environment.

## Impact

- Backend: `exercises/management/commands/load_corpus.py`,
  `exercises/schema.py`, and tests in `exercises/tests/`.
- Frontend: `src/stores/exercise.js`, its unit tests, and the e2e fixtures that
  mock the catalog query.
- Chart: `templates/ingest-job.yaml`, `values.yaml`,
  `values-prod.yaml.example`.
- Docs: `docs/deployment.md`, `docs/development.md`, and the roadmap entry that
  records the 100 cap.
- Production storage: about 21k clips, roughly 0.5 GB. This fits well within the
  example's 50Gi claim. The ingest Job takes minutes rather than seconds.
- No model or migration changes.
