## Context

Today's local setup is one container and two host processes: `podman-compose`
runs `postgres:17`, while Django runs on `:8000` and Vite on `:5173`. That split
is the source of several things in the codebase that exist for no other reason:

- `django-cors-headers` in `pyproject.toml`, `corsheaders` in `INSTALLED_APPS`,
  its middleware, and `CORS_ALLOWED_ORIGINS` listing both spellings of loopback.
- `VITE_API_URL=http://localhost:8000/graphql/` — an absolute cross-origin URL.
- The `audioUrl` resolver's justification, written into the spec: *"in
  development the frontend is served from the Vite origin while the clips are
  served by Django on another origin"*.

None of it would exist in a deployment, where one origin serves both. The e2e
suite already has to point `VITE_API_URL` at a same-origin path to keep CORS
preflights out of tests that are not about CORS — a hint that the two-origin
topology is the odd one out.

There is also no `.github/` directory at all, while the suite is now 61 unit
tests, 29 browser tests, and a backend pytest run.

The machine this is developed on already has docker, podman, kind, tilt,
kubectl, and helm. The repository already uses git worktrees, and today a second
one cannot run: `:5432`, `:8000`, and `:5173` are taken by the first.

## Goals / Non-Goals

**Goals:**

- One command brings up the whole stack, in a cluster, on one origin.
- CORS disappears from the backend entirely — not configured differently, gone.
- Several worktrees run at once, with no file edited to avoid a collision.
- Every push and pull request runs the suites, inside the images it built.
- CI and a developer's machine bring the cluster up the same way.

**Non-Goals:**

- A production deployment. This change produces the manifests a deployment would
  build on and an overlay that serves the built frontend, but nothing is
  deployed anywhere, and there is no TLS, ingress hostname, secret management,
  or autoscaling.
- Changing any application behaviour. The catalog, keyboard, checking, and every
  existing test are untouched.
- Moving the corpus. It stays outside the repository, 9.6 GB, read in place,
  with its path a parameter.
- Replacing the frontend's stubbed e2e suite with one that drives a real
  backend. That is a larger question about test data and belongs on its own.

## Decisions

### 1. kind + Tilt, and the whole stack goes in

`kind` runs its nodes on Docker or Podman, so the project's Podman preference is
untouched — it becomes the thing underneath the cluster rather than the thing
running the database. Tilt is the bring-up: it builds the images, applies the
manifests, syncs source into running pods, and gives one place to watch the
stack.

Postgres is a CloudNativePG `Cluster`, one per worktree namespace, with the CNPG
operator installed by the bring-up alongside the other cluster-scoped
components. CNPG owns the StatefulSet, the services, the superuser secret, and
the failover machinery, so the manifest describes a database rather than a pod
that happens to run one — the same operator a deployment would use. Its storage
comes from the cluster's default StorageClass, so each worktree's database is its
own volume with nothing extra to install.

The backend applies migrations in an initContainer that retries while the
database is still coming up: with CNPG the cluster takes a little while to
bootstrap, so an unavailable database at start is expected, not a failure. The
frontend runs the Vite dev server (below).

*Alternatives considered.* Keeping compose and adding CI only — leaves the
two-origin split and the CORS configuration that exists to paper over it, which
is half the point of this change. A plain StatefulSet — fewer moving parts for a
single-replica development database holding a regenerable catalog, but it is a
database shape no deployment would run, and this change exists to stop
development and production diverging.

### 2. Calico for both the CNI and the Gateway

kind's default CNI is replaced: the cluster config sets `disableDefaultCNI: true`
and a pod subnet matching Calico's default, and the bring-up installs the Tigera
Operator and an `Installation`. Gateway API support is then turned on by creating
a `GatewayAPI` resource (`operator.tigera.io/v1`, name `default`), which
provisions a GatewayClass named **`tigera-gateway-class`**; the project's
`Gateway` sets `gatewayClassName: tigera-gateway-class`.

Verified on the spike: the GatewayClass appears as `tigera-gateway-class` with
Envoy Gateway as its controller, and a request through it reached the backend
Service with HTTP 200.

This is what makes the single origin real. An `HTTPRoute` sends `/graphql/`,
`/media/`, `/admin/`, and `/static/` to the backend Service and everything else
to the frontend, so the browser only ever sees the Gateway's origin — and
`django-cors-headers` can be deleted rather than reconfigured.

The GatewayClass and the operator are cluster-scoped and shared by every
worktree, so they are installed only when missing and are never owned by Tilt: a
force-update that deleted a GatewayClass would break every other worktree whose
Gateway references it.

*Alternatives considered.* Envoy Gateway installed directly (the reference
project's choice) — one less operator, but then the CNI and the gateway come
from two projects; Calico's implementation is Envoy underneath, and having one
component own both is what was asked for. Ingress-NGINX — the older API, and the
routing rules would not carry to a Gateway API deployment later.

### 3. Shared audio on a host directory, through static hostPath PVs

Storage splits in two, because the database and the audio want opposite things.

**The database wants isolation**, and gets it for free: kind ships Rancher's
local-path-provisioner as the cluster's default StorageClass — confirmed as
`standard`, `rancher.io/local-path`, `WaitForFirstConsumer` — so each worktree's
CNPG cluster dynamically provisions its own volume with nothing to install.

**The audio wants sharing**, and dynamic provisioning is exactly wrong for it —
every PVC would get its own directory, which is the opposite of the goal. So the
media volume is static: kind's cluster config mounts the repository's git-ignored
`data/media` into the node, and each worktree gets **its own** hostPath
PersistentVolume pointing at that same node path, bound 1:1 to **its own** PVC.

The shape from the RWX design survives unchanged — N PV objects, N PVCs, one
backing store, because Kubernetes will not let two namespaces bind one PV. Only
the backing store changes, from an NFS export to a directory:

```
host   data/media/  ──kind extraMount──▶  node /media
                                              │
              ┌───────────────────────────────┼───────────────────────────┐
   PV media-default                  PV media-featurex            PV media-bugfix
   (hostPath /media)                 (hostPath /media)            (hostPath /media)
              │                               │                           │
      PVC in default ns             PVC in typelearn-featurex     PVC in typelearn-bugfix
```

Each PV carries the slug in its name (PVs are cluster-scoped) and a `claimRef`
pre-set to its PVC, so no worktree can bind another's by racing it. The backend
Deployment mounts a plain `persistentVolumeClaim` and, as before, knows nothing
about the arrangement.

This is strictly simpler than the Longhorn route it replaces: no `open-iscsi`, no
`nfs-client`, no share-manager pod, and no runtime lookup of a Service named
after a provisioned volume. It also does something Longhorn would not — the clips
stay visible and editable on the host, and survive `kind delete cluster`, so
re-creating the cluster costs nothing and ingestion is genuinely once-ever rather
than once-per-cluster.

**The honest cost.** This change exists to stop development diverging from
production, and hostPath storage is the one place it deliberately still does: no
deployment would run it. The trade is deliberate — storage is the piece where
fidelity is most expensive and matters least here, since the clips are a
regenerable function of the corpus rather than data anyone would lose. The
production overlay names a real StorageClass instead.

**It assumes a single-node cluster.** Two nodes and a pod scheduled onto the
second one would see an empty directory rather than an error, which is a quiet
failure. The kind config therefore defines exactly one node, and says why.

*Alternatives considered.* Longhorn with an RWX volume — real cluster storage, a
share-manager serving it over NFS, and two host packages plus an unproven story
on kind; dropped for exactly that cost. An `emptyDir` or a per-namespace dynamic
volume — no sharing, so every worktree re-ingests gigabytes to produce identical
files. Mounting the directory straight into the pod spec with a `hostPath` volume
and no PV or PVC — fewer objects for the same result, but the node path then
lives in the Deployment, so swapping in real storage becomes an edit to the
workload rather than to one storage manifest.

### 4. The worktree slug is one derivation, in one script

`scripts/worktree-env.sh` is the single source of truth, and the Tiltfile shells
out to it rather than re-deriving anything:

```
slug      = WORKTREE_SLUG | linked-worktree directory name | "default"
namespace = "default" (slug default) | "typelearn-<slug>"
offset    = WORKTREE_OFFSET | 0 (slug default) | cksum(slug) % 50 + 1
gateway   = GATEWAY_PORT | 8500 + offset
```

The Gateway is the only host port. The database is not forwarded: everything the
application needs reaches it inside the cluster, and a management command runs in
a pod through a Tilt button. A forwarded database port would be a second way to
reach the data that only exists in development — the same kind of
development-only affordance this change is removing from the frontend.

A linked worktree is detected by comparing the resolved git dir with the common
git dir — they differ only in a linked worktree, so the main checkout keeps the
bare ports and the default namespace and nothing about the common case changes.
The base ends in `00` and the offset stays under 100, so the last two digits of
the port identify the worktree, and the main checkout gets the bare `8500`.

The script is the source of truth precisely because the Tiltfile is not the only
caller: an editor task or a helper script that re-derived the mapping could
disagree with Tilt about where a worktree's stack lives, and the failure would
look like data appearing in the wrong namespace.

### 5. Vite in the cluster for dev, nginx in an overlay for production

The base manifests run `vite dev --host` in the frontend pod with Tilt syncing
`src/`, so hot reload survives the move into the cluster — this project's daily
work is frontend work, and losing HMR to gain fidelity would be a bad trade for
the majority of edits. A `k8s/overlays/prod` swaps in an image serving the built
bundle from nginx, which is what a deployment would run.

Vite's HMR uses a websocket back to the origin. Through a Gateway on a non-default
port that needs `server.hmr.clientPort` set to the worktree's gateway port, and
the Gateway must pass the upgrade through. This is the fiddly part; if it cannot
be made to work, the fallback is to run the prod overlay locally and rebuild on
change, which is what the reference project does.

*Alternatives considered.* nginx everywhere — maximum fidelity, and every CSS
tweak becomes an image rebuild. Vite on the host proxying to the cluster — keeps
HMR native and stays same-origin through Vite's proxy, but then the frontend a
developer uses is not the frontend in the cluster, which is the divergence this
change exists to remove.

### 6. The corpus reaches the cluster as a mount, never as an image layer

`kind`'s cluster config mounts the corpus directory into the node
(`extraMounts`), and an ingestion Job mounts it into a pod read-only. The path
stays a parameter — supplied through the environment file, never baked into a
manifest or an image — so the project's rule that the corpus path is never
hardcoded survives. A Tilt button runs ingestion on demand rather than on every
`tilt up`, because it is a minutes-long one-off, not part of bringing the stack
up.

Nothing copies 9.6 GB anywhere: the Job reads the corpus in place and writes only
the ~100 selected clips into the shared media directory, exactly as
`load_corpus` does today.

### 7. CI builds once, tests inside what it built, and smoke-tests the real stack

Jobs, in dependency order:

| Job | What it does |
|---|---|
| `setup` | Computes image refs and a per-commit candidate tag |
| `build-backend` | Builds and pushes the backend image |
| `build-frontend` | `npm ci`, builds the serve image and a `-test`-tagged build stage |
| `pytest` | Runs the backend suite **inside the backend image**, against a Postgres service |
| `vitest` | Runs the unit suite inside the `-test` image |
| `playwright` | Runs the 29 browser tests inside the `-test` image |
| `smoke` | kind + the project's own bring-up, then checks the stack through the Gateway |
| `publish` | Retags the tested images — no rebuild |

Two properties are worth naming. **The tested artifact is the published
artifact**: tests run inside the built image and publishing is a retag, so no
untested rebuild can be released under a tested commit's name. And **the browser
suite does not need the cluster** — it stubs the catalog and synthesises its
audio, so it stays a fast job while the cluster job does the thing only a cluster
can do.

The smoke test asserts that the stack answers, not what it holds: the Gateway
returns the frontend's page at `/`, and a GraphQL query at the same origin
returns a valid response with an empty catalog. That keeps CI free of the corpus
entirely.

*Alternatives considered.* Running the browser suite against the deployed stack
— it stubs the catalog deliberately, so pointing it at a real backend means
solving test-data seeding first, which is its own change. Skipping the cluster
job on pull requests, as the reference project does — worth doing if it becomes
the long pole, but with one small stack it is cheap enough to run every time, and
this change is precisely the one where the manifests are least trustworthy.

## What the spike established

Group 1 built a throwaway cluster and ran every load-bearing claim in this design
against it. Everything held, and five details came back that the design had
either guessed at or got wrong.

**Versions that work together**: Calico `v3.32.1` (tigera-operator manifest, then
an `Installation` with `cidr: 192.168.0.0/16` matching kind's `podSubnet`), and
CloudNativePG `v1.30.0` by Helm. Pods get addresses from the configured pool,
reach each other, resolve cluster DNS, and reach Services. The node stays
`NotReady` until Calico lands, which is expected rather than a failure.

**The operator manifest and the `Installation` cannot be applied in one breath.**
Applying the `Installation` immediately after the operator fails with `no matches
for kind "Installation"` — the CRDs exist but the client's discovery cache does
not know them yet. The bring-up has to wait for the CRD before applying the CR.

**The Gateway never reaches `Programmed=True` on kind, and that is fine.** Its
Envoy Service is a `LoadBalancer`, kind has no controller to assign one, so the
status stays `Programmed=False: No addresses have been assigned`. The data path
works regardless — a request through a port-forward to the Envoy Service returned
HTTP 200 from the backend behind the HTTPRoute. **Nothing in the bring-up or CI
may gate on `Programmed`**; wait on the Envoy Deployment instead, or a bare
`tilt ci` will hang until it times out.

**The Envoy Service is in namespace `tigera-gateway`**, not the
`envoy-gateway-system` an Envoy Gateway install would use, and it is named
`envoy-<ns>-<gateway>-<hash>`. It carries
`gateway.envoyproxy.io/owning-gateway-name` and
`gateway.envoyproxy.io/owning-gateway-namespace` labels, which is how the
port-forward finds the one belonging to this worktree.

**CNPG defaults to PostgreSQL 18.4**, while the project's tech-stack and specs
say 17. The manifest pins the image to 17 to keep the documents true; moving to
18 is a decision with its own reasons and does not belong inside this change.

**The shared-media shape works exactly as designed**: two namespaces, two static
hostPath PVs over one node path with `claimRef` pre-set and `storageClassName:
""`, both PVCs bound, a file written by a pod in one namespace read by a pod in
the other, and visible on the host.

**Rootless Docker inverts the ownership everyone expects.** kind runs on rootless
Docker here, so a container running as **root** writes files that appear on the
host owned by the developer, while a container running as **uid 1000** maps to an
unprivileged subuid (`100999`) that owns nothing — and gets `Permission denied`
on a host directory owned by the developer. The fix, verified: the bring-up
`chmod 0777`s the media directory, after which a non-root container writes
happily. The image therefore keeps a non-root `USER` — the same image production
would run — and the permission is a dev-only affordance applied to a dev-only
directory. Files then show up on the host owned by `100999`; they stay readable,
and remain deletable because the directory itself is writable.

## What building it exposed

The spike proved the components. Assembling them surfaced five more things, each
of which was a silent or misleading failure rather than an obvious one.

**A bootstrap step must be gated on what that step creates.** The first version
gated the whole Calico block on the `Installation` CRD existing — but the CRD
arrives with the *operator manifest*, not with the `Installation`. An interrupted
first run therefore left the CRD present, and every later run skipped applying
the `Installation` entirely. The symptom was a cluster with no CNI, every node
`NotReady`, and every pod `Pending`, reported by a bootstrap that believed it had
already run. Each step now checks for its own object.

**Tilt requires `fall_back_on` to be the first live_update step.** Listed last,
it fails the whole Tiltfile with `live_update: fall_back_on steps must appear at
the start of the list` — and a Tiltfile that does not load deploys nothing, while
`tilt up` sits there looking busy.

**kustomize strips quotes from scalars, so a placeholder cannot be quoted in the
manifest.** `value: "GATEWAY_PORT"` came back out as `value: GATEWAY_PORT`, and
substituting a number into it produced `value: 8500` — which Kubernetes rejects,
because an env value must be a string. The placeholder is now unquoted in the
manifest and the Tiltfile substitutes the quotes along with the value.

**An object built outside the kustomize overlay does not get the namespace.** The
`backend-env` ConfigMap is generated from `.env` in the Tiltfile, so it landed in
`default` no matter which worktree created it. In the main checkout that is the
right namespace by accident, so it worked; the second worktree failed with
`CreateContainerConfigError: configmap "backend-env" not found`. Only a parallel
worktree could have found this.

**The runtime image has no pytest, so nothing could run the backend suite.**
Installing dependencies `--without dev` is right for what ships and wrong for
every place the suite actually runs: the Tilt button execs into the pod, and CI
runs the suite inside the image it built. The Containerfile therefore has a `dev`
stage — the runtime image plus the dev dependency group, same Python and same
code — which development and CI use, while the production overlay pins
`runtime`. It is the same split the frontend already had between `build` and
`serve`, arrived at from the opposite direction.

**Files the container creates are owned by a mapped subuid on the host.** The
spike established that for files; directories behave the same way, and Django
creates `media/clips/` itself (`upload_to='clips/'`). A developer then cannot
delete their own ingested clips, because deletion needs write permission on the
*containing* directory — and that directory belongs to the container's subuid.

The first fix here was wrong and is recorded as such: a recursive `chmod` from
the bring-up cannot work, because `chmod` requires **ownership**, not write
permission on the parent. `data/media` being world-writable lets the developer
unlink the entry; it does not let them change the mode of a directory they do not
own. The sweep therefore failed with `Operation not permitted` and, exiting
non-zero, took the whole Tiltfile down with it.

What works is to create the directory before the container can: made by the
bring-up it is owned by the developer and world-writable, so the container's user
writes into it happily and the developer can still delete what lands there. The
lesson generalises — under a rootless runtime, decide who creates a shared
directory, because whoever creates it owns it.

## Risks / Trade-offs

- **hostPath storage is a development-only affordance** → nothing else in this
  change asks development to differ from production, and this does. Accepted
  deliberately: the clips are regenerable, so the fidelity is worth least here.
  The production overlay names a real StorageClass, which keeps the divergence
  visible in the manifests rather than hidden in a habit.
- **The shared directory assumes one node, and fails quietly if that changes** →
  a pod scheduled onto a second node sees an empty directory, not an error. The
  kind config pins a single node and carries the reason; a task checks that the
  clips are actually visible from a second namespace rather than assuming it.
- **Shared audio means one worktree can affect another's clips** → a branch that
  changes ingestion writes into the directory every other worktree reads, and now
  into one on the host that outlives the cluster. The blast
  radius is bounded — the clips are a deterministic function of the corpus, so
  the repair is re-running ingestion — but a worktree doing something genuinely
  novel to the media should point `MEDIA_ROOT` at its own volume, and the
  manifests should make that a one-line override.
- **Calico on kind needs the default CNI disabled and subnets to agree** → a
  mismatch between kind's `podSubnet` and Calico's IP pool leaves pods without
  addresses and nothing else works. Both are set explicitly in the same change,
  and the bring-up waits for Calico before deploying anything.
- **HMR through the Gateway is unproven here** → confined to one decision and one
  setting; the prod overlay is a working fallback that costs only rebuild time.
- **The prerequisite list for a contributor grows** from Podman + Poetry + Node
  to that plus kind, tilt, kubectl, and helm — four tools, but no root-level host
  configuration. This is the real cost of the change, and the README has to carry
  it honestly.
- **A shared cluster is shared state** → one worktree can install a broken
  operator version for everyone. Versions are pinned in one declaration and
  installs are skipped when present, so the blast radius is a deliberate upgrade
  rather than an accident.
- **CI gets slower and needs a registry** → images are pushed to GHCR per commit.
  Build caching keeps rebuild cost down, and the fast suites report before the
  cluster job finishes.

## Migration Plan

1. `podman-compose down`, remove the `typelearn-db-data` volume and
   `typelearn-net` network, delete `db.env`.
2. `kind create cluster --config k8s/kind.yaml`, then `tilt up`. No host packages
   are needed beyond the tooling itself.
3. Re-run ingestion through the Tilt button to repopulate the catalog. No data is
   migrated: selection is deterministic, so the same corpus yields the same 100
   exercises — and because the clips land in `data/media` on the host, this is
   the last time it has to be done even if the cluster is deleted.

Rollback is reverting the commit and running `podman-compose up -d` again; the
change deletes no data outside the cluster.

## Open Questions

- **Who creates the kind cluster.** The Tiltfile could create it if missing,
  which makes `tilt up` the only command a developer needs, or it could refuse
  and print the command, which keeps Tilt from owning something shared by every
  worktree. Leaning toward refusing with a clear message.
- ~~**Whether the backend image should carry Poetry or export a requirements
  file.**~~ **Settled by measuring.** Neither: the builder stage resolves the
  locked dependencies into a virtualenv and the runtime copies only that, so
  Poetry never reaches the shipped image and no requirements file has to be kept
  in step with the lockfile. Poetry and its dependencies are 197 MB — a
  single-stage image is 477 MB against 280 MB for the two-stage one, so 41% of
  the naive image is a build tool the application never calls.
- **Whether the production overlay should carry a StorageClass at all yet.** It
  has no cluster to name one for. Writing it keeps the hostPath divergence
  visible; leaving it out avoids inventing a value no deployment has chosen.
- **Whether the smoke test should seed a few exercises.** The backend test suite
  already builds a miniature corpus in its fixtures; reusing it would let the
  smoke test assert a real exercise renders, rather than an empty catalog. Worth
  doing only if the fixture can be reused without contorting it.
