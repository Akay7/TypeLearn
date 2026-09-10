## Why

Two paths the application depends on are served only when `DEBUG` is on, which
is to say only in development:

- **`/media/`** — every exercise plays a clip from it. `urls.py` adds the media
  route inside `if settings.DEBUG`, so a deployment 404s on all of them. This was
  recorded as a deferred decision by the `production-helm-chart` change, which
  parameterised the deployment rather than designing it.
- **`/static/`** — the Django admin's CSS. Nothing collects static files and
  nothing serves them, so the admin renders unstyled anywhere `DEBUG` is off.

Neither is new. What is new is that local bring-up now defaults to what a
deployment runs — gunicorn behind nginx, `DEBUG` off — so both gaps are visible
on every `tilt up` rather than only after an install. A default nobody could run
successfully is not a default, so the two have to be closed together.

## What Changes

- **`/media/` is served by a web server, not by the application.** A small nginx
  Deployment mounts the media volume read-only, and the Gateway routes `/media`
  to it in every environment. The clips are written at runtime by ingestion and
  read by every exercise; serving them from three gunicorn workers puts the
  audio bandwidth and the GraphQL latency in the same three slots.
- **`/static/` is served by WhiteNoise, inside the application.** Django's static
  files are collected into the image at build time and served by middleware, in
  every environment. They are a fixed, small set decided at build time, which is
  what WhiteNoise is for; they need no second Deployment.
- **The `if settings.DEBUG` media branch in `urls.py` is removed.** One path
  serves the clips in development and in a deployment, so the arrangement that
  ships is the one exercised every day — rather than a development-only branch
  standing in for a production behaviour nobody runs.
- **BREAKING (developer-facing)**: local bring-up already defaults to the
  deployment shape; `TYPELEARN_DEV_MODE=1` opts into the development affordances
  (the `dev`/`build` image stages, source sync, Vite's hot reload, `DJANGO_DEBUG`
  and the wildcard host list, a database role that may create databases, and the
  buttons that run the suites in the pod). `TYPELEARN_DEBUG_BACKEND` implies it,
  since `debugpy` ships only in the dev image. This is implemented already and is
  recorded here because it is what makes the two gaps above load-bearing.

## Capabilities

### New Capabilities

None. Both paths already exist and are already routed; this is about what answers
on them.

### Modified Capabilities

- `production-deployment`: gains a requirement that everything the application
  serves — the SPA, the API, the clips, and Django's static files — is served in
  every environment, by something chosen for the job rather than by the
  application's debug mode, with the media store readable by a server that is not
  the backend.
- `local-dev-environment`: bring-up defaults to the deployment shape, with the
  development affordances opt-in behind one switch; and `/media` is routed to the
  media server rather than to Django, in development as in a deployment.

## Impact

- **New**: `whitenoise` in the backend's runtime dependencies; `STATIC_ROOT` and
  the WhiteNoise middleware in settings; `collectstatic` in the backend image's
  runtime stage; `chart/templates/media-server.yaml` (Deployment, Service, and
  the nginx configuration) with values under `media.server`; a `/media` rule in
  the HTTPRoute pointing at it.
- **Changed**: `src/backend/typelearn/urls.py` (the DEBUG-only media route goes),
  `chart/templates/httproute.yaml`, `chart/values.yaml`, `Tiltfile` (mode
  switch — done), `README.md`, `.envrc.local.example`, and the CI chart job,
  which renders every branch the chart offers.
- **Unchanged**: the Gateway, the single origin, the database, ingestion, the
  media volume's shape and sharing, the GraphQL schema, and every test's
  behaviour. The frontend addresses clips by the same `/media/...` path it
  always has.
- **Not in scope**: moving the clips to object storage or a CDN. The chart gains
  a switch to route `/media` elsewhere, but no deployment here uses one.
