# local-dev-environment Specification

## Purpose
TBD - created by archiving change align-specs-with-reality. Update Purpose after archive.
## Requirements
### Requirement: The stack runs on a local Kubernetes cluster
Local development SHALL run the whole application — database, backend, and
frontend — on a local `kind` cluster driven by Tilt, rather than a mixture of one
container and two host processes. A single command SHALL bring the stack up, and
a developer SHALL NOT have to start the backend or the frontend by hand.

#### Scenario: Starting the stack
- **WHEN** a developer runs `tilt up` in a checkout
- **THEN** PostgreSQL, the backend, and the frontend are deployed to the cluster,
  and the application is reachable in a browser once Tilt reports the resources
  green

#### Scenario: Code changes reach the running stack
- **WHEN** a developer edits backend Python or frontend source
- **THEN** the change reaches the running pod without a manual rebuild or
  redeploy — synced for the backend, and hot-reloaded by the dev server for the
  frontend

#### Scenario: Migrations run before the backend serves
- **WHEN** the backend starts against a database that has pending migrations
- **THEN** they are applied before the application container begins serving, and
  a database that is not yet accepting connections is waited for rather than
  treated as a failure

#### Scenario: Ingested clips survive a restart
- **WHEN** the backend pod is deleted and rescheduled
- **THEN** the audio clips under `MEDIA_ROOT` are still present, because the
  directory is a persistent volume rather than container-local storage

### Requirement: The application is served from one origin
The frontend and the backend SHALL be reached through a single origin in local
development, as they are in a deployment. A Gateway SHALL route the backend's
paths to the backend and everything else to the frontend. Consequently the
backend SHALL NOT carry any cross-origin configuration: local development must
not be the only environment where CORS is needed.

#### Scenario: One origin serves both
- **WHEN** the application is opened at the Gateway's address
- **THEN** the page, its assets, the GraphQL endpoint, and the audio clips are
  all served from that same origin

#### Scenario: The GraphQL request is not a cross-origin request
- **WHEN** the frontend queries the catalog
- **THEN** the browser issues a same-origin request, sends no preflight, and the
  response carries no CORS headers because none are required

#### Scenario: No CORS configuration remains
- **WHEN** the backend's dependencies and settings are read
- **THEN** there is no CORS package, no CORS middleware, and no allowed-origin
  list anywhere in them

#### Scenario: Backend paths reach Django
- **WHEN** a request arrives for the GraphQL endpoint, the media files, the
  Django admin, or Django's static files
- **THEN** the Gateway routes it to the backend, while every other path falls
  through to the frontend

### Requirement: Audio is stored once for the whole cluster
The clips under `MEDIA_ROOT` SHALL live on one store shared by every worktree,
rather than a copy per namespace. The corpus is gigabytes and ingestion takes
minutes, so duplicating the audio for each checkout costs disk and time for no
benefit — the clips are a deterministic function of the corpus and are identical
in every worktree. That store SHALL be writable by pods in different namespaces
at once, and SHALL outlive the cluster, so re-creating the cluster does not mean
ingesting again.

#### Scenario: A second worktree sees clips it never ingested
- **WHEN** a worktree is brought up after another worktree has ingested the
  catalog
- **THEN** the clips are already present to its backend, and its exercises play
  without ingestion being run again for the audio

#### Scenario: The volume is shared across namespaces
- **WHEN** two worktrees in different namespaces are running
- **THEN** both backends read and write the same underlying storage, rather than
  each holding its own copy

#### Scenario: The shared store is created once
- **WHEN** a worktree is brought up against a cluster where the shared storage
  already exists
- **THEN** it is reused rather than recreated, and the clips already on it are
  left untouched

#### Scenario: Clips outlive the cluster
- **WHEN** the cluster is deleted and created again
- **THEN** the previously ingested clips are still there, because the store is
  not held inside the cluster's own lifecycle

#### Scenario: Databases stay separate
- **WHEN** two worktrees share the audio volume
- **THEN** their exercise catalogs remain independent, because only the media is
  shared and each worktree keeps its own database

### Requirement: Parallel worktrees run side by side
Several git worktrees of this repository SHALL be able to run their stacks at the
same time against one cluster, without any of them being edited to avoid a
collision. Each worktree's identity SHALL be derived automatically, and SHALL
determine both the Kubernetes namespace it deploys into and the host port it is
reached on.

#### Scenario: The main checkout is unchanged
- **WHEN** `tilt up` runs in the main checkout
- **THEN** it deploys to the default namespace on the base host port, so the
  common case needs no configuration

#### Scenario: A linked worktree gets its own namespace and port
- **WHEN** `tilt up` runs in a linked git worktree
- **THEN** it deploys into a namespace named for that worktree and is served on a
  host port derived from the same identity, leaving the main checkout's stack
  running and reachable

#### Scenario: Two worktrees at once
- **WHEN** two worktrees have both been brought up
- **THEN** each serves its own build of the application on its own port, backed
  by its own database, and neither can read the other's exercises

#### Scenario: Only the Gateway is exposed to the host
- **WHEN** a worktree's stack is running
- **THEN** the Gateway is the only service reachable from the host, and the
  database is reachable only from inside the cluster — every management command
  runs in a pod rather than against a forwarded port

#### Scenario: One definition of the mapping
- **WHEN** the namespace or port for a worktree is needed by Tilt or by any
  editor task or script
- **THEN** all of them obtain it from a single shared derivation, so no two
  callers can disagree about where a worktree's stack lives

#### Scenario: The identity can be overridden
- **WHEN** a developer sets the worktree slug or port offset explicitly in the
  environment
- **THEN** that value is used instead of the derived one, so a predictable port
  can be pinned

### Requirement: Cluster components are provisioned by the project
The project's own bring-up SHALL install the cluster dependencies the stack needs
— the CNI, the Gateway API implementation, and the database operator — rather
than assume they are present, so a developer with an empty cluster and CI with a
fresh one both arrive at the same place. They SHALL be installed only when
missing, because one cluster is shared by every worktree.

#### Scenario: A fresh cluster is made ready
- **WHEN** the stack is brought up against a cluster that has none of these
  components
- **THEN** they are installed and waited for before the application is deployed

#### Scenario: A second worktree does not reinstall them
- **WHEN** a second worktree is brought up against a cluster that already has
  them
- **THEN** the installation is skipped rather than repeated, and the running
  worktree is not disturbed

#### Scenario: Versions are pinned in one place
- **WHEN** a component's version needs to change
- **THEN** it is changed in one declaration that both local development and CI
  read, so the two cannot drift apart

### Requirement: Configuration comes from one environment file
Backend configuration SHALL be read from a single environment file that both the
cluster and any host-run management command use, so there is one place to change
a setting. That file SHALL NOT be committed, and an example carrying no secret
SHALL be, so a new checkout can produce a working one by copying it.

#### Scenario: One file feeds the cluster
- **WHEN** the backend runs in the cluster
- **THEN** its configuration comes from that environment file, not from values
  duplicated into a manifest

#### Scenario: Editing configuration takes effect
- **WHEN** a developer edits the environment file while the stack is running
- **THEN** the backend picks up the new values without the developer deleting a
  pod by hand

#### Scenario: Secrets are not committed
- **WHEN** the repository is inspected
- **THEN** the environment file is ignored by git and only the example is
  present, with no real password in it

### Requirement: Repository ignore rules cover generated and downloaded artifacts
The repository SHALL carry ignore rules that actually match the paths they name. A `.gitignore` pattern containing a slash is anchored to the directory holding that `.gitignore` file, so `src/backend/.venv` written inside `src/.gitignore` matches `src/src/backend/.venv` and never ignores the real virtualenv.

Ignored: `data/`, `__pycache__/`, `.venv/`, environment files holding credentials, frontend `node_modules/` and build output.

#### Scenario: Virtualenv is ignored
- **WHEN** `git status` runs with a virtualenv present at `src/backend/.venv`
- **THEN** no file under that directory is listed as untracked

#### Scenario: Corpus and media are ignored
- **WHEN** downloaded corpus data or copied audio is present under `data/`
- **THEN** `git status` lists nothing from that directory

#### Scenario: Credential files are ignored
- **WHEN** the database environment file exists locally
- **THEN** it is not offered for commit

### Requirement: Project naming is language-neutral
Code-level names SHALL NOT hardcode "Thai", because the application is designed to support any language and Thai is only the first dataset. The Django project SHALL be named `typelearn`.

#### Scenario: Django project name
- **WHEN** the backend settings module is imported
- **THEN** its dotted path is under `typelearn`, not `thai_learn`

#### Scenario: Language-specific components stay named for their language
- **WHEN** a component is genuinely Thai-specific, such as the on-screen Thai keyboard layout
- **THEN** it may carry the language in its name, since it is not a project-wide identifier

### Requirement: Repository layout
The repository SHALL keep backend and frontend under `src/`, with corpus and generated data under an ignored `data/` directory at the repository root.

#### Scenario: Locating the backend
- **WHEN** a developer looks for Django code
- **THEN** it is under `src/backend/`, alongside `pyproject.toml` and `manage.py`

#### Scenario: Locating the frontend
- **WHEN** a developer looks for Vue code
- **THEN** it is under `src/frontend/`, alongside `package.json` and `vite.config.js`
