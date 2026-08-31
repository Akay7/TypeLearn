## Context

The stack currently deploys from `k8s/base` (a kustomize base) plus
`k8s/overlays/prod`. The base carries three things a chart would parameterise and
kustomize cannot without a patch per environment:

- image references with no tag (`typelearn-backend`), resolved by Tilt locally
  and by a retag in CI;
- a CNPG `Cluster` with a hardcoded `1Gi` and no storage class;
- a static hostPath PersistentVolume whose name and `claimRef` are filled in by
  string substitution in the Tiltfile, because the worktree slug is not knowable
  from a manifest.

That substitution is the tell. The Tiltfile already treats the manifests as
templates — it rewrites `WORKTREE_SLUG`, `WORKTREE_NAMESPACE`, and
`GATEWAY_PORT` in the rendered kustomize output before applying it. A chart is
the same idea with the templating done by something that understands YAML rather
than by `str.replace`, which is also what removes the class of bug found while
building the previous change, where kustomize stripped the quotes from a
placeholder and a substituted port became a number.

Everything the chart needs to describe has been verified running: Calico's
`tigera-gateway-class`, a CNPG cluster, the shared hostPath media volume across
namespaces, and the single-origin HTTPRoute.

## Goals / Non-Goals

**Goals:**

- One set of templates for development and deployment, rendered with values.
- Every backend environment variable settable from values; no template edit to
  add a setting.
- Secrets separable from configuration, and supplyable from outside the release.
- The database sized, classed, and optional.
- The two real dev/prod differences — frontend mode, media storage — implemented
  as values with both branches working.

**Non-Goals:**

- Deploying anything. This produces a chart and proves it renders and installs
  locally; there is no target cluster, no registry of record, no DNS, and no
  certificate issuer.
- Installing operators. Calico, its Gateway API support, and CloudNativePG stay
  cluster prerequisites.
- Backups, autoscaling, network policies, or pod security standards. The values
  shape should not preclude them; none are written now.
- Changing application behaviour, images, or tests.

## Decisions

### 1. The chart replaces kustomize outright, and Tilt renders it

`chart/` becomes the only description of the stack. Tilt renders it with
development values through the `helm()` builtin, so the templates a developer
exercises every day are the ones a deployment uses. Keeping kustomize for
development and adding a chart for production would put the same Deployment in
two languages — and the previous change exists precisely because the environment
nobody runs daily is the one that turns out to be wrong.

Live update is unaffected: Tilt's file syncing operates on the images and pods it
built, not on how the manifests were produced.

*Alternatives considered.* A chart for production only — half the work now, and
it reintroduces the divergence the last change removed, in the layer above it.
Keeping the base and having the chart wrap it via a post-renderer — the worst of
both: two tools, and a rendering pipeline nobody can read.

### 2. Development values come from `.env`, generated, not hand-written

`local-dev-environment` requires that backend configuration come from one
environment file that both the cluster and host-run commands read. A
`values-dev.yaml` holding the same settings would be a second place to change
them, so the Tiltfile keeps reading `.env` and generates the values file from it
into its scratch directory — the same trick it already uses for the namespace
overlay. One file a developer edits; a generated artefact nobody does.

The per-worktree namespace, slug, and gateway port stop being string
substitutions and become values that the generated file carries, which is how the
quote-stripping bug becomes impossible rather than fixed.

### 3. Configuration is a map; secrets are a different map, or nobody's

Three values, one behaviour each:

```yaml
env:            { DJANGO_DEBUG: "false", ... }   # -> ConfigMap
secrets:        { DJANGO_SECRET_KEY: "..." }     # -> Secret, only if non-empty
existingSecret: "typelearn-secrets"              # -> referenced, none created
```

The backend takes both through `envFrom`, so adding a setting is a values entry.
`existingSecret` is what makes the chart installable with no secret in values at
all, which matters because values are readable by anyone who can read the
release, and because a cluster with an external-secrets operator wants to own
that Secret itself.

Database credentials are in neither map. CNPG generates a Secret for its cluster,
and the backend reads five keys out of it by explicit `secretKeyRef` — `dbname`,
`username`, `password`, `host`, `port` — mapped to the names Django reads. That
mapping is not cosmetic: the keys CNPG writes are lowercase, so pulling the
Secret in wholesale would put a bare `host`, `port`, and `user` into the
process environment.

*Alternatives considered.* One map for everything — simplest chart, and the
secret key ends up in a ConfigMap and in `helm get values`. Secrets always
external — strictest, and it makes `helm install` alone unable to produce a
working stack, which is a bad first experience for something that should be
installable in one command.

### 4. The database is a CR the chart creates, and can be one it does not

`postgres.enabled: true` renders a CNPG `Cluster` with `instances`, `imageName`,
`storage.size`, `storage.storageClass`, and `resources` from values. The image
stays pinned to PostgreSQL 17, matching the specs; CNPG's own default is newer,
and moving is a decision with its own reasons.

`postgres.enabled: false` renders no database and points the backend at
`externalDatabase` — host, port, name, user, and a Secret reference for the
password. A managed Postgres is then a values change, not a fork of the chart.

The Cluster carries `helm.sh/resource-policy: keep` so `helm uninstall` does not
take the data with it. An application that deletes its own database on uninstall
is one bad command away from an outage, and the recovery for a stray leftover
Cluster is one `kubectl delete`.

### 5. The dev/prod differences become values with both branches implemented

Two conditionals replace the prod overlay:

- `frontend.mode: dev|serve` — the dev server, or the built bundle behind nginx.
  Same template, different command, port, and probe.
- `media.hostPath` — set, and the chart renders the static PV and pre-bound PVC
  that let every worktree share one directory; unset, and it renders an ordinary
  PVC against `media.storageClass`. The hostPath branch is development-only and
  says so, but it is *code*, not a paragraph, which is the point.

`gateway.host` adds a hostname to the Gateway listener and the HTTPRoute when
set, and is empty locally, where the Gateway serves every host.

### 6. What the chart deliberately does not do

No Calico, no Gateway API enablement, no CNPG operator. They are cluster-scoped
and shared by every release, so a chart that installed them would fight any other
chart doing the same, and `helm uninstall` would take the cluster's networking
with it. The chart instead fails clearly when a prerequisite is missing — a
`required` check on the GatewayClass and the CNPG CRD gives a named error rather
than resources that never become ready.

## What the Rendered Output Deliberately Changes

The migration plan below diffs the chart's output against the manifests it
replaces. Everything that survived that reconciliation is listed here, so the
diff is a decision rather than a surprise.

**Against the development rendering** (`kubectl kustomize` with the Tiltfile's
substitutions), the chart adds:

- the standard `app.kubernetes.io/*` and `helm.sh/chart` labels on every object.
  The `app: <component>` selector labels are untouched — a Deployment's selector
  is immutable, and the Tiltfile's buttons and port-forward select on them;
- `helm.sh/resource-policy: keep` on the database;
- a pod-template checksum of the ConfigMap and Secret, so a configuration edit
  rolls the pods rather than waiting for something else to restart them;
- `DJANGO_SECRET_KEY` moved out of the ConfigMap into a Secret, and an `envFrom`
  secretRef alongside the existing configMapRef;
- explicit image tags (`typelearn-backend:latest`) where the manifests had a bare
  name that resolved to the same thing;
- named container ports, so the Service and the probes follow the frontend's mode
  rather than restating a number that changes with it;
- a fixed `Host` header on the backend's probes. Django checks Host against
  ALLOWED_HOSTS and a probe arrives at the pod IP, so without this a deployment
  needs the `*` that only development should have.

Nothing else differs: same objects, same names, same routing, same volumes.

**Against `k8s/overlays/prod` the diff found four defects**, which is the return
on doing it rather than reasoning about it. The overlay was never installed, so
none had been observed:

1. The frontend patch set `env: []` intending to drop the dev server's
   `VITE_HMR_CLIENT_PORT`. A strategic merge with an empty list is a no-op, so
   production would have shipped that variable with the literal, unsubstituted
   value `GATEWAY_PORT`.
2. The same patch's `ports` merged rather than replaced, leaving the container
   declaring both 80 and the dev server's 5173.
3. The overlay replaced only the media *claim*, so the development hostPath
   PersistentVolume was still rendered — carrying the unsubstituted
   `WORKTREE_SLUG` and `WORKTREE_NAMESPACE` placeholders into production.
4. `managed.roles` with `createdb: true` was inherited from the base. That
   exists so pytest can create its own test database; production has no reason
   to grant it. It is `postgres.allowCreateDatabase`, false by default.

The overlay also produced no ConfigMap at all — the Tiltfile built that object,
so `kubectl apply -k k8s/overlays/prod` would have left every pod in
`CreateContainerConfigError`. The chart renders it.

One intended removal: the overlay restated the backend command as gunicorn with
three workers, which is exactly the image's own CMD. The chart sets no command
in a deployment, so there is one place that decides how the application starts.

## Risks / Trade-offs

- **The migration is a rewrite of a path that currently works** → the manifests
  were verified running end-to-end. Mitigation: the tasks diff the chart's
  rendered output against the current kustomize output before deleting anything,
  so the chart has to reproduce a known-good state rather than be reasoned about.
- **A chart is more indirection than a manifest** → a reader now needs Helm's
  templating to see what is deployed. Accepted: the Tiltfile already templated
  these manifests by string substitution, so the indirection existed and was
  merely undocumented.
- **`helm --wait` does not wait for a Gateway** → and on kind a Gateway never
  reports `Programmed`, as the previous change found. The install must not gate
  on it; the smoke test reaches the stack through the Envoy Service as it does
  now.
- **Secrets in values are still possible** → `existingSecret` is offered, not
  enforced. A deployment can still put a secret key in a values file, and the
  chart cannot stop it. The README says which one to use where.
- **An untested production branch is still untested** → `frontend.mode: serve`
  and a non-hostPath media volume will be rendered and installed locally, but
  "installs on kind" is not "runs in production". Nothing here claims otherwise.

## Migration Plan

1. Write the chart alongside the existing manifests.
2. Render it with development values and diff against `kubectl kustomize
   k8s/base` with the Tiltfile's substitutions applied; reconcile until the only
   differences are ones the chart intends.
3. Switch the Tiltfile to `helm()`, bring the stack up, and re-run the checks the
   previous change used: one origin, no CORS headers, two worktrees side by side.
4. Delete `k8s/base` and `k8s/overlays`.
5. Update CI's smoke job to render the chart.

Rollback is reverting the commit; nothing outside the cluster changes, and the
data lives on volumes the chart is told to keep.

## Open Questions, Resolved

- **Whether CI should publish the chart as an OCI artefact.** No, for now. It
  would make a deployment a `helm install` of a versioned chart rather than a
  checkout, which is the right end state — but there is nowhere to deploy, so it
  would be publishing versions nobody installs. CI renders every branch of the
  chart on every change instead, which is the part that catches mistakes. Revisit
  when a target cluster exists.
- **Whether ingestion belongs in the chart.** Yes, as a plain Job template
  disabled by default — not a Helm hook, which would run on every upgrade and is
  exactly when nobody asked for it. It is the only definition of that Job now:
  the Tiltfile's button renders it from the chart rather than keeping a second
  copy, and `k8s/ingest-job.yaml` is gone.
- **Whether the chart should carry a `NOTES.txt`.** No. It would print a URL that
  is right only when a hostname is set and a load balancer has assigned an
  address — neither true locally — and it is noise in a pipeline.

## Discovered While Building

- **The backend had no health endpoint, and `/graphql/` cannot be one.** A GET
  there serves GraphiQL, which is registered only when `DEBUG` is on, so the
  probe the development manifests used passes locally and fails in exactly the
  environment where a failing probe means the pod never becomes ready — as it
  did, on the first real install. A trivial `/healthz/` was added and the probe
  path became `backend.probePath`.
- **Live update into the backend was broken by a root-owned `/app`.** `WORKDIR`
  creates the directory as root and `COPY --chown` only sets ownership of what
  lands in it, so the non-root user could not write there. Tilt's sync extracts a
  tar, which needs write permission on the directory, so every synced backend
  edit failed and the pod kept serving the image's code. The image now chowns
  `/app`.
- **Generating a file into `.tilt/` and then rendering from it is a reload
  loop.** `helm(values=[...])` watches the values files it is handed, and the
  Tiltfile rewrites them on every execution, so the write triggers the reload
  that performs the write. The old kustomize path had the same shape — generate
  `.tilt/overlay/kustomization.yaml`, then `kustomize(".tilt/overlay")` — so this
  is likely long-standing rather than new. `.tiltignore` now excludes `.tilt/`:
  everything in it is derived, and the sources it derives from are watched
  already. An edit to `.env` still triggers exactly one reload.
- **Django serves nothing at `/media/` when `DEBUG` is off**, because the
  `static()` helper that serves ingested clips is inside a `if settings.DEBUG`.
  The HTTPRoute sends `/media` to the backend in every environment, so a
  deployment would 404 on every audio clip. Not fixed here: choosing how a
  deployment serves media is a decision of its own, and this change is about
  parameterising the deployment rather than designing it.
