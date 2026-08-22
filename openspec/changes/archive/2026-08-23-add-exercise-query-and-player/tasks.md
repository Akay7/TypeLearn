## 1. GraphQL schema (M3)

- [x] 1.1 Create `src/backend/exercises/schema.py` with `ExerciseType` via `@strawberry_django.type(Exercise)`, declaring `id`, `sentence`, `sentence_id`, `up_votes`, `difficulty`
- [x] 1.2 Add the `audio_url` field to `ExerciseType`, resolved as `info.context.request.build_absolute_uri(root.original_audio.url)`
- [x] 1.3 Add `Query` with `exercises(limit: Int = None)` returning the ordered queryset, sliced when `limit` is given, and `exercise(id: ID!)` returning the row or `None`
- [x] 1.4 Export `schema = strawberry.Schema(query=Query)` and confirm `auto_camel_case` is left at its default

## 2. Endpoint wiring

- [x] 2.1 Route `graphql/` in `typelearn/urls.py` to `GraphQLView.as_view(schema=schema, graphiql=settings.DEBUG)`, wrapped in `csrf_exempt` with a comment stating the exemption must be revisited before the first mutation
- [x] 2.2 Add `CORS_ALLOWED_ORIGINS` to `typelearn/settings.py`, read from the environment and defaulting to `http://localhost:5173,http://127.0.0.1:5173`
- [x] 2.3 Run `python manage.py check` and confirm no new errors

## 3. Backend tests

- [x] 3.1 Create `exercises/tests/test_schema.py` with a fixture creating a couple of `Exercise` rows (no dependency on the ingested database)
- [x] 3.2 Test that POSTing `{ exercises { id sentence audioUrl difficulty } }` to `/graphql/` returns HTTP 200 with a `data` key and no `errors`
- [x] 3.3 Test that `{ exercises { sentence up_votes } }` fails validation, and `upVotes` succeeds
- [x] 3.4 Test that `exercises(limit: 1)` returns exactly one item and that an empty catalog returns `[]` rather than an error
- [x] 3.5 Test that `audioUrl` is absolute — starts with `http://` and contains the media path — and that `exercise(id:)` returns the row for a known id and `null` for an unknown one
- [x] 3.6 Run `poetry run pytest` and confirm the whole suite passes

## 4. Manual backend verification

- [x] 4.1 With the container up and `runserver` running, `curl` the documented query and confirm one real ingested exercise comes back
- [x] 4.2 Fetch the returned `audioUrl` directly and confirm it returns an `audio/mpeg` body
- [x] 4.3 Open `/graphql/` in a browser and confirm GraphiQL loads and the query runs

## 5. Frontend data layer (M4)

- [x] 5.1 Add `src/frontend/.env.development` with `VITE_API_URL=http://localhost:8000/graphql/`
- [x] 5.2 Create `src/frontend/src/stores/exercise.js` — a Pinia store holding `current` and `status` (`loading` / `ready` / `error` / `empty`) with a `load()` action using native `fetch`
- [x] 5.3 In `load()`, check both `response.ok` and the GraphQL `errors` array, log the underlying error to the console, and set `status` to `error`; set `empty` when the query succeeds with no exercises

## 6. Sentence view (M4)

- [x] 6.1 Create `components/SentenceView.vue` rendering the sentence in large text with the character-count hint beneath it
- [x] 6.2 Render the loading, error, and empty states from the store's `status` instead of a blank area
- [x] 6.3 Rewrite `App.vue` to mount `SentenceView` in a single centered column and trigger `load()` on mount
- [x] 6.4 Delete `components/HelloWorld.vue` and the starter assets it referenced

## 7. Audio playback (M5)

- [x] 7.1 Create `components/AudioPlayer.vue` with an `<audio>` element whose `src` is the exercise's `audioUrl` and a play/replay button
- [x] 7.2 Make the control restart playback from zero when pressed during or after a clip, not resume
- [x] 7.3 Mount `AudioPlayer` beneath the sentence in `SentenceView`, rendered only when an exercise is loaded

## 8. End-to-end verification

- [x] 8.1 With both servers running, load `http://localhost:5173` and confirm a Thai sentence and its length hint render with no console error
- [x] 8.2 Click play and confirm audio is audible; click again mid-clip and confirm it restarts
- [x] 8.3 Stop the backend, reload the page, and confirm the error state renders instead of a blank page
- [x] 8.4 Open the app on `http://127.0.0.1:5173` and confirm CORS does not block the request

## 9. Documentation

- [x] 9.1 Tick the M3, M4, and M5 checklists in `specs/roadmap.md`
- [x] 9.2 Note the `/graphql/` endpoint and the frontend's `VITE_API_URL` in `README.md`
