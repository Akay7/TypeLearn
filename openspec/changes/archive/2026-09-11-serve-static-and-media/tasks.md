## 1. The default is the deployment shape (already implemented)

- [x] 1.1 Make `tilt up` with nothing set build the `runtime` and `serve` stages, sync nothing, set no backend command, and render `frontend.mode=serve`
- [x] 1.2 Override `DJANGO_DEBUG` to false and narrow `DJANGO_ALLOWED_HOSTS` on the way into the chart, leaving `.env` — which host-run management commands also read — untouched
- [x] 1.3 Put every development affordance behind `TYPELEARN_DEV_MODE=1`, and let `TYPELEARN_DEBUG_BACKEND` imply it, since `debugpy` ships only in the dev image
- [x] 1.4 Withhold the buttons that need the development images rather than offering ones that cannot run, and report the mode at bring-up
- [x] 1.5 Rename the generated values file, which is no longer development's alone, and document both modes in the README and `.envrc.local.example`

## 2. Django's static files, in every environment

- [x] 2.1 Add `whitenoise` to the backend's runtime dependencies (not the dev group — the image that ships is the one that needs it)
- [x] 2.2 Declare `STATIC_ROOT` in settings and insert `WhiteNoiseMiddleware` directly after `SecurityMiddleware`, where its own documentation puts it
- [x] 2.3 Run `collectstatic --noinput` in the backend Containerfile's `runtime` stage, so the files are in the image rather than collected at pod start
- [x] 2.4 Confirm the admin renders styled with `DJANGO_DEBUG=false`, and that `/static/` is still routed to the backend

## 3. A server for the media store

- [x] 3.1 Add `chart/templates/media-server.yaml`: a Deployment mounting the media PVC read-only, a Service, and a ConfigMap holding the nginx server block
- [x] 3.2 Serve `/media/` from the mounted store with `autoindex off`, a `Cache-Control` for clips, and a `location = /healthz` for the probes — the store may legitimately be empty, so probing a clip would fail a healthy pod
- [x] 3.3 Add `media.server` values: `enabled`, a pinned `nginx:1.30-alpine` image, replicas, resources, and the cache max-age
- [x] 3.4 Confirm the backend still mounts the same volume for writing, and that ingestion is unaffected

## 4. One media path, in both modes

- [x] 4.1 Route `/media` to the media Service in the HTTPRoute, leaving `/graphql`, `/admin` and `/static` on the backend
- [x] 4.2 Render nothing for `/media` — no server, no route rule — when `media.server.enabled` is false, so a deployment can serve clips from elsewhere
- [x] 4.3 Delete the `if settings.DEBUG` media branch from `src/backend/typelearn/urls.py`, so the application has no media route in any mode and there is one answer to the request
- [x] 4.4 Confirm the frontend's host dev server proxy still reaches the clips, since it forwards `/media/` to the Gateway

## 5. Prove it

- [x] 5.1 Bring the stack up in the default mode and fetch a clip through the Gateway: a `200` with `audio/mpeg`, served by the media server rather than Django
- [x] 5.2 Confirm a `Range` request returns `206` with a correct `Content-Range`, which is what seeking in `<audio>` depends on
- [x] 5.3 Ingest — or write — a clip while the stack is running and confirm it is served without restarting anything
- [x] 5.4 Confirm the same clip loads with `TYPELEARN_DEV_MODE=1`, through the same route, and that the exercise plays in the browser — the media server and the `/media` rule render identically in both modes (diffed), but the live check needs a dev-mode `tilt up`, which would take over the running stack
- [x] 5.5 Confirm the admin's CSS loads in both modes, and that the backend answers no `/media/` request itself in either

## 6. Keep it rendered and documented

- [x] 6.1 Extend CI's chart job to render both media branches, as it renders every other branch the chart offers
- [x] 6.2 Update `README.md`: the deployment section gains what serves what, and the note saying media 404s outside development goes
- [x] 6.3 Run the backend and frontend suites, and confirm the chart lints and renders offline
