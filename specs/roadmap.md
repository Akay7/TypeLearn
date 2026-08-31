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
| 2026-08-28 | Local development moves from podman-compose to kind + Tilt | Only the database was containerized, so the backend and frontend ran on the host as two origins — which is the sole reason the backend needed CORS at all. The whole stack now runs the way a deployment would |
| 2026-08-28 | The app is served from one origin through a Gateway, and `django-cors-headers` is deleted | A Gateway routes `/graphql/`, `/media/`, `/admin/`, and `/static/` to Django and everything else to the frontend, so the browser only ever sees one origin and there is no cross-origin request left to permit |
| 2026-08-28 | Calico provides both the CNI and the Gateway API | One project owning networking and ingress rather than two; enabling it provisions `tigera-gateway-class`, which the project's Gateway binds to |
| 2026-08-28 | PostgreSQL runs under CloudNativePG, pinned to 17 | The operator a deployment would use, so the manifest describes a database rather than a pod running one. Pinned to 17 because the specs say 17; CNPG's own default is newer |
| 2026-08-28 | The audio is one host directory shared by every worktree | The clips are a deterministic function of the corpus, so a copy per worktree would be gigabytes and minutes spent producing identical files. Kubernetes cannot share a PV across namespaces, so each worktree gets its own PV over the same node path |
| 2026-08-28 | Either container runtime backs kind, as long as Tilt builds through the same one | Tilt builds via `DOCKER_HOST` and kind loads via `KIND_EXPERIMENTAL_PROVIDER`; a mismatch silently produces images the cluster cannot pull, so the Tiltfile refuses to start on one. Podman requires kind 0.33+ — 0.32 cannot drive podman 6 at all — which keeps the 2026-04-21 Podman preference available rather than overriding it |
| 2026-08-28 | CI builds each image once, tests inside it, and publishes by retagging | Nothing is rebuilt between passing and shipping, so the artifact that was tested is the artifact that ships |
| 2026-08-28 | The Tilt UI port is fixed at 10350; only the application's port moves per worktree | Tilt is the tool you have open, not something the project serves, so its URL should not change with the checkout. The application is the opposite — several worktrees serve at once, so each needs its own port. `TILT_PORT` still overrides for the rare case of two Tilts at once |
| 2026-08-28 | Tilt is launched directly, with the runtime exports documented rather than wrapped in a script | Following the reference project: `.envrc` (direnv) pins a worktree's offset and the README states the exports each container runtime needs. The Tiltfile fails on a builder/provider mismatch instead of a wrapper forcing one runtime, since either runtime works as long as both sides agree |
| 2026-08-29 | A Helm chart replaces kustomize as the only description of the stack | An environment became a values file rather than an overlay patching the same fields. Rendering the old prod overlay for the first time found three patches that did not do what they said — an `env: []` that never removed the dev server's variable, a `ports` patch that merged instead of replacing, and a development hostPath PV left in production with its placeholders unsubstituted — plus no ConfigMap at all, so it could never have installed |
| 2026-08-29 | Development renders the same chart a deployment installs | Tilt generates its values from `.env` and passes the worktree's namespace, slug, and port as values. The three string substitutions the Tiltfile used to perform on rendered YAML are gone, so the class of bug where a renderer stripped a port's quotes is impossible rather than fixed |
| 2026-08-29 | Configuration and secrets are separate maps, and the chart can own neither | `env` renders a ConfigMap, `secrets` renders a Secret, and `existingSecret` names one the chart neither creates nor copies — because values are readable by anyone who can read the release. The database's credentials stay in neither: CloudNativePG generates them and the backend reads five keys by explicit reference |
| 2026-08-29 | The in-cluster database is optional, and its volume outlives the release | `postgres.enabled: false` points the backend at an external database, so a managed Postgres is a values change rather than a fork. The Cluster carries `helm.sh/resource-policy: keep`: an application that deletes its own database on uninstall is one mistyped command from an outage |
| 2026-08-29 | The backend's package manager moves from Poetry to uv | `pyproject.toml` was already PEP 621 with a `[tool.uv]` section, so both tools had been half-configured against one project and two lockfiles were tracked. uv is the one kept: re-locking produced identical versions for every dependency and dropped a `django-cors-headers` entry the stale lock still carried. The image installs with `uv sync --locked`, so a lockfile that has drifted from `pyproject.toml` fails the build instead of silently resolving something else |
| 2026-08-29 | The frontend addresses the backend by path, and the dev server proxies it | The built-in fallback was `http://localhost:8000/graphql/` — a second origin, against a backend carrying no CORS configuration — so running the frontend on the host could never have loaded the catalog. The dev server now proxies the same four prefixes the Gateway routes, so one origin holds whether the frontend runs in the cluster or on the host, and Vite's own `Access-Control-Allow-Origin` is switched off rather than left advertising a permission the API does not have |
| 2026-08-30 | The backend is debugged in the container, not on the host | Running it on the host meant forwarding the database and copying a generated password out of the cluster, and what got debugged was a reconstruction that differed from the artifact — no gunicorn, DEBUG on, Django serving media. It was built before being abandoned: `kubectl port-forward` against this cluster exits the moment one forwarded connection closes, which no supervision fixes because clients do not retry. A debugger needs one long-lived connection instead of many short ones, so attaching to the pod sidesteps the failure entirely and removes the reason to expose the database at all |
| 2026-08-31 | Neither container runtime is forced; `.envrc` completes whichever is chosen | kind 0.33 drives podman 6 properly, so the temporary Docker pin had nothing left to work around. Naming one side is now enough — set `KIND_EXPERIMENTAL_PROVIDER=podman` and `.envrc` supplies `DOCKER_HOST` and `DOCKER_BUILDKIT=0`, or point `DOCKER_HOST` at podman's socket and it tells kind to match. The invariant is unchanged and still enforced by the Tiltfile: the two sides must agree |
| 2026-08-31 | Calico's CRDs are applied from their own manifest, before the operator | Calico stopped shipping CRDs inside `tigera-operator.yaml` — at v3.32 that file defines none and `operator-crds.yaml` defines all 32 — so a fresh cluster got a Deployment with no `Installation` kind to give it, and `kubectl wait` failed with a bare NotFound because it errors on a resource that does not exist rather than waiting for one. Invisible locally, because the bootstrap is gated on that CRD already existing; only CI and a first run ever executed the path |
| 2026-08-29 | `tilt up` refuses a cluster that is not this project's | Every kind cluster looks equally local to Tilt, so with another project's context selected it would deploy this stack there and leave a namespace and a database behind. The same class of quiet wrongness the container-runtime guard already covers |
