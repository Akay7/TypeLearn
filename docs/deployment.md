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

### Loading the exercises

Ingestion is a Job the chart renders only when asked, never on install or
upgrade: it reads a Common Voice release in place and copies the selected clips
onto the media volume. The corpus has to be on a node, mounted from
`ingest.corpusHostPath`.

`ingest.count` decides how much of it is loaded. A positive integer selects that
many of the best candidates, and `all` selects every sentence the quality and
beginner filters admit. The chart default is `100`, a development-sized sample;
`values-prod.yaml.example` sets `all`. For the Thai 25.0 release, `all` is 21,429
exercises and about 400 MB of clips, and the Job runs for minutes, logging its
progress every thousand exercises. Any other value fails at render time.

```bash
kubectl delete job ingest -n typelearn --ignore-not-found
helm template typelearn ./chart --namespace typelearn --values my-values.yaml \
  --set ingest.enabled=true --set ingest.corpusHostPath=/srv/cv-corpus-25.0-2026-03-09 \
  --show-only templates/ingest-job.yaml | kubectl apply -n typelearn -f -
kubectl logs -n typelearn -f job/ingest
```

A Job's spec cannot change once created, which is why the old one is deleted
first. Re-running is safe: exercises already loaded are updated in place, clips
already on the volume are not copied again, and a larger count only adds what
the smaller one left out. Nothing is ever deleted.

The frontend never downloads the whole catalog, however large it is: each page
load asks for a random deck of 200 (`deck(size: 200)`), and a new deck is drawn
when the learner finishes one. The server caps a deck at
`EXERCISE_DECK_MAX_SIZE` (default 500), settable under `env:` like any other
backend variable.

### Translations

A learner can turn on a translation of each phrase into the interface language,
rate it, and suggest a better one. Nothing about this needs setting up for the
application to run: until translations exist, the setting shows "No translation
yet" and offers the suggestion form.

**Where machine translations come from.** They are committed with the backend,
in `src/backend/exercises/fixtures/translations/th.yaml`, so they ship in the
image. The ingest Job loads them after the corpus, which means a new
deployment, a rebuilt database, or a re-ingest gets them back without
translating anything. A deployment needs no provider key and runs no
translation. The file is made once on a developer's machine (see
[development.md](development.md#4-translations-optional)), and a correction is an
edit to it plus a release. To load a new version without re-ingesting, run
`python manage.py load_translations` in a backend pod.

**Suggestions and ratings.** Learners are anonymous, so both are identified by a
random id the browser keeps, plus an HMAC of the client address keyed by
`DJANGO_SECRET_KEY` — the address itself is never stored. Both are rate-limited
per hour (`TRANSLATION_PROPOSALS_PER_HOUR`, default 20; `TRANSLATION_RATINGS_PER_HOUR`,
default 300). The address comes from `X-Forwarded-For`, trusting the last
`TRUSTED_PROXY_COUNT` entries; the chart sets 1, for the Gateway. With another
proxy in front of the Gateway that also appends to the header, set it to 2 — too
low, and every learner shares one limit; too high, and a client can choose its own
address.

A suggestion is never shown until someone approves it. In the admin, under
**Translations**, the list opens on the pending ones, each beside its sentence and
the translation learners see now. **Approve** publishes the selection and
**Reject** hides it for good. Of the published translations of a phrase, learners
see the best rated, and a newly approved one wins a tie.

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
