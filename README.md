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

`kind` 0.33+, `tilt`, `kubectl`, `helm`, and a container runtime — **Docker or
rootless Podman, whichever you already use.** Nothing here forces one.

```bash
direnv allow    # once after cloning
```

**The one rule is that both sides agree.** Tilt builds images through
`DOCKER_HOST`; kind loads them into the cluster through
`KIND_EXPERIMENTAL_PROVIDER`. If those name different runtimes the build
succeeds, the load quietly finds nothing, and the cluster tries to pull
`typelearn-backend` from Docker Hub. The Tiltfile refuses to start on a mismatch
rather than let you discover it as an `ImagePullBackOff`.

You only have to name the runtime once — `.envrc` completes the other side, so
the two cannot end up half-configured. For Podman:

```bash
systemctl --user enable --now podman.socket    # once
export KIND_EXPERIMENTAL_PROVIDER=podman       # in your shell profile, or .envrc.local
```

`.envrc` then points `DOCKER_HOST` at Podman's socket and sets
`DOCKER_BUILDKIT=0`, because Podman's API implements no BuildKit gRPC session.
Setting `DOCKER_HOST` yourself works the same way round: kind is told to match.
Set neither and both sides are Docker.

> **Podman needs kind 0.33 or newer.** kind 0.32 cannot drive podman 6 at all:
> `kind get clusters` fails with a template error, because podman 6 reports
> container labels as a list where kind expects a map. 0.33 fixes it.

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
tilt up
```

That builds both images, installs what the cluster is missing the first time
(Calico for the CNI and the Gateway API, CloudNativePG for PostgreSQL), renders
[`chart/`](chart/) with values generated from `.env`, and serves the app at
**http://localhost:8500**. Editing backend
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

Each git worktree gets its own namespace, its own database, its own application
port, and its own Tilt UI port, all derived from the worktree's directory name:

Worktrees live in `.worktrees/`, inside the repository, so they travel with it
and are easy to find. That directory is git-ignored — a worktree is a full
checkout and must never be seen as content of the checkout containing it — and
also listed in `.tiltignore`, so an edit in one is not read as a change to every
other one's build context.

```bash
git worktree add .worktrees/something -b feat/something
cd .worktrees/something && direnv allow && tilt up
#   application → http://localhost:8505
#   Tilt UI     → http://localhost:10355   (10350 + the same offset)
```

The offset comes from the directory name, so `.worktrees/something` and a
worktree of that name anywhere else resolve identically; nesting changes where
they live, not what they are.

`scripts/worktree-env.sh export` prints what a checkout resolves to. The
application port is `8500 + offset` and the Tilt UI is `10350 + offset`; the main
checkout is offset 0, so it keeps the bare `8500` and Tilt's default `10350`.
`.envrc` sets `TILT_PORT` from that derivation — Tilt binds its web server before
it reads the Tiltfile, so the port has to be in the environment — which is why
`direnv allow` matters in a fresh worktree. Every worktree's `tilt up` then stays
attached at once, each syncing source into its own pods.

Only one thing is deliberately *not* per-worktree: the audio. Every worktree
reads the one `data/media`, so ingestion is done once rather than per checkout.

Pin a worktree's offset — and so its namespace and both ports — by copying
`.envrc.local.example` to `.envrc.local` in it. `.envrc` itself is committed and
carries the runtime settings every checkout shares; `.envrc.local` is ignored, so
pinning an offset does not leave your checkout looking modified. To move just the
Tilt port, set `TILT_PORT` directly, the same way `GATEWAY_PORT` moves just the
application port.

Everything else is isolated — an exercise ingested in one worktree is invisible
to another.

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

### Working on one piece at a time

Everything runs in the cluster and source is synced into the pods, so ordinary
editing needs nothing on your machine.

**The frontend, on the host.** For fast HMR against real exercises. Nothing to
set up: the dev server proxies `/graphql/`, `/media/`, `/admin/` and `/static/`
to the Gateway `tilt up` already forwards, so the browser sees one origin exactly
as it does in the cluster — no second backend, no database, no credentials.

```bash
cd src/frontend && npm run dev        # http://localhost:5173
```

**The backend, under a debugger — in the container.** The debugger attaches to
the pod rather than to a copy of the application on your machine, so what you
step through is the image a deployment runs, with its environment, its database
and the Gateway in front of it. Nothing is reconstructed, so nothing about the
reconstruction can differ.

```bash
echo 'export TYPELEARN_DEBUG_BACKEND=1' >> .envrc.local && direnv allow
tilt up
```

The backend then runs under `debugpy` and Tilt forwards the attach port (5678,
plus this worktree's offset). In VS Code, pick **Backend: attach to the
container**. Nothing waits for you — the stack serves whether or not you attach.

Under the debugger the backend runs Django's own server rather than gunicorn:
gunicorn forks its workers, so a breakpoint in request handling would sit in a
child the debugger never sees. Everything else is identical.

**Backend tests run in the pod** — the "Run backend tests" button, which is the
same place CI runs them, inside the image it built. There is deliberately no way
to run them on your machine: the database is not exposed, and a green result
somewhere else would mean less.

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

## Installing it somewhere

The stack is one Helm chart in [`chart/`](chart/), and it is not a second
description of the manifests — it *is* the manifests. `tilt up` renders the same
chart with development values, so a template that works locally is a template a
deployment installs.

### What the cluster must already have

The chart installs the application and nothing cluster-scoped. Those are shared
by every release, so a chart that installed them would fight any other chart that
did, and uninstalling one application would take the cluster's networking with
it. Before installing, a cluster needs:

- **a Gateway API implementation** providing the GatewayClass named in
  `gateway.className` (locally, Calico's `tigera-gateway-class`);
- **the CloudNativePG operator**, unless `postgres.enabled: false`.

The chart checks for both and fails by name rather than leaving resources that
never become ready.

### Installing

```bash
cp chart/values-prod.yaml.example my-values.yaml   # then edit it
helm install typelearn ./chart \
  --namespace typelearn --create-namespace \
  --values my-values.yaml
```

What a deployment actually has to decide is image tags, a hostname, storage
classes and sizes, and where its secret comes from. Everything else already
defaults to the deployment-shaped answer: debug off, the frontend serving the
built bundle, and no development affordance switched on.

### Configuration and secrets

Every backend environment variable is settable from values, so adding a setting
never means editing a template:

```yaml
env:
  DJANGO_DEBUG: "false"
  ANY_NEW_SETTING: "value"
```

Secrets are a different map, and which one you use matters:

| | Use it when | What it does |
|---|---|---|
| `secrets:` | A throwaway environment | Renders a Secret from the values. The value is then in the release — anyone who can run `helm get values` can read it |
| `existingSecret:` | Anything that matters | Names a Secret the chart neither creates nor copies. Its keys become the backend's environment |

```bash
kubectl create secret generic typelearn-secrets \
  --from-literal=DJANGO_SECRET_KEY="$(openssl rand -base64 48)"
helm install typelearn ./chart --set existingSecret=typelearn-secrets ...
```

The database's own credentials are in neither. CloudNativePG generates them and
the backend reads five keys straight out of that Secret, so they appear in no
values file and no template.

### The database

`postgres.enabled: true` provisions one through CloudNativePG, sized and classed
from values. It carries `helm.sh/resource-policy: keep`, so `helm uninstall`
removes the workloads and leaves the data — recovering from a stray Cluster is
one `kubectl delete`, and recovering from a deleted database is not.

`postgres.enabled: false` creates none and points the backend at
`externalDatabase` instead, so a managed Postgres is a values change rather than
a fork of the chart.

### Rendering before installing

The chart renders without a cluster, which is what makes it reviewable:

```bash
helm template typelearn ./chart --values my-values.yaml \
  --api-versions gateway.networking.k8s.io/v1 \
  --api-versions postgresql.cnpg.io/v1
```

The `--api-versions` flags stand in for the cluster's own: rendering offline
otherwise trips the prerequisite checks above. CI renders every branch the chart
offers on every change, so a template that does not render fails before anything
is built.

## Working on this project

Planning runs through [OpenSpec](openspec/): `openspec list` shows active changes,
and `specs/roadmap.md` tracks milestone progress.
