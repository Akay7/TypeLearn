## ADDED Requirements

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
- **THEN** the only thing additionally reachable from the host is the debugger's
  own attach port; the application's services, the database included, stay
  unreachable, so the rule that the Gateway is the only service exposed is
  unchanged

#### Scenario: No application runs on the host
- **WHEN** a developer debugs the backend
- **THEN** nothing about the application is run on their machine, so no database
  credential is copied out of the cluster and no port of the database is opened

### Requirement: Backend tests run where they are judged
The backend's test suite SHALL be run in the cluster, against the real database
and inside the image that was built, which is where CI runs it. No host
arrangement SHALL be offered that would run the suite somewhere the result means
less than it does there.

#### Scenario: Running the suite
- **WHEN** a developer runs the backend tests
- **THEN** they run in the pod, against the real database, as CI runs them

#### Scenario: The editor does not pretend otherwise
- **WHEN** the editor's test integration is configured
- **THEN** it is for collecting and navigating tests, and says plainly that
  running them belongs in the cluster

## MODIFIED Requirements

### Requirement: The application is served from one origin
The frontend and the backend SHALL be reached through a single origin, in a
deployment and in every way the application is run locally — including a dev
server running on the host outside the cluster. A Gateway SHALL route the
backend's paths to the backend and everything else to the frontend; a host dev
server SHALL proxy those same paths for the same reason. Consequently the backend
SHALL NOT carry any cross-origin configuration: no way of running this
application may be the only one where CORS is needed.

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
