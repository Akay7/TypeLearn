## Why

The project is specs-only: `specs/mission.md`, `specs/roadmap.md`, and `specs/tech-stack.md` describe the whole MVP, but a review against the actual corpus and toolchain found contradictions that make the plan non-executable as written — the roadmap builds the GraphQL API (M2) five milestones before the model it queries (M7), and the documented MVP data filter (`validated_sentences.tsv` with `up_votes >= 2`) is impossible because that file has neither `up_votes` nor an audio path.

Fixing this now, before any code exists, is the cheap moment: every defect below would otherwise surface as a failing command during M1–M7. This change also moves the normative behavior out of prose docs into OpenSpec capability specs, so future changes have a spec to delta against.

## What Changes

**Migration to OpenSpec**
- Introduce OpenSpec capability specs as the source of truth for required behavior. `specs/mission.md` and `specs/roadmap.md` remain as narrative background (vision and milestone sequencing); `specs/tech-stack.md` remains as the technology reference. Each gains a pointer to `openspec/specs/` as normative.
- Populate `openspec/config.yaml` `context` with the tech stack and conventions so future proposals inherit it.

**Corrections to the plan** (decided with the user)
- **Podman stays in.** Revert the uncommitted `specs/tech-stack.md` edit marking Podman/podman-compose out of MVP scope. PostgreSQL 17 runs in a Podman container for local dev; the architecture diagram and roadmap M1 already assume this and become consistent again.
- **BREAKING (to the roadmap): milestone reorder.** The `Exercise` model, migration, and MVP data load move from M7 to the front, before the GraphQL query milestone. M2 currently claims to return 100 exercises from a model that does not exist until M7.
- **Corpus source correction.** MVP exercises are selected from `validated.tsv` (148,765 rows; has `path`, `sentence`, `sentence_id`, `up_votes`, `down_votes`), not `validated_sentences.tsv` (sentence-only, no votes, no audio). Corpus is already on disk in the release directory `cv-corpus-25.0-2026-03-09/th` and stays outside the repo.
- **Difficulty is derived, not sourced.** Common Voice carries no difficulty field. Difficulty is computed from sentence character length and clip duration.
- **GraphQL naming.** The contract is restated in the casing Strawberry actually emits: schema fields are camelCase (`sentenceId`, `audioUrl`, `upVotes`) unless auto-camel-casing is explicitly disabled. The roadmap's acceptance query `{ exercises { sentence up_votes } }` is corrected.
- **Model definitions made valid.** `Exercise.sentence` and `Progress.typed_text` get explicit `max_length` — without it Django fails its system check before any test runs.
- **Naming consistency.** The Django project is named `typelearn`, not `thai_learn`, matching the logged decision to avoid hardcoding "Thai".
- **Repo hygiene.** `src/.gitignore` currently holds `src/backend/.venv`, which is anchored to `src/` and therefore matches `src/src/backend/.venv` — the virtualenv is not actually ignored. Replaced with a correct root `.gitignore` covering `data/`, `__pycache__/`, `.venv/`, and build output.
- **Editorial.** Remove the duplicated "Init Vue frontend" row in roadmap M1; fix the "Tools we're not using" table, whose rows carry three columns under a two-column header.

## Capabilities

### New Capabilities
- `corpus-ingestion`: Selecting a reproducible MVP subset from the local Common Voice Thai corpus, deriving difficulty, copying the referenced clips into media storage, and loading the result into the database.
- `exercise-catalog`: The `Exercise` and `Progress` data model, its field constraints, and how audio files are stored and addressed.
- `exercise-api`: The GraphQL contract — queries, field names and casing, and what the client is guaranteed to receive.
- `typing-practice`: The core learner loop in the browser — sentence display, audio playback, on-screen Thai keyboard, answer checking, and feedback.
- `local-dev-environment`: Reproducible local setup — Podman-hosted PostgreSQL 17, backend/frontend scaffolding layout, and ignore rules.

### Modified Capabilities
<!-- None: openspec/specs/ is empty; this change establishes the first capability specs. -->

## Impact

- **Docs edited**: `specs/tech-stack.md` (Podman revert, corpus source, difficulty, GraphQL casing, model `max_length`, table fix, project-structure paths), `specs/roadmap.md` (milestone reorder, duplicate row, corrected acceptance query, decision-log entries), `specs/mission.md` (pointer to normative specs).
- **Files created**: `openspec/specs/*` (via this change's delta specs), root `.gitignore`, `openspec/config.yaml` context block.
- **Files removed**: `src/.gitignore` (superseded by the corrected root `.gitignore`).
- **No application code is written by this change.** `src/backend/pyproject.toml` still has zero dependencies and no Django project exists; scaffolding is the next change, and it now has a correct plan to follow.
- **Downstream**: the roadmap reorder changes the order of the next several changes. `Exercise`/`Progress` and the ingestion script land before the GraphQL endpoint.
