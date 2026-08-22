## 1. Backend scaffold

- [x] 1.1 Add runtime dependencies to `src/backend/pyproject.toml` via Poetry: `django`, `strawberry-graphql-django`, `psycopg[binary]`, `django-cors-headers`, `gunicorn`, `Pillow`; commit the resulting `poetry.lock`
- [x] 1.2 Add dev dependencies `pytest` and `pytest-django` to a dev group
- [x] 1.3 Create the Django project `typelearn` in `src/backend/` so that `manage.py` sits beside `pyproject.toml` and the settings module is `typelearn.settings`
- [x] 1.4 Create the `exercises` app and add it, plus `corsheaders`, to `INSTALLED_APPS`
- [x] 1.5 Configure `DATABASES` to read `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` from the environment with development defaults, so `manage.py check` runs before the container is up
- [x] 1.6 Set `MEDIA_ROOT` to `src/backend/media/` and `MEDIA_URL` to `/media/`, and serve media from `urls.py` when `DEBUG` is on
- [x] 1.7 Add `pytest.ini` (or `[tool.pytest.ini_options]`) pointing `DJANGO_SETTINGS_MODULE` at `typelearn.settings`
- [x] 1.8 Verify `poetry run python manage.py check` exits 0 with no `fields.E120` and no missing-app errors

## 2. Local database

- [x] 2.1 Create `db.example.env` at the repository root listing `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` with placeholder values
- [x] 2.2 Create a local `db.env` with real values and confirm `git status` does not offer it for commit
- [x] 2.3 Write `podman-compose.yml` defining a `db` service on `postgres:17`, attached to the `typelearn-net` network, with `env_file: db.env`, a named volume for `/var/lib/postgresql/data`, and the port published to the host
- [x] 2.4 Create the network (`podman network create typelearn-net`) and bring the service up with `podman-compose up -d`
- [x] 2.5 Verify the backend connects: `poetry run python manage.py migrate` applies Django's built-in migrations
- [x] 2.6 Verify persistence: stop and restart the container, then confirm the applied migrations are still recorded

## 3. Models and migration

- [x] 3.1 Add the `Exercise` model to `exercises/models.py` with `sentence` (`CharField(max_length=255, unique=True)`), `sentence_id` (`CharField(max_length=64, blank=True)`), `original_audio` (`FileField`), `up_votes` (`IntegerField(default=0)`), `difficulty` (`IntegerField(default=1)`), `created_at` (`DateTimeField(auto_now_add=True)`)
- [x] 3.2 Add the `Progress` model with `exercise` (FK, `on_delete=CASCADE`), `typed_text` (`CharField(max_length=255)`), `is_correct` (`BooleanField`), `attempts` (`IntegerField(default=0)`), `created_at` (`DateTimeField(auto_now_add=True)`)
- [x] 3.3 Generate the initial migration and apply it against the running container
- [x] 3.4 Register both models in `exercises/admin.py` so rows can be eyeballed without a shell
- [x] 3.5 Write model tests: duplicate `sentence` raises an integrity error, deleting an `Exercise` cascades to its `Progress` rows, a 25-character sentence persists without truncation

## 4. Corpus ingestion

- [x] 4.1 Create `exercises/management/commands/load_corpus.py` taking a required corpus-root argument and an optional exercise-count option (default 100)
- [x] 4.2 Fail with a non-zero exit and a message naming the missing path when the corpus root has no `th/validated.tsv`; fail explicitly when pointed at `validated_sentences.tsv`, naming the absent `up_votes` and `path` columns
- [x] 4.3 Read `th/clip_durations.tsv` into a filename-to-milliseconds dict in one pass
- [x] 4.4 Stream `th/validated.tsv` and apply the filters: `up_votes >= 2`, `down_votes == 0`, sentence length 10–25 code points inclusive, duration present and ≤ 6000 ms, clip file present under `th/clips/`
- [x] 4.5 Order survivors by `up_votes` descending, then duration ascending, then `sentence_id` ascending; walk that order keeping the first row per distinct sentence and take the first 100
- [x] 4.6 Fail with a message stating the candidate count when fewer than the requested number survive
- [x] 4.7 Implement the difficulty function: length and duration each mapped onto a 0–2.5 band, summed, rounded, clamped to 1–5
- [x] 4.8 Copy each selected clip into `MEDIA_ROOT`, skipping a destination that already exists at the same size, and set `original_audio` to its media-relative path
- [x] 4.9 Persist rows with `update_or_create` keyed on `sentence`, and print a summary of created, updated, and copied counts

## 5. Ingestion tests

- [x] 5.1 Add a fixture builder that writes a miniature corpus (TSV headers matching the real files, plus empty `.mp3` clips) into `tmp_path`
- [x] 5.2 Test each filter rejects its own case: low `up_votes`, any `down_votes`, 9-character and 26-character sentences, a 6001 ms clip, a row whose clip file is missing
- [x] 5.3 Test the length filter counts code points, not bytes, using Thai text with combining marks at exactly 10 and exactly 25 characters
- [x] 5.4 Test ordering and deduplication: duplicate sentences collapse to the highest-voted clip, and ties on votes and duration resolve by `sentence_id`
- [x] 5.5 Test determinism: two runs over the same fixture corpus select the same ids in the same order
- [x] 5.6 Test idempotence: running twice leaves the row count unchanged and raises no uniqueness error
- [x] 5.7 Test the short-corpus failure: fewer candidates than requested exits non-zero with the count in the message and writes no rows
- [x] 5.8 Test difficulty stays within 1–5 and that a short sentence with a short clip scores below a long sentence with a long clip
- [x] 5.9 Verify the whole suite passes with `poetry run pytest`

## 6. Real data load

- [x] 6.1 Run `load_corpus` against the local Common Voice release directory, passing its path as the argument
- [x] 6.2 Verify 100 `Exercise` rows exist, each with a non-empty `sentence`, a `difficulty` in 1–5, and an `original_audio` pointing at a file that exists
- [x] 6.3 Verify 100 `.mp3` files landed in `MEDIA_ROOT` and play
- [x] 6.4 Re-run the command and confirm the row count stays at 100 with no error
- [x] 6.5 Confirm `git status` lists nothing from `data/`, `MEDIA_ROOT`, `.venv/`, or `db.env`

## 7. Frontend scaffold

- [x] 7.1 Scaffold a Vue 3 + Vite project in `src/frontend/` so `package.json` and `vite.config.js` sit at its root
- [x] 7.2 Install `pinia` as a runtime dependency and register it on the app instance
- [x] 7.3 Install `tailwindcss` and `@tailwindcss/vite` as dev dependencies, add `tailwindcss()` to `plugins` in `vite.config.js`, and put `@import "tailwindcss";` in the main stylesheet — no `tailwind.config.js`, no PostCSS config
- [x] 7.4 Verify `npm run dev` serves the starter page and a Tailwind utility class visibly applies
- [x] 7.5 Verify `npm run build` completes and `git status` lists nothing from `node_modules/` or `dist/`

## 8. Wrap-up

- [x] 8.1 Record the local setup sequence (network, compose up, `db.env`, migrate, `load_corpus`) in a short README section so the steps are not only in this task list
- [x] 8.2 Tick the M1 and M2 checkboxes in `specs/roadmap.md` and add a decision-log row for the seedless deterministic ordering
- [x] 8.3 Run `openspec validate scaffold-and-load-corpus` and confirm the change is still valid
