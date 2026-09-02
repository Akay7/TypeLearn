## Context

The Gateway routes four prefixes to Django: `/graphql`, `/media`, `/admin`,
`/static`. Two of them are answered only when `DEBUG` is on.

- `urls.py` appends `static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)`
  inside `if settings.DEBUG:`. With debug off there is no `/media/` route at all,
  so every clip 404s.
- `settings.py` declares `STATIC_URL` and no `STATIC_ROOT`. Nothing collects
  Django's static files and nothing serves them, so the admin is unstyled
  wherever debug is off.

The clips are not a fixed asset set: `Exercise.original_audio` is a
`FileField(upload_to='clips/')` and the ingest Job writes into the media volume
while the stack runs. The volume is `ReadWriteMany`, shared by every worktree in
development and provisioned storage in a deployment.

The local default now renders the chart with `DJANGO_DEBUG=false` and the
production image stages, so both gaps appear on `tilt up`. That is the intended
effect of the flip and the reason this change follows it immediately.

## Goals / Non-Goals

**Goals:**
- `/media/` and `/static/` answer in every environment, with no dependence on
  `DEBUG`.
- One path serves the clips in development and in a deployment, so the
  arrangement that ships is the one exercised daily.
- Serving audio does not consume the application's request workers.
- No second description of the stack: one chart, values choosing the branches.

**Non-Goals:**
- Object storage or a CDN for the clips. The chart gains a switch that lets a
  deployment route `/media` elsewhere; nothing here uses it.
- Access control on media. The clips are public; `X-Accel-Redirect` and signed
  URLs are what this would grow into, and neither is needed by the MVP.
- Compression, image processing, or a cache layer in front of the media server.

## Decisions

### WhiteNoise for `/static/`, nginx for `/media/` — not one for both

Both were read rather than assumed. WhiteNoise 6.12:

- **Range requests**: supported. `responders.py` parses `HTTP_RANGE` and returns
  `206` with `Content-Range`; a multi-range request raises and falls back to a
  full `200`. Adequate for `<audio>`.
- **The file index is built at startup.** `WhiteNoise.add_files` calls
  `update_files_dictionary`, which walks the tree once into `self.files`, and
  `__call__` looks the request path up in that dict. Only with
  `autorefresh=True` does it stat the filesystem per request — and the Django
  middleware defaults `autorefresh` to `settings.DEBUG`.
- **Prefixes**: `STATIC_ROOT` is mounted at `STATIC_URL`; the one extra directory
  it takes, `WHITENOISE_ROOT`, is mounted at `/`. Serving `MEDIA_ROOT` at
  `/media/` needs a subclass calling `add_files(MEDIA_ROOT, prefix="/media/")`.

So WhiteNoise on media means: a subclass, plus `autorefresh=True` in production
(otherwise a clip ingested after the pod started 404s until it restarts), plus
every audio byte flowing through one of three gunicorn workers, where a slow
client on a phone network occupies a slot the GraphQL endpoint needs.

Static files are the opposite case in every respect: fixed at build time, tiny,
already inside the image, needing no volume. WhiteNoise costs one dependency and
two settings there and earns a Deployment's worth of nothing.

**Alternatives considered.** *nginx for both*: an init container would have to
copy `collectstatic` output onto a shared volume, so the admin's CSS becomes a
volume and a start-order dependency — more moving parts for the easier half.
*Django serving media unconditionally* (deleting the `if settings.DEBUG`): one
line, and it keeps audio bandwidth inside gunicorn permanently, which is the
thing the deployment shape exists to avoid.

### A media Deployment of its own, not a sidecar and not the frontend pod

The media server is a separate Deployment and Service mounting the media PVC
read-only.

- *A sidecar in the backend pod* would tie the media server's replica count to
  the backend's and put the audio behind the backend's rollouts; the Service
  routing also becomes a second port on a pod whose readiness is Django's.
- *The frontend's nginx* already serves the SPA, but in development mode that pod
  is Vite, so `/media` would be served by different things in the two modes —
  losing exactly the property this change is for. It would also mount storage
  into the pod that scales with page traffic.

A separate Deployment keeps the media path identical in both modes, scales on its
own, and needs no application image change.

### The nginx configuration is a ConfigMap, and the image is stock

`nginx:1.30-alpine`, pinned in values like the database image is, with its server
block rendered into a ConfigMap and mounted at
`/etc/nginx/conf.d/default.conf`. No image is built for it: an image would be a
third thing to build, push, and keep in step for twelve lines of configuration.

The server block does four things: `alias` the mounted store under `/media/`,
`autoindex off` so the store is not browsable, a `Cache-Control` for clips, and
`location = /healthz` returning 200 for the probes — the store may legitimately
be empty, so probing a clip would fail a healthy pod.

### `collectstatic` runs in the image build, not at pod start

`RUN python manage.py collectstatic --noinput` in the backend Containerfile's
runtime stage. Collecting at start would make every pod repeat it, make readiness
wait on it, and allow two replicas built from one image to disagree about what
they serve. `STATIC_ROOT` is a path in the image; nothing mounts over it.

`collectstatic` imports settings, so the build needs a `DJANGO_SECRET_KEY` — the
settings module already defaults it, and no build-time value reaches runtime.

### `/media` is routed by the Gateway, not by Django

The HTTPRoute gains a rule sending `/media` to the media Service; `/graphql`,
`/admin` and `/static` keep going to the backend. Routing is where this decision
belongs: the application then has no media route at all, in any mode, and the
`if settings.DEBUG` branch in `urls.py` is deleted rather than left as a second
answer to the same request.

`media.server.enabled: false` renders no media server and no `/media` rule, for a
deployment serving clips from elsewhere. Both branches are rendered by CI, as the
chart's other branches are.

### Development mode is a switch, and the default is the deployment shape

Already implemented, recorded here for the record. The Tiltfile builds the
`runtime` and `serve` stages, sets no backend command, forces `DJANGO_DEBUG=false`
and a narrow `DJANGO_ALLOWED_HOSTS` on the way into the chart, and offers no
buttons that its pods cannot run. `TYPELEARN_DEV_MODE=1` restores all of it;
`TYPELEARN_DEBUG_BACKEND` implies it, because `debugpy` is a dev dependency.

`.env` keeps its development values — it is also read by host-run management
commands — and bring-up overrides those two settings rather than asking anyone to
edit a file and remember to put it back.

## Risks / Trade-offs

- **A third Deployment to keep healthy.** → It is stock nginx over a read-only
  mount with a static config; it has no database, no secrets, and no state. Its
  readiness probe hits `/healthz`, so an empty store cannot make it look broken.
- **The media pod needs to pull `nginx:1.30-alpine`.** → In development that is
  one pull per cluster, cached by kind afterwards. CI creates a fresh cluster per
  run and will pull it once; the smoke test's timeout has room.
- **`alias` and path traversal.** → The `location /media/` prefix with a trailing
  slash on both sides, `autoindex off`, and a read-only mount. Nothing under the
  store is executable and nginx serves it as bytes.
- **Cache headers on clips could serve a stale file.** → Ingestion is
  deterministic and additive: a given path holds the same clip forever, and a
  re-ingest that changed one would write a new name (`FileField` de-duplicates by
  suffixing). A modest `max-age` is safe; it is a value, so a deployment can
  lower it.
- **The frontend suites are unaffected but touch audio.** → The browser suite
  synthesises its own audio and stubs the catalog, so it never requests
  `/media/`. Nothing in either suite asserts on Django's media route.
- **The host dev server's proxy.** → It forwards `/media/` to the Gateway, which
  now routes to the media server. No proxy change is needed, but it is worth
  checking once rather than assuming.
