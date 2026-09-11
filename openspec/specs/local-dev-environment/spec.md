# local-dev-environment Specification

## Purpose
How a developer runs the whole application on their own machine: on a local
Kubernetes cluster shaped like a deployment, so that what works here works there,
and so several checkouts of this repository can run at once without colliding.
## Requirements
### Requirement: Bring-up defaults to what a deployment runs
`tilt up` with nothing set SHALL bring up the stack in the shape a deployment
runs it: the images' production stages, the application's own server command,
debug off, and no development-only affordance switched on. One switch SHALL turn
on every development affordance together, and the two modes SHALL differ only in
the values the chart is rendered with — not in which templates, cluster,
namespace, port, or database they use.

The default is the deployment shape because that is the arrangement that has to
work. A mode nobody runs by accident is a mode whose breakage is found by a
deployment rather than by the developer who caused it.

#### Scenario: The default is the deployment shape
- **WHEN** a developer runs `tilt up` without asking for development mode
- **THEN** the backend runs the image's own server command with debug off, the
  frontend serves its built bundle, nothing is synced into a pod, and the
  application is reachable exactly as it is in development mode

#### Scenario: One switch turns development on
- **WHEN** a developer sets the development-mode switch and brings the stack up
- **THEN** source is synced into the pods, the frontend runs its dev server with
  hot reload, debug is on, and the database role may create the test database

#### Scenario: Bring-up says which mode it is in
- **WHEN** the stack is brought up in either mode
- **THEN** it reports which one, so a developer never has to infer it from
  behaviour

#### Scenario: Asking for the debugger asks for development mode
- **WHEN** a developer switches debugging on without setting the development-mode
  switch
- **THEN** development mode is turned on with it, because the debugger ships only
  in the development image, and this is reported rather than done silently

#### Scenario: Affordances that cannot work are not offered
- **WHEN** the stack is up in the default mode
- **THEN** the actions that depend on the development images — the buttons that
  run the test suites in the pod — are absent rather than present and failing

#### Scenario: The environment file is not rewritten to change mode
- **WHEN** the mode is switched
- **THEN** nothing a developer maintains by hand is edited: the configuration
  file keeps its development values, and bring-up supplies the deployment-shaped
  ones to the cluster itself

### Requirement: The stack runs on a local Kubernetes cluster
Local development SHALL run the whole application — database, backend, and
frontend — on a local `kind` cluster driven by Tilt, rather than a mixture of one
container and two host processes. A single command SHALL bring the stack up, and
a developer SHALL NOT have to start the backend or the frontend by hand.

The images SHALL be built into the same container runtime that hosts the cluster.
The project SHALL NOT dictate which runtime that is; naming one side SHALL be
enough, with the project supplying the other, so the two cannot be left
half-configured. Bring-up SHALL refuse both a split runtime and a cluster that is
not this project's, rather than deploying into whichever one the developer's
tooling currently selects.

#### Scenario: Starting the stack
- **WHEN** a developer runs `tilt up` in a checkout
- **THEN** PostgreSQL, the backend, and the frontend are deployed to the cluster,
  and the application is reachable in a browser once Tilt reports the resources
  green

#### Scenario: Code changes reach the running stack
- **WHEN** a developer edits backend Python or frontend source with development
  mode on
- **THEN** the change reaches the running pod without a manual rebuild or
  redeploy — synced for the backend, and hot-reloaded by the dev server for the
  frontend

#### Scenario: The default mode rebuilds rather than syncs
- **WHEN** a developer edits source without development mode on
- **THEN** the change reaches the stack by rebuilding the image, because the pod
  runs that image as built — which is the arrangement being proved, and the
  reason the switch exists

#### Scenario: Migrations run before the backend serves
- **WHEN** the backend starts against a database that has pending migrations
- **THEN** they are applied before the application container begins serving, and
  a database that is not yet accepting connections is waited for rather than
  treated as a failure

#### Scenario: Ingested clips survive a restart
- **WHEN** the backend pod is deleted and rescheduled
- **THEN** the audio clips under `MEDIA_ROOT` are still present, because the
  directory is a persistent volume rather than container-local storage

#### Scenario: Either runtime works, named once
- **WHEN** a developer names one side of the container runtime — the builder or
  the cluster provider — and leaves the other unset
- **THEN** the project supplies the other side to match, so the stack comes up on
  the runtime they chose without them configuring it twice

#### Scenario: No runtime is imposed
- **WHEN** a developer names neither side
- **THEN** the default runtime is used for both, and nothing in the project
  overrides a preference they did express

#### Scenario: A split runtime is refused rather than tolerated
- **WHEN** the runtime the images are built into and the runtime hosting the
  cluster would differ
- **THEN** bring-up stops immediately and names both sides, rather than building
  successfully and surfacing much later as an image the cluster cannot pull

#### Scenario: The wrong cluster is refused
- **WHEN** bring-up is run while the developer's tooling points at a cluster that
  is not this project's
- **THEN** it stops and names both the selected cluster and the expected one,
  rather than deploying this stack into someone else's

### Requirement: The application is served from one origin
The frontend and the backend SHALL be reached through a single origin, in a
deployment and in every way the application is run locally — including a dev
server running on the host outside the cluster. A Gateway SHALL route the
backend's paths to the backend, the clips to whatever serves the media store, and
everything else to the frontend; a host dev server SHALL proxy those same paths
for the same reason. Consequently the backend SHALL NOT carry any cross-origin
configuration: no way of running this application may be the only one where CORS
is needed.

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
- **WHEN** a request arrives for the GraphQL endpoint, the Django admin, or
  Django's static files
- **THEN** the Gateway routes it to the backend, while every other path falls
  through to the frontend

#### Scenario: Clips reach the media server
- **WHEN** a request arrives for a clip under the media path
- **THEN** the Gateway routes it to the server that holds the media store, in
  development exactly as in a deployment, so the path that serves the audio is
  the same one in both

#### Scenario: A dev server on the host is also one origin
- **WHEN** the frontend is served from a dev server on the host and queries the
  catalog
- **THEN** the request goes to that same dev server's origin, which forwards it
  to the backend, so the browser again sends no preflight and receives no CORS
  headers

#### Scenario: The frontend addresses the backend by path, never by URL
- **WHEN** the address the frontend uses for the API is read, in any environment
  and including its built-in default
- **THEN** it is a path on the current origin, so no configuration can point the
  application at a second origin

### Requirement: The frontend can run on the host against the running stack
A developer SHALL be able to run the frontend's dev server on the host while the
rest of the stack runs in the cluster, and SHALL get the real catalog and the
real audio without a second backend, a database, or any credential. That path
SHALL preserve the single origin rather than trading it away for convenience.

#### Scenario: Real data with nothing else set up
- **WHEN** the dev server is started on the host while the stack is up
- **THEN** it serves the application, and the catalog and audio come from the
  running backend, with no setup beyond having brought the stack up

#### Scenario: Still one origin
- **WHEN** the page served from the host queries the catalog or loads a clip
- **THEN** the request goes to that same dev server's origin, which forwards it,
  so the browser sends no preflight and no response carries a CORS header

#### Scenario: The dev server advertises no cross-origin access
- **WHEN** any response from the host dev server is inspected
- **THEN** it carries no `Access-Control-Allow-Origin`, because nothing needs one
  and a development-only permission is one an application comes to depend on

### Requirement: The backend is debugged where it runs
A debugger SHALL attach to the backend as it runs in the cluster, rather than to
a copy of the application assembled on a developer's machine. What is stepped
through is then the image a deployment runs, with its environment, its database
and its routing — nothing is reconstructed, so nothing about the reconstruction
can differ from the real thing.

#### Scenario: Attaching to the running backend
- **WHEN** a developer switches debugging on and brings the stack up
- **THEN** the backend accepts a debugger, and a breakpoint in request handling
  is reached by a request that arrives through the Gateway

#### Scenario: The stack does not wait for a debugger
- **WHEN** debugging is switched on and no debugger ever attaches
- **THEN** the stack comes up and serves normally, because a pod that blocks
  until someone attaches is a stack that looks broken to everyone else

#### Scenario: Off by default
- **WHEN** the stack is brought up without asking for debugging
- **THEN** the backend runs as it otherwise would, and no debug port exists

#### Scenario: Breakpoints correspond to the running code
- **WHEN** a breakpoint is set in the editor
- **THEN** it maps to the same file in the container, because source is synced
  there verbatim — a mapping that is stated rather than assumed, since a wrong
  one produces a breakpoint that never fires and reports nothing

#### Scenario: A debugger port is not a service
- **WHEN** debugging is switched on
- **THEN** the only thing it additionally exposes is the debugger's own attach
  port; it opens no route to the application's services, so what a running
  worktree exposes to the host is otherwise unchanged

#### Scenario: No application runs on the host
- **WHEN** a developer debugs the backend
- **THEN** nothing about the application is run on their machine: the process
  being stepped through is the one in the pod, so debugging needs no second copy
  of the backend and no database of its own

### Requirement: Backend tests run where they are judged
The backend test run that gates a change SHALL happen in the cluster, against the
real database and inside the image that was built, which is where CI runs it. A
host arrangement MAY exist for the editor's benefit — collecting, navigating and
debugging individual tests against the forwarded database — but SHALL NOT be the
run a change is judged by.

#### Scenario: Running the suite
- **WHEN** a developer runs the backend tests to judge a change
- **THEN** they run in the pod, against the real database, as CI runs them

#### Scenario: The editor does not pretend otherwise
- **WHEN** the editor's test integration is configured
- **THEN** it is for collecting, navigating and debugging individual tests, and
  says plainly that the run which gates a change belongs in the cluster

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

#### Scenario: The directory is prepared before the container can create it
- **WHEN** the stack is brought up on a machine where the clips directory does
  not exist yet
- **THEN** it is created by the host side, owned by the developer and writable by
  the container's user — never left for the container to create first, which
  under a rootless runtime would leave a directory the developer can afterwards
  neither change nor clear

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
determine the Kubernetes namespace it deploys into, the host port the
application is reached on, and the host port Tilt's own web UI listens on.

#### Scenario: The main checkout is unchanged
- **WHEN** `tilt up` runs in the main checkout
- **THEN** it deploys to the default namespace on the base host port, with Tilt's
  UI on its base port, so the common case needs no configuration

#### Scenario: A linked worktree gets its own namespace and port
- **WHEN** `tilt up` runs in a linked git worktree
- **THEN** it deploys into a namespace named for that worktree and is served on a
  host port derived from the same identity, leaving the main checkout's stack
  running and reachable

#### Scenario: Two worktrees at once
- **WHEN** two worktrees have both been brought up
- **THEN** each serves its own build of the application on its own port, backed
  by its own database, and neither can read the other's exercises

#### Scenario: What a running worktree exposes to the host
- **WHEN** a worktree's stack is running
- **THEN** the Gateway is the only way the application is reached from the host,
  and every management command runs in a pod rather than against a forwarded
  port

#### Scenario: The database is reachable from the host for tests
- **WHEN** a worktree's stack is running
- **THEN** its database is also forwarded to a host port derived from the same
  worktree identity, and the credentials are written to an ignored file, so the
  editor can run and debug the backend suite as ordinary host code — while the
  suite that gates a change still runs in the pod, inside the image that ships

#### Scenario: The forwarded database survives a whole test run
- **WHEN** the backend suite is run on the host against that forwarded port
- **THEN** every test in the run reaches the database, rather than the run
  failing after the first connection closes

#### Scenario: Every worktree's Tilt can attach at once
- **WHEN** two worktrees have both been brought up with `tilt up`
- **THEN** each worktree's Tilt serves its UI on its own host port, so both stay
  attached and keep syncing source into their pods, and neither `tilt up` fails
  to bind its port

#### Scenario: One definition of the mapping
- **WHEN** the namespace, the application port, or Tilt's web port for a worktree
  is needed by Tilt or by any editor task or script
- **THEN** all of them obtain it from a single shared derivation, so no two
  callers can disagree about where a worktree's stack lives

#### Scenario: The identity can be overridden
- **WHEN** a developer sets the worktree slug or port offset explicitly in the
  environment
- **THEN** that value is used instead of the derived one, so a predictable
  application port, namespace, and Tilt port can be pinned together

#### Scenario: Pinning an identity does not dirty the checkout
- **WHEN** a worktree pins its own slug or offset
- **THEN** it does so in a file git ignores, with a committed example beside it,
  so pinning never appears as a modification to configuration everyone shares

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
