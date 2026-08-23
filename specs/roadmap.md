# Roadmap

> **Background document.** `openspec/specs/` is normative for required behavior.
> This file records milestone sequencing and the decision log.

## Phase 1: MVP — Milestones

Each milestone delivers a testable unit. Start from the first, stop only after the last completes the core loop.

### M1: Skeleton — done

Create the repo structure, project scaffolds, and runtime configs. No code runs yet.

| Action | Command | Reference |
|---|---|---|
| Init Django project | `django-admin startproject typelearn` | [Django 5.x docs](https://docs.djangoproject.com/en/stable/intro/) |
| Init Django app | `python manage.py startapp exercises` | [Django app docs](https://docs.djangoproject.com/en/stable/intro/tutorial01/) |
| Init Poetry | `poetry init -n --name typelearn-backend` | [Poetry docs](https://python-poetry.org/docs/) |
| Add Poetry deps | `poetry add django strawberry-graphql-django strawberry psycopg[binary] django-cors-headers gunicorn Pillow pytest pytest-django` | [Poetry add docs](https://python-poetry.org/docs/cli/#poetry-add) |
| Init Vue frontend | `npm create vue@latest frontend -- --default` | [Vue docs](https://vuejs.org/guide/quick-start.html) or `npm create vite@latest frontend -- --template vue` |
| Add Vue deps | `npm install pinia`, `npm install -D tailwindcss @tailwindcss/vite` | [Tailwind CSS Vite guide](https://tailwindcss.com/docs/installation/using-vite) |
| Wire Tailwind | Add `tailwindcss()` to `plugins` in `vite.config.js`, then `@import "tailwindcss";` in the main stylesheet | Tailwind 4 has no `init` command and needs no `tailwind.config.js` or PostCSS/autoprefixer setup |
| Init podman network | `podman network create typelearn-net` | [Podman docs](https://docs.podman.io/) |
| Prepare podman-compose files | Create `podman-compose.yml` defining `db` service with `postgres:17` image, `typelearn-net` network, and persistent volume; add `db.env` with `POSTGRES_PASSWORD` and `POSTGRES_DB` | [podman-compose docs](https://github.com/containers/podman-compose) |
| Create `.gitignore` | Exclude `data/`, `__pycache__`, `.venv/`, `db.env`, `node_modules/` | |

The Django project is named `typelearn`, not `thai_learn` — the app is designed for
any language and Thai is only the first dataset.

### M2: Exercise model + DB + data load — done

The data comes first: every later milestone queries it. (This was M7 in the original
plan, which put the GraphQL query five milestones ahead of the model it reads.)

- [x] `Exercise` model — `sentence` (`CharField(max_length=255, unique=True)`),
      `sentence_id`, `original_audio` (FileField), `up_votes`, `difficulty`, `created_at`
- [x] `Progress` model — `exercise` (FK), `typed_text` (`CharField(max_length=255)`),
      `is_correct`, `attempts`, `created_at`
- [x] `python manage.py check` passes with no `fields.E120` error
- [x] Migration created and applied against the Podman PostgreSQL container
- [x] Ingestion script reads `validated.tsv` from the corpus path (a parameter, not a
      constant) and selects 100 exercises: `up_votes >= 2`, `down_votes == 0`,
      sentence 10–25 chars, clip ≤ 6000 ms, clip file present, one per distinct sentence
- [x] `difficulty` derived from sentence length and clip duration, 1–5
- [x] The 100 referenced `.mp3` clips copied into `MEDIA_ROOT`
- [x] Re-running ingestion does not duplicate rows or raise a uniqueness error
- [x] 100 `Exercise` rows in the DB, each with playable audio on disk

### M3: GraphQL query

One query that returns the 100 exercises from M2 with audio URLs.

- [x] `schema.py` — `@strawberry_django.type(Exercise)` query `exercises` returning `Exercise`
- [x] Endpoint `/graphql/` serving introspection
- [x] Query `{ exercises { sentence upVotes } }` returns JSON
      (camelCase — Strawberry's `auto_camel_case` is on by default and not disabled here)
- [x] `exercises(limit: Int)` argument works, so the frontend can fetch one
- [x] `audioUrl` resolves to an absolute URL an `<audio>` element can load cross-origin
- [x] CORS configured so the Vite dev origin can query the endpoint

### M4: Frontend skeleton + sentence display

Vue app mounts, fetches one exercise, displays its sentence.

- [x] Vue app mounts at `/` with no error
- [x] Component `SentenceView` fetches `{ exercises(limit: 1) }`
- [x] Renders Thai sentence in large text
- [x] Renders length hint below it

### M5: Audio playback

Click a button → play the clip served from `MEDIA_ROOT`.

- [x] Component `AudioPlayer` mounted beneath sentence display
- [x] Button triggers `<audio>` element playback
- [x] Audio URL comes from GraphQL `audioUrl` field
- [x] Replay restarts playback from the beginning

### M6: Thai keyboard + input — done

Type text on the virtual keyboard, see it appear in an input field.

- [x] Component `ThaiKeyboard` renders the Kedmanee layout — the standard Thai
      keyboard — in four staggered rows, with a Shift layer
- [x] Clicking a key appends the character to the store's `typed` state
- [x] Active (next expected) key is highlighted visually, and the displayed layer
      switches on its own to whichever layer holds it
- [x] Input field reflects `typed` value in real time
- [x] Physical-keyboard input updates the same state

### M7: Validation — done

Compare typed text against the target exercise sentence and show result.

- [x] On pressing "Check" (or Enter), compare `typed` with `exercise.sentence`
- [x] Show green "Correct" or red "Incorrect — try again"
- [x] On correct: auto-load the next exercise
- [x] On incorrect: reveal the correct answer and let the user continue
- [x] No `Progress` row is written — checking stays client-side for the MVP

---

### Core loop is complete at the end of M7 — done:

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
| Looped Thai typeface | Bundle a looped face so letter heads are legible to a beginner | Phase 1 |
| Audio plays on presentation | Hear the clip before typing, so the loop is listening and not copying | Phase 1 |
| Automatic answer checking | Check when the answer reaches the target's length | Phase 1 |

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
| 2026-08-21 | Model and data load move before the GraphQL milestone | M2 claimed to return 100 exercises from a model M7 created; each milestone must depend only on earlier ones |
| 2026-08-21 | Corpus source is `validated.tsv`, not `validated_sentences.tsv` | The latter has no `up_votes` and no clip path, so the documented filter could never yield a playable exercise |
| 2026-08-21 | Difficulty derived from sentence length + clip duration | Common Voice carries no difficulty field; a linguistic model needs learner validation and can replace this later |
| 2026-08-21 | GraphQL contract written in camelCase | Strawberry's `auto_camel_case` is on by default; matching it beats disabling a well-known default |
| 2026-08-21 | Django project named `typelearn` | Honors the 2026-04-21 language-neutral naming decision that `thai_learn` contradicted |
| 2026-08-21 | Podman stays in for local development | Confirmed after a draft edit marked it out of scope; keeps local dev on the documented PostgreSQL 17 target instead of diverging onto SQLite |
| 2026-08-22 | Repository renamed ToneType → TypeLearn | The app was named TypeLearn in every document and code-level name; only the folder and GitHub repo still said ToneType |
| 2026-08-21 | `openspec/specs/` is normative; `specs/` is background | Requirements get a testable home; mission narrative and decision log stay readable prose |
| 2026-08-22 | Corpus selection is a deterministic sort, not a seeded sample | The spec asked for "the same seed" without defining one, so two runs with different seeds could both comply while producing different datasets; ordering by up_votes desc, duration asc, sentence_id asc makes the 100 exercises a pure function of the corpus |
| 2026-08-23 | Thai renders in a bundled looped face, not the system default | A beginner identifies Thai letters by the head — the loop most consonants open with — and `system-ui` resolves to a loopless face on many systems, erasing the cue the learner depends on |
| 2026-08-23 | The font is self-hosted via Fontsource, not the Google Fonts CDN | An external request on every load, a privacy surface, and a broken app offline, all to avoid one dependency that carries no code |
| 2026-08-23 | The clip plays automatically when an exercise is presented | The core loop is *hear* then type; a clip that waits to be asked for lets the learner read and copy instead |
| 2026-08-23 | An answer is checked when it reaches the target's length | Pressing a key to be told what the app already knows carries no information; Enter and the Check control stay for checking early |
| 2026-08-23 | The incorrect verdict no longer reveals the expected sentence | `SentenceView` displays it at `text-5xl` throughout, so the reveal duplicated it — and it was the tallest variable-height element pushing the keyboard down mid-exercise |
