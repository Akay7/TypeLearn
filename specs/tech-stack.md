# Tech Stack

> **Background document.** `openspec/specs/` is normative for required behavior.
> This file records the technology choices and their rationale.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                   browser                                    │
│                                                                              │
│          Vue 3 + Pinia → Strawberry GraphQL client → API                     │
└──────────────────────────────────────────────────────────────────────────────┘
                                            |
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               Django backend                                 │
│                                                                              │
│          Strawberry GraphQL schema → Django models → ORM                     │
└──────────────────────────────────────────────────────────────────────────────┘
                                            |
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Podman / podman-compose                              │
│                                                                              │
│          PostgreSQL 17: exercises | progress | audio_files | users (v2+)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Infrastructure

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Container runtime | Podman | Latest (recommended over Docker) | Rootless, daemonless, Docker-compatible CLI |
| Compose | podman-compose | Latest | Docker Compose files run natively with Podman |

`podman-compose.yml` defines the `db` service (`postgres:17`) on the `typelearn-net`
network with a named volume for persistence. Credentials live in `db.env`
(`POSTGRES_PASSWORD`, `POSTGRES_DB`), which is git-ignored and never committed —
the compose file references the env file rather than inlining literals.

## Backend

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Framework | Django | latest | Established, mature, large ecosystem |
| API | Strawberry GraphQL | latest | Less boilerplate than DRF, auto introspection, type safe |
| Database | PostgreSQL | 17 (latest) | FK integrity, full-text search, ACID compliance |
| DB driver | psycopg (binary) | latest | Native async, type hinting over psycopg2 |
| Storage | Django FileField | — | Audio files stored on filesystem via `MEDIA_ROOT` |
| Package manager | Poetry | latest | Lock files, dependency resolution, Django ecosystem fit |
| WSGI server | Gunicorn | latest | Standard for Django production deployment |
| Tests | pytest + pytest-django | latest | Python testing standard with Django integration |

## Frontend

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Framework | Vue | latest | Reactivity, options + composition API, smaller than Angular |
| Build | Vite | latest | Fast HMR, modern, lighter than webpack |
| State | Pinia | latest | Official Vue store, simpler than Vuex |
| Routing | vue-router | latest | Official, well-integrated |
| HTTP | graphql-tag / native fetch | — | GraphQL client or direct fetch for MVP |
| Keyboard | Custom component | — | On-screen Thai characters, no external dependency |

Tailwind 4 is configured through the `@tailwindcss/vite` plugin and a single
`@import "tailwindcss";` in the stylesheet. There is no `tailwind.config.js`, no
`npx tailwindcss init`, and no separate PostCSS/autoprefixer step — those belong to
Tailwind 3 and its `init -p` command was removed in v4.

| Styling | Tailwind CSS | 4.x (latest) | Utility-first, fast iteration, clean default output |

## Data Layer

| Layer | Choice | Notes |
|---|---|---|
| Corpus source | Mozilla Common Voice | CC-0 license, 150+ languages, Thai release 25.0 |
| Corpus location | Release directory `cv-corpus-25.0-2026-03-09/th`, path supplied to the ingestion script | 9.6 GB, **outside the repository**, read in place and never committed |
| Selection source | `validated.tsv` | 148,765 rows; the only manifest carrying both a clip `path` and vote counts |
| Clip durations | `clip_durations.tsv` | 366,508 rows mapping clip filename → duration in ms |
| Audio | `clips/*.mp3` | 366,508 files; only the ~100 selected clips are copied into `MEDIA_ROOT` |
| MVP dataset | JSON file | `data/processed/mvp_dataset.json`, produced by the ingestion script |
| MVP count | 100 exercises | Selected by the criteria below |
| Database | PostgreSQL | `exercises`, `progress` tables with FK relationships |

### Why not `validated_sentences.tsv`

An earlier draft named `validated_sentences.tsv` as the MVP source with an
`up_votes >= 2` filter. That is not implementable: the file's columns are
`sentence_id, sentence, variant, sentence_domain, source, is_used, clips_count` —
**no `up_votes` and no clip path**. It is a sentence list, not a clip manifest, so
it can never yield a playable exercise. `validated.tsv` carries `client_id, path,
sentence_id, sentence, sentence_domain, up_votes, down_votes, age, gender, accents,
variant, locale, segment` and is the correct source.

### MVP selection criteria

| Criterion | Value |
|---|---|
| Quality | `up_votes >= 2` and `down_votes == 0` |
| Sentence length | 10–25 characters inclusive |
| Clip duration | ≤ 6000 ms |
| Clip present | referenced `.mp3` exists under `clips/` |
| Uniqueness | one exercise per distinct sentence |

Measured against the corpus on disk: 132,153 rows pass the quality filter, and
after the length and duration filters **21,432 unique sentences** remain — ample
headroom to sample 100. Selection is deterministic: the same corpus and seed
produce the same 100 exercises every run.

### Difficulty is derived

Common Voice carries **no difficulty field**. `difficulty` (1–5) is computed at
ingestion time from sentence character length and clip duration, the two available
proxies for how hard a sentence is to type by ear. The derivation inputs are stored
so the score can be recomputed when a better model (tone-mark density, cluster
complexity) replaces the coarse one.

## Project Structure

`TypeLearn/` (this repo — specs + scaffolding only, code generated with CLI commands from roadmap M1)

```
TypeLearn/
├── specs/                         # Spec files (this directory)
│   ├── mission.md
│   ├── roadmap.md
│   └── tech-stack.md
├── openspec/                      # Normative capability specs and changes
├── .gitignore                     # data/, __pycache__, .venv/, db.env, node_modules/
└── README.md                      # Clone this, run M1 commands, you have a running app
```

After running M1 commands, the code tree becomes:

```
TypeLearn/
├── specs/                         # Background docs (this directory)
│   ├── mission.md
│   ├── roadmap.md
│   └── tech-stack.md
├── openspec/                      # Normative capability specs and changes
├── src/
│   ├── backend/
│   │   ├── manage.py
│   │   ├── pyproject.toml
│   │   ├── typelearn/
│   │   │   ├── settings.py
│   │   │   ├── urls.py
│   │   │   └── wsgi.py
│   │   └── exercises/
│   │       ├── models.py
│   │       ├── schema.py
│   │       └── utils.py
│   └── frontend/
│       ├── package.json
│       ├── vite.config.js
│       └── src/
│           ├── main.js
│           ├── App.vue
│           └── components/
├── podman-compose.yml             # PostgreSQL service
├── db.env                         # POSTGRES_PASSWORD, POSTGRES_DB
├── data/                          # Large files, .gitignore'd
│   ├── processed/                 # mvp_dataset.json
│   └── media/                     # MEDIA_ROOT — the ~100 selected clips
└── .gitignore
```

The Common Voice corpus is **not** part of this tree. It lives outside the
repository in the release directory `cv-corpus-25.0-2026-03-09/`, is
read in place by the ingestion script, and only the selected clips are copied into
`data/media/`. The corpus path is a parameter of the ingestion script, not a
hardcoded constant.

## Data Model (MVP)

### `Exercise`

```python
class Exercise(models.Model):
    sentence = CharField(max_length=255, unique=True)   # Thai text to type
    sentence_id = CharField(max_length=64, blank=True)  # Common Voice source ID
    original_audio = FileField()                        # Path to audio clip
    up_votes = IntegerField(default=0)                  # Validation quality indicator
    difficulty = IntegerField(default=1)                # 1-5 scale, derived at ingestion
    created_at = DateTimeField(auto_now_add=True)
```

Every `CharField` declares an explicit `max_length`. Django raises system check
error `fields.E120` for a `CharField` without one, and that check blocks *every*
management command — `migrate`, `test`, `runserver` included.

### `Progress`

```python
class Progress(models.Model):
    exercise = ForeignKey(Exercise, on_delete=CASCADE)
    typed_text = CharField(max_length=255)
    is_correct = BooleanField()
    attempts = IntegerField(default=0)
    created_at = DateTimeField(auto_now_add=True)
```

## API Contract

### GraphQL Schema

```graphql
type Exercise {
  id: ID!
  sentence: String!
  sentenceId: String
  audioUrl: String!
  upVotes: Int!
  difficulty: Int!
}

type Query {
  exercises(limit: Int): [Exercise!]!
  exercise(id: ID!): Exercise
}
```

**Field names are camelCase.** Strawberry applies `auto_camel_case` by default, so
the Python fields `sentence_id`, `audio_url`, and `up_votes` are published as
`sentenceId`, `audioUrl`, and `upVotes`. This project does **not** disable that
default — camelCase is the GraphQL convention and what client tooling expects — so
a query written in snake_case fails validation with "Cannot query field".

### Client API

| Action | Query / Mutation |
|---|---|
| Load next exercise | `{ exercises { id sentence audioUrl difficulty } }` |
| Load a single exercise | `{ exercises(limit: 1) { id sentence audioUrl } }` |
| Record attempt | (client-side only for MVP, no backend write) |
| Replay audio | `<audio src="{exercise.audioUrl}">` |

### Data flow

1. `GET { exercises }` → returns 100 exercises from DB
2. Frontend picks one → displays `sentence` in large text
3. User presses play → HTML5 `<audio>` loads from `audioUrl`
4. User types via virtual keyboard → `typed` ref updates
5. User presses Check → compares `typed` with `expected.sentence` client-side
6. Result shown → on correct: picks next exercise automatically

## Technology Decisions

| Tool | Status | Rationale |
|---|---|---|
| Podman / podman-compose | **In** — local development | Preferred runtime for the PostgreSQL 17 container; rootless, daemonless, no Docker needed |
| Django REST Framework | Out | Switched to Strawberry GraphQL — less boilerplate, type safety |
| pip / pip-tools | Out | Chose Poetry for dependency management |
| psycopg2 | Out | Outdated; chose psycopg3 for async support |
| Docker / Kubernetes | Out of MVP scope | Adds deployment complexity before product validation |
| Redux / Vuex | Out | Chose Pinia as the official Vue state management library |
| Nginx / Caddy | Out of MVP scope | No deployment until MVP product validation succeeds |
