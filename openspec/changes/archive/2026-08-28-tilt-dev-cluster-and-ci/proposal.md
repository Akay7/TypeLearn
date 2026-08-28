## Why

Two gaps, and they are the same gap seen from two ends.

**Nothing runs the tests.** There is no `.github/` at all, while the suite has
grown to 61 unit tests, 29 browser tests, and a backend pytest run. They pass
when someone remembers to ask.

**Local development looks nothing like a deployment.** `podman-compose` starts
one container — PostgreSQL — and everything else runs loose on the host: Django
on `:8000`, Vite on `:5173`. Because those are two origins, the backend carries
`django-cors-headers` and an allow-list of loopback spellings purely to let the
frontend talk to it, and `audioUrl` is documented as absolute *because* the
clips are served from another host. None of that exists in a real deployment,
where one origin serves both — so the app is configured for a topology it will
never ship in, and the first deploy would be the first time anyone tried the
real one.

The repository also uses git worktrees, and today a second worktree cannot run:
`:5432`, `:8000`, and `:5173` are already taken by the first.

## What Changes

- **BREAKING** `podman-compose.yml` and `db.env` are removed. Local development
  becomes `tilt up` against a local `kind` cluster running PostgreSQL, the
  backend, and the frontend.
- **The stack is reached through one origin.** A Gateway routes `/graphql/`,
  `/media/`, `/admin/`, and `/static/` to Django and everything else to the
  frontend. Because the browser sees one origin, **`django-cors-headers` is
  removed entirely** — dependency, middleware, and settings.
- **Each worktree gets its own namespace and its own port**, derived from the
  worktree's directory name, so several checkouts run at once in one cluster.
  The Gateway is the only thing exposed to the host — there is no database port,
  because everything reaches the database from inside the cluster.
- **The cluster runs production's components where it matters**: Calico for the
  CNI and for the Gateway API implementation, and CloudNativePG for PostgreSQL.
  Storage is the deliberate exception — see below.
- **The audio is stored once for the whole cluster**, on a directory mounted in
  from the host, which every worktree's backend mounts through its own
  PersistentVolume. Each worktree keeps its own database, so the apps stay
  independent; only the audio is shared, so ingesting the clips is done once
  rather than per checkout — and because the directory lives on the host, once
  ever, surviving even a deleted cluster.
- **The frontend runs `vite dev` in-cluster** with source synced, so hot reload
  survives the move; a production overlay swaps in an nginx image serving the
  built bundle.
- **CI on GitHub Actions**: build both images once, run ruff-free backend pytest
  inside the built backend image, vitest and the Playwright suite for the
  frontend, and bring the whole stack up in a kind cluster to smoke-test it
  through the Gateway.

## Capabilities

### New Capabilities

- `continuous-integration`: what runs automatically on a push or pull request,
  what has to pass before a merge, and the rule that the artifact which was
  tested is the artifact that gets published.

### Modified Capabilities

- `local-dev-environment`: the "PostgreSQL runs in a Podman container"
  requirement is **removed** and replaced by requirements for the Tilt/kind
  cluster, the single-origin Gateway, per-worktree isolation, and the cluster
  components the Tiltfile provisions.
- `exercise-api`: the "Cross-origin requests from the dev frontend are allowed"
  requirement is **removed** — the frontend is no longer a separate origin —
  and the `audioUrl` requirement keeps its guarantee but loses the cross-origin
  reasoning that justified it.

## Impact

- **New files**: `Tiltfile`, `k8s/` manifests, `scripts/worktree-env.sh`,
  `src/backend/Containerfile`, `src/frontend/Containerfile`,
  `.github/workflows/ci.yml`, a kind cluster config.
- **Removed**: `podman-compose.yml`, `db.env`, `db.example.env`,
  `django-cors-headers` from `pyproject.toml`, and the CORS block in
  `settings.py`.
- **Changed**: `settings.py` (database and media configuration read from the
  environment the cluster supplies), `.env` handling, `VITE_API_URL` becomes a
  same-origin path, and the README's entire "Local setup" section.
- **Developer prerequisites** grow: `kind`, `tilt`, `kubectl`, and `helm` join
  Podman/Docker. All four are already present on the primary development
  machine.
- **No new host packages.** The database uses the StorageClass kind already
  ships, and the audio is a mounted directory, so nothing has to be installed
  with root and nothing has to be proved to work on kind.
- **One deliberate divergence from production**: hostPath storage for the audio.
  Nothing else in this change asks development to differ from a deployment, and
  the production overlay names a real StorageClass instead.
- Ingestion still takes the corpus path as a parameter, but now has to reach a
  pod; the corpus stays outside the repository and is never copied into an image.
- No application behaviour changes. The exercise catalog, the keyboard, the
  checking logic, and every existing test are untouched.
