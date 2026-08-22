## Why

M1 and M2 landed on `main`: the `Exercise` model, the migration, and 100 ingested exercises with their clips in `MEDIA_ROOT`. None of it is reachable from a browser — there is no GraphQL endpoint, and the Vue app still renders the Vite starter page. Nothing yet proves the pipeline actually works: rows exist in PostgreSQL, but no one has seen a sentence or heard a clip come out the other end.

This change closes that loop for a single exercise, which is the cheapest way to validate every layer at once — model → schema → HTTP → CORS → fetch → render → `<audio>`.

## What Changes

- **GraphQL endpoint (M3).** Add `src/backend/exercises/schema.py` with an `Exercise` Strawberry type and a `Query` exposing `exercises(limit: Int)` and `exercise(id: ID!)`; mount it at `/graphql/` with introspection and GraphiQL on in development.
- **`audioUrl` becomes absolute.** The resolver returns a fully-qualified URL (scheme + host + `MEDIA_URL` path), not a site-relative path. Under Vite the frontend runs on a different origin than Django, so a relative `/media/…` would resolve against the dev server and 404.
- **CORS configured.** `CORS_ALLOWED_ORIGINS` gains the Vite dev origin, so the browser's cross-origin GraphQL request succeeds. `corsheaders` is installed and in `MIDDLEWARE` already but never configured.
- **Sentence view (M4).** Replace the Vite starter page: `App.vue` renders a `SentenceView` component that fetches `{ exercises(limit: 1) { id sentence audioUrl difficulty } }` on mount and shows the Thai sentence in large text with a character-count hint below it. Native `fetch`, no GraphQL client dependency.
- **Audio playback (M5) — the offered addition.** An `AudioPlayer` component beneath the sentence with a play/replay control driving an HTML5 `<audio>` element from `audioUrl`. Included because it is what actually verifies `audioUrl`: without it the field is only ever asserted in a test, never loaded by a browser. Drop this bullet and the change still delivers M3 + M4.
- **Loading and failure states.** The view renders a loading state while fetching and a plain error message if the request fails or the catalog is empty, instead of a blank page. Needed for the verification above to be legible when something is misconfigured.
- Out of scope: the Thai keyboard, typed input, and answer checking (M6, M7). No `Progress` row is written.

## Capabilities

### New Capabilities

None. Both affected capabilities already have specs in `openspec/specs/`.

### Modified Capabilities

- `exercise-api`: the `audioUrl` requirement is sharpened from "a URL an `<audio>` element can load" to an absolute URL including scheme and host, because the dev frontend and the backend are different origins.
- `typing-practice`: adds a requirement for what the learner sees while the exercise is loading and when the fetch fails or returns nothing.

## Impact

- **Backend:** new `src/backend/exercises/schema.py`; `typelearn/urls.py` gains the `/graphql/` route; `typelearn/settings.py` gains `CORS_ALLOWED_ORIGINS`. New `exercises/tests/test_schema.py`. No model, migration, or ingestion change — the existing 100 rows are the fixture this is verified against.
- **Frontend:** `src/frontend/src/App.vue` rewritten; new `components/SentenceView.vue` and `components/AudioPlayer.vue`; the starter `HelloWorld.vue` and its assets removed. New `.env.development` (or equivalent) carrying the backend origin so the API URL is not hardcoded in a component.
- **Dependencies:** none added. `strawberry-graphql-django` and `django-cors-headers` are already in `pyproject.toml`; the frontend uses native `fetch`.
- **Roadmap:** completes M3, M4, and M5. The next change starts at M6.
