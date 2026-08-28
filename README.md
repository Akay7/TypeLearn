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

The whole application runs in a local Kubernetes cluster, on one origin, the way
a deployment would. That is why the backend carries no CORS configuration at all:
the Gateway serves the SPA, the GraphQL endpoint, and the audio from the same
address, so there is no cross-origin request to permit.

### Prerequisites

`docker`, `kind`, `tilt`, `kubectl`, and `helm`. Podman is still fine for
everything else, but **kind must drive Docker**: kind 0.32 cannot drive podman 6
— its `ps --format` template errors — so `scripts/tilt-up.sh` sets
`KIND_EXPERIMENTAL_PROVIDER=docker` for you. If you run `tilt` directly, export
it yourself or Tilt will build images the cluster cannot pull.

### 1. Create the cluster

Once per machine. Every worktree shares it.

```bash
kind create cluster --config "$(scripts/kind-config.sh --write)"
```

The config is generated rather than committed: it mounts `data/media` (the
ingested clips) and, if you set `TYPELEARN_CORPUS_DIR`, the Common Voice release.
Both paths differ per machine, so neither is written into the repository.

### 2. Bring the stack up

```bash
cp .env.example .env      # the Tiltfile does this for you if you forget
scripts/tilt-up.sh
```

That builds both images, installs what the cluster is missing the first time
(Calico for the CNI and the Gateway API, CloudNativePG for PostgreSQL), applies
the manifests, and serves the app at **http://localhost:8500**. Editing backend
Python or frontend source reaches the running pods without a rebuild.

The first run takes a few minutes, mostly waiting for Calico. Later runs skip the
bootstrap.

### 3. Load exercises

Ingestion needs a local Common Voice release directory
(`cv-corpus-25.0-2026-03-09` for Thai). It stays outside the repository and is
never committed — point the cluster at it before creating the cluster:

```bash
export TYPELEARN_CORPUS_DIR=/path/to/cv-corpus-25.0-2026-03-09
```

Then press **Ingest the corpus** in the Tilt UI. It selects 100 exercises from
`th/validated.tsv`, derives each one's difficulty, and copies the referenced
clips into the shared media volume. The selection is deterministic — the same
corpus always yields the same 100 exercises — and it is safe to re-run.

The clips live in `data/media` on the host, shared by every worktree and outliving
the cluster, so this only has to happen once even if you delete and recreate the
cluster. They are written by the container and owned by a mapped user id; the
Tiltfile keeps the directory writable so you can still remove them yourself.

### Running several worktrees at once

Each git worktree gets its own namespace, its own database, and its own port,
derived from the worktree's directory name:

```bash
git worktree add ../TypeLearn-feature -b feat/something
cd ../TypeLearn-feature && scripts/tilt-up.sh   # e.g. http://localhost:8517
```

`scripts/worktree-env.sh export` prints what a checkout resolves to. The audio is
deliberately *not* per-worktree: all of them read the one `data/media`, so
ingestion is done once rather than per checkout. Everything else is isolated —
an exercise ingested in one worktree is invisible to another.

### Running commands and tests

No database port is exposed; the database is reached from inside the cluster. The
Tilt UI has buttons for migrations, the backend test suite, and ingestion. The
frontend suites run on the host:

```bash
cd src/frontend
npm install
npm run test              # vitest, over the pure logic in src/lib/ and the store
npm run test:e2e          # playwright, driving Chromium against its own dev server
```

The e2e suite needs no backend and no cluster: it stubs the GraphQL catalog and
synthesises its own audio clip. The first run downloads Chromium —
`npx playwright install chromium`.

`VITE_API_URL` is a same-origin path (`/graphql/`), because the Gateway routes
that prefix to Django. There is no other origin to point it at.

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
