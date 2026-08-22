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

### 4. Frontend

```bash
cd src/frontend
npm install
npm run dev
```

## Working on this project

Planning runs through [OpenSpec](openspec/): `openspec list` shows active changes,
and `specs/roadmap.md` tracks milestone progress.
