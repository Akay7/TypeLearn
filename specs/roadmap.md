# Roadmap

## Phase 1: MVP — Milestones

Each milestone delivers a testable unit. Start from the first, stop only after the last completes the core loop.

### M1: Skeleton

Create the repo structure, project scaffolds, and runtime configs. No code runs yet.

| Action | Command | Reference |
|---|---|---|
| Init Django project | `django-admin startproject thai_learn` | [Django 5.x docs](https://docs.djangoproject.com/en/stable/intro/) |
| Init Django app | `python manage.py startapp exercises` | [Django app docs](https://docs.djangoproject.com/en/stable/intro/tutorial01/) |
| Init Poetry | `poetry init -n --name typelearn-backend` | [Poetry docs](https://python-poetry.org/docs/) |
| Add Poetry deps | `poetry add django strawberry-graphql-django strawberry psycopg[binary] django-cors-headers gunicorn Pillow` | [Poetry add docs](https://python-poetry.org/docs/cli/#poetry-add) |
| Init Vue frontend | `npm create vite@latest frontend -- --template vue` | [Vue + Vite docs](https://vuejs.org/guide/quick-start) or `npm create vue@latest` |
| Add Vue deps | `npm install pinia` | [Vue docs](https://pinia.vuejs.org/) |
| Init podman network | `podman network create typelearn-net` | [Podman docs](https://docs.podman.io/) |
| Prepare podman-compose files | Create `podman-compose.yml` defining `db` service with `postgres:17` image, `typelearn-net` network, and persistent volume; add `db.env` with `POSTGRES_PASSWORD` and `POSTGRES_DB` | [podman-compose docs](https://github.com/containers/podman-compose) |
| Create `.gitignore` | Exclude `data/`, `__pycache__`, `.venv/` | |

### M2: GraphQL query

One query that returns all 100 exercises with audio URLs.

- [ ] `schema.py` — `@strawberry.type` query `exercises` returning `ExerciseNode`
- [ ] Endpoint `/graphql/` serving introspection
- [ ] Query `{ exercises { sentence up_votes } }` returns JSON

### M3: Frontend skeleton + sentence display

Vue app mounts, fetches one exercise, displays its sentence.

- [ ] Vue app mounts at `/` with no error
- [ ] Component `SentenceView` fetches `{ exercises(limit: 1) }`
- [ ] Renders Thai sentence in large text
- [ ] Renders length hint below it

### M4: Audio playback

Click a button → play the downloaded MP3.

- [ ] Component `AudioPlayer` mounted beneath sentence display
- [ ] Button triggers `<audio>` element playback
- [ ] Audio URL comes from GraphQL `audio_url` field

### M5: Thai keyboard + input

Type text on the virtual keyboard, see it appear in an input field.

- [ ] Component `ThaiKeyboard` renders rows of Thai consonants/vowels/symbols
- [ ] Clicking a key appends the character to a local `typed` ref
- [ ] Active (next expected) key is highlighted visually
- [ ] Input field reflects `typed` value in real time

### M6: Validation

Compare typed text against the target exercise sentence and show result.

- [ ] On pressing "Check" (or Enter), compare `typed` with `exercise.sentence`
- [ ] Show green "Correct" or red "Incorrect — try again"
- [ ] On correct: auto-load the next exercise
- [ ] On incorrect: reveal the correct answer and let the user continue

### M7: Exercise model + DB

Only now: persist data for exercises and progress.

- [ ] `Exercise` model with FK relationships for `original_audio` (FileField)
- [ ] `Progress` model — `exercise` (FK), `typed_text`, `is_correct`, `attempts`
- [ ] Migration created and applied
- [ ] All 100 MVP exercises in DB so the API query in M3 can return real data

---

### Core loop is complete at the end of M6:

See sentence → hear audio → type → check → feedback → next exercise.

That is the entire MVP.

## Phase 2: Expanded Practice

Add variety and usability.

| Item | Description | Depends on |
|---|---|---|
| Exercise picker | Filter by category, difficulty, verified | Phase 1 |
| Multiple exercises per session | Sequence of 10-20 questions | Phase 1 |
| Progress bar | Show how many done in session | Phase 1 |
| Skip and retry buttons | Skip ahead or replay the same | Phase 1 |
| Keyboard layout switching | Thai + source language overlay | Phase 1 |
| Correct answer reveal | Show what you missed | Phase 1 |
| Session summary | Score + stats at end | Phase 2 |

## Phase 3: Persistence & Accounts

Save user data and add personalization.

| Item | Description | Depends on |
|---|---|---|
| User registration | Email or OAuth | Phase 2 |
| User exercise accounts | Track completed exercises | Phase 2 |
| Persistent progress | Local storage or database | Phase 3 |
| Spaced repetition | Show words due for review | Phase 2 |
| Wrong-answer review queue | Focus on mistakes | Phase 3 |
| Stats dashboard | Accuracy over time, words learned | Phase 3 |

## Phase 4: Platform

Add features and scale.

| Item | Description | Depends on |
|---|---|---|
| Multiple language support | Spanish, Korean, etc. | Phase 3 |
| Community corpus uploads | Users submit new audio-text pairs | Phase 4 |
| Mobile app or PWA | Phone/tablet support | Phase 2 |
| Teacher mode | Set custom exercise sets for classes | Phase 4 |
| Docker Compose deployment | One-command setup | Phase 4 |
| CI/CD pipeline | Automated tests and deploy | Phase 4 |

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-21 | Start with Thai language | Largest Common Voice corpus available; user interest |
| 2026-04-21 | Use Django + Strawberry GraphQL over DRF | Less boilerplate, type safety, auto-GraphQL introspection |
| 2026-04-21 | Use Poetry over pip/pipenv/uv | Already installed, mature Django ecosystem support |
| 2026-04-21 | Use PostgreSQL with psycopg (binary) | ACID compliance, full-text search, FK integrity |
| 2026-04-21 | MVP has no Docker/k8s | Out of scope; use Podman for local dev instead |
| 2026-04-21 | PostgreSQL 17 (latest) | Latest stable version |
| 2026-04-21 | Podman for local development | Rootless, docker-compatible, recommended |
| 2026-04-21 | App name: TypeLearn (generic) | Multi-language future; avoid hardcoding "Thai" |
