# Deploying TypeLearn

## Installing it somewhere

The stack is one Helm chart in [`chart/`](../chart/), and it is not a second
description of the manifests — it *is* the manifests. `tilt up` renders the same
chart with development values, so a template that works locally is a template a
deployment installs.

### What serves what

Four things are served, by three different servers, the same way in every
environment — none of them chosen by `DJANGO_DEBUG`:

| path | served by |
| --- | --- |
| `/` and the rest of the SPA | the frontend: nginx over the built bundle, or Vite in development mode |
| `/graphql/`, `/admin/` | Django |
| `/static/` (the admin's CSS) | Django, by WhiteNoise, from files `collectstatic` put in the image |
| `/media/` (the clips) | `media-server`: stock nginx over the media volume, read-only |

The clips get a server of their own because they are the one thing written at
runtime and read for every exercise. Serving them from Django would put audio
bandwidth and GraphQL latency in the same three gunicorn workers, and WhiteNoise
— which is right for the static files — builds its file index at startup, so a
clip ingested after the pod started would 404 until it restarted.

Set `media.server.enabled: false` and the chart renders neither the server nor
the `/media` route, for a deployment serving clips from object storage or a CDN.

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
built bundle, the clips served by the media server, and no development affordance
switched on.

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
