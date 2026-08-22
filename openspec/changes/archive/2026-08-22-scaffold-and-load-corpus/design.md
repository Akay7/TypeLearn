## Context

The repository today holds documents and one `pyproject.toml` with an empty
`dependencies` list. There is no `manage.py`, no Django project, no frontend, no
compose file, and no database. Every normative requirement in
`openspec/specs/exercise-catalog`, `openspec/specs/corpus-ingestion`, and
`openspec/specs/local-dev-environment` is currently unimplemented.

The corpus is a Common Voice release directory sitting outside the working tree,
alongside the repository. `th/validated.tsv` holds ~148k rows and
`th/clip_durations.tsv` ~366k rows; both are tab-separated with a header line. A dry
run of the documented filters (`up_votes >= 2`, `down_votes == 0`, 10–25 characters,
duration ≤ 6000 ms) leaves over 21,000 distinct sentences, so the 100-exercise target
is comfortably reachable and the interesting question is which 100, not whether 100
exist.

Constraints that shape the design: PostgreSQL 17 runs in Podman, credentials never
enter the repository, the corpus path is always a parameter, code-level names stay
language-neutral, and every `CharField` carries an explicit `max_length`.

## Goals / Non-Goals

**Goals:**
- A backend that answers `python manage.py check` cleanly and migrates against the
  containerised PostgreSQL 17
- A frontend scaffold that installs, builds, and serves — Vue 3 + Vite + Pinia +
  Tailwind 4 — ready for M4 to add components
- One re-runnable command that turns a corpus path into 100 rows plus 100 playable
  clips under `MEDIA_ROOT`
- Tests that pin the selection rules, the derivation formula, and idempotence without
  needing the real 40 GB corpus present

**Non-Goals:**
- The GraphQL schema, `/graphql/` endpoint, or CORS wiring (M3)
- Any frontend component, view, store, or styling beyond the scaffold (M4–M7)
- Writing `Progress` rows; the model exists, nothing populates it
- Deployment, Docker, CI, or a production static/media server
- A linguistic difficulty model; difficulty here is a documented heuristic

## Decisions

### Ingestion is a Django management command, not a standalone script

`python manage.py load_corpus <corpus_root>` gets settings, the ORM, and `MEDIA_ROOT`
resolved for free, and inherits Django's argument parsing and non-zero exit on error.
A standalone script under `scripts/` would need its own `django.setup()` bootstrap and
its own settings discovery. Considered and rejected: a data migration — migrations
should not depend on a filesystem path that exists on one developer's machine, and
re-running ingestion after a corpus update would mean editing applied history.

The command name is `load_corpus`, not `load_thai` or `load_common_voice`: the corpus
layout is the Common Voice one, but the name should survive a second language.

### Selection is a sort, not a sample

The archived spec asked for "the same seed" without defining one. Replacing the
sample with a total ordering — `up_votes` descending, duration ascending,
`sentence_id` ascending — removes the seed entirely: the output is a pure function of
the corpus. The ordering also encodes what "good MVP exercise" means, in priority
order: well-validated first, then short clips, with `sentence_id` as a tiebreak that
exists only to make the order total. Deduplication walks that order and keeps the
first row per distinct sentence, so a repeated sentence contributes its best clip.

Alternative considered: `random.Random(seed).sample(...)` with a seed constant in
settings. Rejected — it produces a defensible spread but makes the dataset depend on
a magic number and on Python's RNG implementation staying stable across versions.

### Duration lookup is a dict built in one pass

`clip_durations.tsv` is keyed by clip filename, `validated.tsv` by `path` holding that
same filename. Reading durations into a `dict[str, int]` first (~366k entries, tens of
MB) and then streaming `validated.tsv` row by row keeps the join to one pass over each
file and never materialises 148k row objects. Rows whose clip is absent from the
duration table are dropped as filter failures, not errors — the corpus does carry
clips with no duration entry.

### Sentence length is counted in Unicode code points

Thai text in UTF-8 runs three bytes per character, so a byte-length filter would admit
sentences a third of the documented length. `len(str)` in Python 3 counts code points,
which is the reading the spec's "10 and 25 characters" intends. Combining marks
(vowels, tone marks) each count as one code point; that is accepted as the definition
rather than normalising to grapheme clusters, which would complicate the rule for no
MVP benefit.

### Difficulty is a documented two-term formula

`difficulty = clamp(1, 5, round(length_score + duration_score))`, where each term
maps its input onto a 0–2.5 band: sentences 10–25 characters and clips 0–6000 ms
spread linearly across their band. Both inputs (`sentence` length and the duration
read from the corpus) are recoverable — length from the stored sentence, duration from
the stored clip — so the score can be recomputed later without re-reading the corpus,
satisfying the "records the derivation inputs" requirement without extra columns.

### Idempotence via `update_or_create` on `sentence`

`sentence` is already `unique=True`. Ingestion keys on it, so a second run updates the
existing 100 rows in place rather than raising or duplicating. Clip copying skips a
destination file that already exists with the same size, so re-runs do not rewrite
100 MP3s. Considered: `get_or_create` — chosen against because a changed difficulty
formula should reflow onto existing rows on the next run.

### Credentials come from `db.env`, read by both Podman and Django

One file, two consumers: `podman-compose.yml` passes it to the container with
`env_file`, and Django reads the same variables from its own environment. The
committed `db.example.env` documents the variable names with placeholder values. The
existing `.gitignore` already excludes `db.env` and `*.env` while allowing
`*.example.env`, so no ignore-rule change is needed. Django reads them with
`os.environ.get` and a development default, so `manage.py check` works before the
container is up while `migrate` still needs real credentials.

### Tests use a fixture corpus, not the real one

The test suite builds a tiny corpus (a handful of TSV rows and empty `.mp3` files) in
a `tmp_path` and points the command at it, with the 100-exercise target lowered
through a command option. This lets CI-less local runs test the filters, ordering,
determinism, and idempotence in milliseconds and on any machine. One test additionally
asserts the "fewer than 100 candidates" failure path, which the real corpus can never
exercise. pytest-django's `--reuse-db` is not enabled; tests create the test database
against the same Podman container.

### Tailwind 4 via the Vite plugin

Tailwind 4 has no `init` command, no `tailwind.config.js`, and no PostCSS or
autoprefixer step. The scaffold adds `@tailwindcss/vite` to `plugins` in
`vite.config.js` and a single `@import "tailwindcss";` in the main stylesheet. Any
guide that produces `tailwind.config.js` and a `postcss.config.js` is Tailwind 3 and
does not apply here.

## Risks / Trade-offs

- **The ordering favours high-vote clips, which may cluster on a few speakers or
  domains** → Acceptable for an MVP that only needs 100 playable items; if the set
  looks monotonous in practice, the ordering is one function to change and the spec
  scenario that pins it is one edit.
- **A byte-vs-codepoint or NFC/NFD mismatch would silently shift which sentences pass
  the length filter** → A test asserts the boundary cases (exactly 10 and exactly 25
  code points, including a sentence with combining marks) so the definition is pinned
  rather than incidental.
- **Copying 100 clips into `MEDIA_ROOT` duplicates data that exists in the corpus** →
  ~100 files at a few tens of KB each; the alternative, symlinking, breaks as soon as
  the corpus moves and would confuse Django's `FileField` storage.
- **Developers without the corpus cannot run ingestion** → The command fails with an
  explicit message naming the path it wanted, and the test suite runs without the
  corpus, so only the data-loading step is blocked.
- **Podman must be running before `migrate`** → Documented as an ordered step in the
  task list; a connection failure from Django is legible enough not to need wrapping.
- **`poetry.lock` pins a Django version that will age** → Expected; the lock file is
  the point, and updating it is a routine, separate change.

## Open Questions

- The `sentence_id` tiebreak makes the order total, but the resulting 100 sentences
  have not been reviewed by a Thai speaker for beginner suitability. Worth a look once
  the frontend can display them, and a candidate for a follow-up change to the
  ordering.
- `MEDIA_ROOT` is set to `src/backend/media/` (already git-ignored). If the ignored
  `data/` directory is meant to hold copied media instead, that is a one-line settings
  change — the requirement only says "under `MEDIA_ROOT`".
