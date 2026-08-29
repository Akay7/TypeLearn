## Why

The project can now run its whole stack locally, but it still has no way to
describe a deployment. `k8s/overlays/prod` names the two places development
differs — nginx instead of the dev server, a real StorageClass instead of a
hostPath — and stops there: nothing parameterises the image tag, the hostname,
the database size, the replica count, or the secret key. It is a sketch of
production, not something that could be installed anywhere.

Meanwhile the deployment target has requirements the kustomize base cannot
express without forking it. A real cluster needs its Postgres storage sized and
classed, its credentials supplied rather than generated into a committed file,
and its hostname routed with TLS. Different environments need different values
for all of those, and kustomize's answer — an overlay per environment, each
patching the same fields — is the copy-paste this project has been avoiding.

A chart is the shape that fits: one set of templates, and a values file per
place it runs.

## What Changes

- **A Helm chart is added at `chart/`**, covering the backend, the frontend, the
  Gateway and HTTPRoute, the media volume, and the CloudNativePG database.
- **BREAKING** `k8s/base` and `k8s/overlays` are removed. The chart is the only
  description of the stack, and **Tilt renders that same chart** with development
  values — so a template can never be right in production and wrong in
  development, which is the property the previous change was built to get.
- **Every backend environment variable is settable from values.** A map renders
  into a ConfigMap, so adding a setting is a values entry rather than a template
  edit.
- **Secrets are separated from configuration.** A second map renders into a
  Secret for simple installs, and `existingSecret` points at a Secret the chart
  does not create, for clusters where one is supplied by an operator. The
  database's own credentials keep coming from the ones CloudNativePG generates.
- **The database is parameterised**: instances, image, storage size, storage
  class, and resources. Setting `postgres.enabled: false` swaps the in-cluster
  cluster for an external database, so a managed Postgres is a values change
  rather than a fork.
- **The two dev/prod differences become values**, not a separate overlay: the
  frontend runs the dev server or nginx by a mode switch, and the media volume is
  a shared hostPath or an ordinary claim depending on whether a host path is set.

## Capabilities

### New Capabilities

- `production-deployment`: what the chart must install, what a deployment has to
  supply, what it may override, and the rules that keep one set of templates
  serving both a laptop and a cluster.

### Modified Capabilities

None. `local-dev-environment` and `continuous-integration` describe the stack in
terms of what runs and what it serves, never in terms of the tool that renders
the manifests, so replacing kustomize with Helm leaves both true as written.

## Impact

- **Depends on `tilt-dev-cluster-and-ci`**, which is implemented but not yet
  archived. This change edits the files that one created and should land after it.
- **New**: `chart/` — `Chart.yaml`, `values.yaml`, templates, and a documented
  production values example.
- **Removed**: `k8s/base/`, `k8s/overlays/`. `k8s/kind.yaml` and the Calico
  bootstrap manifests stay: they configure the cluster, not the application.
- **Changed**: the Tiltfile's deploy path renders the chart instead of kustomize,
  and the per-worktree namespace and port become values rather than a string
  substitution; CI's smoke job renders the chart the same way.
- **Unchanged**: images, application code, the single origin, the shared media
  directory in development, and every test.
- The chart installs no operators. Calico, its Gateway API support, and the
  CloudNativePG operator are cluster prerequisites, as they already are locally —
  an application chart that installed cluster-scoped controllers would fight
  every other release that did the same.
