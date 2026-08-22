## Why

The repository documents the whole MVP but runs none of it: `src/backend/` holds a
dependency-less `pyproject.toml`, `src/frontend/` is empty, and there is no database,
no model, and no data. Milestones M1 (skeleton) and M2 (model + DB + data load) are
the foundation every later milestone reads from — the GraphQL query, the sentence
view, and the audio player all query rows that do not exist yet. This change makes
the specified foundation real: scaffolds that run, a PostgreSQL container that
persists, and 100 playable exercises in the database.

## What Changes

**Scaffolds (M1)**
- Django project `typelearn` with app `exercises` under `src/backend/`, plus `manage.py`
- Poetry dependencies declared and locked: Django, strawberry-graphql-django, psycopg,
  django-cors-headers, gunicorn, Pillow, pytest, pytest-django
- Vue 3 + Vite frontend scaffolded under `src/frontend/` with Pinia and Tailwind CSS 4
  wired through the `@tailwindcss/vite` plugin (no `tailwind.config.js`, no PostCSS)
- `podman-compose.yml` defining a `postgres:17` `db` service on the `typelearn-net`
  network with a named volume, credentials read from an uncommitted `db.env`, and a
  committed `db.example.env` template
- Django settings read database credentials from the environment, and declare
  `MEDIA_ROOT` / `MEDIA_URL` with development media serving

**Model and data (M2)**
- `Exercise` and `Progress` models with explicit `max_length` on every `CharField`
- Initial migration, applied against the containerised PostgreSQL 17
- A `load_corpus` management command that reads `validated.tsv` and `clip_durations.tsv`
  from a corpus root passed as an argument, selects exactly 100 exercises by the
  specified filters, derives `difficulty` on a 1–5 scale, copies the 100 referenced
  `.mp3` clips into `MEDIA_ROOT`, and is safe to re-run
- pytest + pytest-django test suite covering model constraints, selection filters,
  difficulty derivation, determinism, and idempotent re-runs

Out of scope: the GraphQL schema and endpoint (M3) and everything in the frontend
beyond the scaffold (M4–M7). The Vue app is created and builds, but renders only its
starter page.

## Capabilities

### New Capabilities

None. The behaviour this change implements is already specified across
`corpus-ingestion`, `exercise-catalog`, and `local-dev-environment`.

### Modified Capabilities

- `corpus-ingestion`: two requirement changes.
  1. The determinism requirement currently reads "run twice … with the same seed",
     which presumes a random sample and leaves the seed undefined — two runs with
     different seeds would satisfy it while producing different datasets. Replaced
     with a total deterministic ordering over the candidate pool, so the 100 selected
     exercises are a function of the corpus alone and no seed exists to vary.
  2. Adds a requirement that ingestion is a Django management command, fixing the
     invocation surface, its failure behaviour on a bad corpus root, and the summary
     it reports.

## Impact

- **Code**: new `src/backend/typelearn/` (settings, urls, wsgi/asgi), new
  `src/backend/exercises/` (models, migration, `management/commands/load_corpus.py`,
  tests), new `src/frontend/` Vue project, new `podman-compose.yml`, `db.example.env`
- **Dependencies**: Python packages added to `src/backend/pyproject.toml` and
  `poetry.lock`; npm packages in `src/frontend/package.json`
- **Data**: reads the Common Voice release directory in place from a path supplied at
  run time; writes 100 `.mp3` files into the ignored `MEDIA_ROOT` and 100 rows into
  the PostgreSQL volume. Nothing from the corpus enters version control.
- **Infrastructure**: developers must have Podman and run the compose file before
  `migrate`; `db.env` must exist locally and stays uncommitted
- **Unblocks**: M3 (GraphQL query) and M4–M7, which all read the `Exercise` table
