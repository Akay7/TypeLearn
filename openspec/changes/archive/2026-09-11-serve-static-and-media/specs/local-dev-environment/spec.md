## ADDED Requirements

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

## MODIFIED Requirements

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
