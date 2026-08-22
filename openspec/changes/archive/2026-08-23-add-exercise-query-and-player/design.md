## Context

M1 and M2 are merged: `Exercise`/`Progress` models, the initial migration, and a `load_corpus` command that has already put 100 rows in the Podman PostgreSQL container with their clips under `src/backend/media/clips/`. The pieces that would let anyone *see* that data do not exist — `typelearn/urls.py` routes only `admin/` and the dev media route, there is no `schema.py`, and `App.vue` still renders `HelloWorld.vue`.

Constraints inherited from earlier decisions:

- `django-cors-headers` and `strawberry-graphql-django` (0.87.0, on strawberry-graphql 0.324.0) are already installed and locked; `corsheaders.middleware.CorsMiddleware` is already in `MIDDLEWARE` but nothing configures it.
- Strawberry's `auto_camel_case` stays on, so `up_votes` publishes as `upVotes`.
- Clips are served in development by `static(settings.MEDIA_URL, ...)` from `urls.py`, gated on `DEBUG`.
- The frontend runs on the Vite dev origin (`http://localhost:5173`), the backend on `http://localhost:8000`. Two origins is the default state of this project, not an edge case.

## Goals / Non-Goals

**Goals:**

- One GraphQL query serving the real ingested rows, reachable from a browser on the Vite origin.
- A Vue view that fetches one exercise and shows its sentence, with visible loading and failure states.
- A play/replay control that loads the clip through the URL the API returned, closing the loop from PostgreSQL row to audible sound.
- Frontend state shaped so M6 (keyboard/input) and M7 (checking) plug into it without rework.

**Non-Goals:**

- Mutations, and therefore any real CSRF or auth story. No `Progress` write.
- Pagination, filtering, or exercise selection strategy — `limit` is the only argument.
- Production serving of media. `DEBUG=False` deliberately leaves media unserved; that is a deployment concern outside the MVP.
- Styling beyond what makes the sentence legible. The Thai sentence needs to be large; nothing else needs design.

## Decisions

### `strawberry_django.type` over a hand-written type

Declare `ExerciseType` with `@strawberry_django.type(Exercise)` and explicit field declarations, rather than a plain `@strawberry.type` with manual resolvers. The model fields (`id`, `sentence`, `sentence_id`, `up_votes`, `difficulty`) map straight through with their nullability derived from the model, which is exactly the contract already published in `openspec/specs/exercise-api/spec.md`. Only `audio_url` needs a resolver.

*Alternative considered:* a plain Strawberry type with six manual field definitions. Rejected — it duplicates the model and drifts from it silently, which is the failure mode M2's `fields.E120` episode already demonstrated.

### `audioUrl` is built from the request

The resolver returns `info.context.request.build_absolute_uri(root.original_audio.url)`, producing `http://localhost:8000/media/clips/<file>.mp3`.

This is the crux of the change. `FileField.url` yields `/media/clips/…`; an `<audio src="/media/…">` on a page served from `:5173` resolves against Vite and 404s. Building from the request keeps the URL correct without hardcoding a host in settings, and follows whatever origin the client actually reached the backend on.

*Alternatives considered:* (a) a `MEDIA_HOST` setting prepended to `FileField.url` — one more thing to keep in sync with how the developer is running the server, and wrong the moment the port changes; (b) leaving the URL relative and letting the frontend prepend its configured backend origin — pushes backend knowledge into the client and contradicts the spec's "without further transformation by the client".

Note that no CORS header is needed for the audio itself: an `<audio>` element without a `crossorigin` attribute performs a plain media fetch, not a CORS request. Only the GraphQL POST needs CORS.

### `/graphql/` is mounted `csrf_exempt`

Strawberry's Django `GraphQLView` is an ordinary Django view, so `CsrfViewMiddleware` will reject the frontend's cross-origin POST for want of a CSRF token. Wrap the view in `csrf_exempt` in `urls.py`.

This is safe for what this schema is: read-only, unauthenticated, no cookies consulted, nothing to forge. It stops being safe as soon as a mutation lands, so the exemption carries a comment saying so, and revisiting it is a precondition for the first mutation rather than a task in this change.

*Alternative considered:* fetching a CSRF cookie from the frontend and sending `X-CSRFToken`. Real work, real complexity, protecting a query that returns public sentences.

### GraphiQL on when `DEBUG` is on

`GraphQLView.as_view(schema=schema, graphiql=settings.DEBUG)`. Being able to open `/graphql/` and run the query by hand is how the backend half of "does it really work" gets verified before any Vue code exists — and it satisfies the spec's introspection-in-development requirement.

### Frontend state lives in a Pinia store

`stores/exercise.js` exposes `current`, `status` (`loading` / `ready` / `error` / `empty`), and a `load()` action; `SentenceView.vue` and `AudioPlayer.vue` read from it. Pinia is already installed and wired in `main.js`.

The alternative — a `ref` inside `SentenceView` — is smaller today and wrong by M6: the keyboard, the input field, and the check result all need the same exercise, and lifting state out of a component after the fact is the kind of rework this ordering was meant to avoid. The store is ~30 lines and it is where M7's "load the next exercise" belongs.

### Native `fetch`, no GraphQL client

One query, one shape. `graphql-tag`, urql, or Apollo would add a dependency and a cache layer for a single `POST` with a string body. `specs/tech-stack.md` already sanctions "native fetch for MVP".

The GraphQL errors array is checked explicitly — a GraphQL error arrives as HTTP 200 with `errors` in the body, so `response.ok` alone would report success on a broken query. That check is what makes the spec's "response carries GraphQL errors" scenario fail loudly instead of rendering an empty sentence.

### The backend origin is configuration, not a literal

`src/frontend/.env.development` sets `VITE_API_URL=http://localhost:8000/graphql/`, read via `import.meta.env`. The file is committed — it holds no secret, and `.gitignore`'s `*.env` pattern does not match `.env.development`. Symmetrically, `CORS_ALLOWED_ORIGINS` in settings reads `CORS_ALLOWED_ORIGINS` from the environment and defaults to `http://localhost:5173,http://127.0.0.1:5173`.

Both origins are listed because CORS matches on the literal string: a developer who opens `127.0.0.1:5173` gets a blocked request if only `localhost` is allowed, and the resulting error is opaque.

### Tests exercise the HTTP endpoint, not just the schema

`exercises/tests/test_schema.py` POSTs to `/graphql/` with the Django test client and asserts on the JSON body — camelCase field names, `limit`, an absolute `audioUrl`, empty-catalog behaviour, and that a `snake_case` query fails validation. Going through the URL conf means the tests cover the routing, the CSRF exemption, and the view wiring, all of which are places this change can break. Rows come from `Exercise.objects.create` in the test, not from the ingested database.

## Risks / Trade-offs

- **The dev-only media route** → `urls.py` serves media only when `DEBUG`. With `DJANGO_DEBUG=false` every `audioUrl` 404s while the GraphQL response still looks perfect. Accepted for the MVP; the failure is loud (silent player, 404 in the network tab) and deployment is explicitly out of scope.
- **`csrf_exempt` on a shared URL** → the exemption applies to the whole endpoint, so a future mutation inherits it silently. Mitigated by a comment at the exemption stating the precondition, and by this change adding no mutation.
- **Absolute URLs bake in the request host** → a proxy or tunnel that rewrites `Host` produces URLs pointing at the wrong place unless `USE_X_FORWARDED_HOST` is set. Not a dev concern; noted here so it is not rediscovered later.
- **Vue starter files removed** → deleting `HelloWorld.vue` and its assets touches files nothing else references, and `App.vue` is rewritten wholesale. Low risk, but it does mean `npm run dev` output changes completely; the acceptance check below is what confirms the replacement works.
- **Pinia store ahead of its second consumer** → the store is justified by M6/M7, which are not in this change. If those milestones change shape, the store is ~30 lines to rewrite.

## Verification

The change is done when, with the container up and `runserver` and `npm run dev` both running:

1. `curl -s localhost:8000/graphql/ -H 'Content-Type: application/json' -d '{"query":"{ exercises(limit: 1) { id sentence audioUrl difficulty } }"}'` returns one exercise whose `audioUrl` starts with `http://`.
2. That `audioUrl`, fetched directly, returns an `audio/mpeg` body.
3. `http://localhost:5173` shows a Thai sentence in large text with a character count under it, and no console error.
4. Clicking play produces sound; clicking again while it plays restarts it from the start.
5. `poetry run pytest` passes, including the new schema tests.

Stopping the backend and reloading the frontend shows the error state rather than a blank page — that is the check that step 3's success was real and not a cached page.
