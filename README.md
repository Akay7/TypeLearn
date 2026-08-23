# TypeLearn

A language-learning app where you learn by typing what you hear: play a clip, read
the expected sentence, type it, get instant feedback. Thai is the first dataset; the
app is designed for any language.

- `specs/` — background docs: mission, roadmap, tech stack
- `openspec/specs/` — normative behaviour specs
- `src/backend/` — Django + Strawberry GraphQL
- `src/frontend/` — Vue 3 + Vite + Pinia + Tailwind
- `data/` — corpus and generated data, git-ignored

## Local setup

Requires Podman, Poetry, and Node.

### 1. Database

```bash
cp db.example.env db.env       # then set a real POSTGRES_PASSWORD
podman network create typelearn-net
podman-compose up -d
```

The `typelearn-db-data` volume keeps the database across container restarts.

### 2. Backend

Django reads its database credentials from the environment — the same variables the
container gets from `db.env` — so export them before running management commands:

```bash
set -a; . ./db.env; set +a
cd src/backend
poetry install
poetry run python manage.py migrate
```

### 3. Load exercises

Ingestion needs a local Common Voice release directory (`cv-corpus-25.0-2026-03-09`
for Thai). It stays outside the repository and is never committed; pass its path as
an argument:

```bash
poetry run python manage.py load_corpus /path/to/cv-corpus-25.0-2026-03-09
```

This selects 100 exercises from `th/validated.tsv`, derives each one's difficulty,
and copies the referenced clips into `MEDIA_ROOT`. The selection is deterministic —
the same corpus always yields the same 100 exercises — and the command is safe to
re-run. Useful options: `--count`, `--locale`, `--manifest`.

```bash
poetry run python manage.py runserver
poetry run pytest              # the test suite builds its own miniature corpus
```

The GraphQL endpoint is at `/graphql/`, and serves GraphiQL while `DEBUG` is on:

```bash
curl -s localhost:8000/graphql/ -H 'Content-Type: application/json' \
  -d '{"query":"{ exercises(limit: 1) { id sentence audioUrl difficulty } }"}'
```

`audioUrl` is absolute, so the frontend on the Vite origin can load it directly.
Browser origins allowed to query the endpoint come from `CORS_ALLOWED_ORIGINS`,
which defaults to the Vite dev server on `localhost` and `127.0.0.1`.

`exercises` also takes `filters` and `ordering`, so a caller can ask for a slice of
the catalog instead of sorting it client-side:

```graphql
{ exercises(limit: 1, filters: {difficulty: {lte: 2}}, ordering: [{upVotes: DESC}]) { sentence } }
```

The schema is read-only and public — there are no mutations, so nothing there needs
authentication yet. Query size is capped by `STRAWBERRY_MAX_TOKENS`,
`STRAWBERRY_MAX_ALIASES`, and `STRAWBERRY_MAX_QUERY_DEPTH`, and introspection is
served only while `DEBUG` is on.

### 4. Frontend

```bash
cd src/frontend
npm install
npm run dev
npm run test              # vitest, over the pure logic in src/lib/ and the store
npm run test:e2e          # playwright, driving Chromium against the dev server
```

The e2e suite needs no backend: it stubs the GraphQL catalog and synthesises its own
audio clip, so it runs with no database, no ingested corpus, and no network. The
first run downloads Chromium — `npx playwright install chromium`.

The app reads the backend URL from `VITE_API_URL` in `.env.development`; override it
with `.env.development.local` if the backend runs somewhere else.

The whole catalog is fetched in one query at startup and practised in a shuffled
order, so advancing after a correct answer costs no round-trip. Answers are checked
in the browser and nothing is recorded — `Progress` is unused by the MVP.

The on-screen keyboard is the Kedmanee layout with a Shift layer, and the key for the
next expected character is highlighted as you type — and if the answer goes wrong the
backspace key is highlighted instead, so the keyboard always names a key worth pressing. Keys are coloured by the finger
that presses them — the two hands mirror, so one legend of five covers both — and each
key names its finger on hover. `npm run test` covers the layout
table and the comparison logic; the layout test is what catches a wrong or missing
key, since every character the corpus uses has to be reachable on screen.

Thai is rendered in a looped face the app bundles rather than the system default,
because a beginner tells the letters apart by their heads. The clip plays by itself
when an exercise appears, an answer is checked as soon as it reaches the target's
length, and a verdict is drawn into space already reserved for it so the keyboard
never moves under your fingers. Those four are the ones `npm run test:e2e` exists
for — a font being loaded, a clip playing, and two elements staying put are claims
only a browser can settle.

## Working on this project

Planning runs through [OpenSpec](openspec/): `openspec list` shows active changes,
and `specs/roadmap.md` tracks milestone progress.
