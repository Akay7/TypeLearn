## 1. Restore Podman as the local database

- [x] 1.1 Revert the uncommitted edit in `specs/tech-stack.md` so the "Tools we're not using" table no longer lists Podman as out of scope
- [x] 1.2 Confirm the architecture diagram, the Infrastructure table, and roadmap M1's `podman network create` / `podman-compose.yml` rows all agree that PostgreSQL 17 runs in Podman
- [x] 1.3 Note in `specs/tech-stack.md` that `db.env` holds `POSTGRES_PASSWORD` and `POSTGRES_DB` and is never committed

## 2. Correct the data-layer documentation

- [x] 2.1 In `specs/tech-stack.md`, change the corpus format and MVP dataset rows to name `validated.tsv` as the selection source, and record that `validated_sentences.tsv` has no `up_votes` and no clip path
- [x] 2.2 Document the real selection criteria: `up_votes >= 2`, `down_votes == 0`, sentence 10–25 characters, clip ≤ 6000 ms, clip file present, one exercise per distinct sentence
- [x] 2.3 Document that `difficulty` is derived from sentence length and clip duration, not read from the corpus
- [x] 2.4 Record the corpus location as the release directory `cv-corpus-25.0-2026-03-09/th` (path supplied to the ingestion script) and that it stays outside the repository
- [x] 2.5 Add `max_length` to `Exercise.sentence` (255) and `Progress.typed_text` (255) in the data-model snippets, with a note that Django's `fields.E120` check blocks every management command without it

## 3. Correct the API contract

- [x] 3.1 Rewrite the GraphQL schema block in `specs/tech-stack.md` in camelCase (`sentenceId`, `audioUrl`, `upVotes`) and add `upVotes` to the `Exercise` type
- [x] 3.2 Add a note that Strawberry's default `auto_camel_case` is why the contract is camelCase, and that this project does not disable it
- [x] 3.3 Update the Client API table's example queries to the corrected casing
- [x] 3.4 Add `exercises(limit: Int)` to the documented `Query` type, since roadmap M3 already queries with `limit: 1`

## 4. Re-sequence the roadmap

- [x] 4.1 Move the Exercise model + migration + data load milestone from M7 to immediately after M1, renumbering the rest
- [x] 4.2 Update the moved milestone's checklist to cover ingestion of the 100 MVP exercises from `validated.tsv` and copying their clips into `MEDIA_ROOT`
- [x] 4.3 Fix the GraphQL milestone's acceptance query from `{ exercises { sentence up_votes } }` to `{ exercises { sentence upVotes } }`
- [x] 4.4 Update the "core loop is complete at the end of M6" line to reference the correct milestone number after renumbering
- [x] 4.5 Remove the duplicated "Init Vue frontend" row in M1
- [x] 4.6 Change the Django project name in M1 from `thai_learn` to `typelearn`, and update the project-structure tree in `specs/tech-stack.md` to match

## 5. Editorial fixes

- [x] 5.1 Fix the "Tools we're not using" table so every row has the same column count as its header, adding a `Status` column or trimming the extra cells
- [x] 5.2 Add a pointer at the top of `specs/mission.md`, `specs/roadmap.md`, and `specs/tech-stack.md` stating that `openspec/specs/` is normative for behavior and these documents are background
- [x] 5.3 Add decision-log entries dated 2026-08-21 for: model-before-API reorder, `validated.tsv` as corpus source, derived difficulty, camelCase GraphQL contract, and `typelearn` project naming

## 6. Repository hygiene

- [x] 6.1 Create a root `.gitignore` covering `data/`, `__pycache__/`, `*.pyc`, `.venv/`, `db.env`, `node_modules/`, `dist/`, and local media output
- [x] 6.2 Delete `src/.gitignore`, whose `src/backend/.venv` pattern is anchored to `src/` and matches nothing
- [x] 6.3 Verify with `git status --ignored` that `src/backend/.venv` is now actually ignored and that no file under `data/` is listed as untracked

## 7. OpenSpec wiring

- [x] 7.1 Fill `openspec/config.yaml` `context` with the tech stack (Django + Strawberry, Vue 3 + Pinia + Vite + Tailwind, PostgreSQL 17 via Podman, Poetry, pytest), the corpus location, and the language-neutral naming convention
- [x] 7.2 Run `openspec validate align-specs-with-reality` and confirm it passes
- [x] 7.3 Run `openspec status --change align-specs-with-reality` and confirm all artifacts are done

## 8. Final consistency pass

- [x] 8.1 Re-read all three prose specs end to end and confirm no remaining statement contradicts another or is impossible against the corpus on disk
- [x] 8.2 Confirm no application code was created by this change: `src/backend/pyproject.toml` still has zero dependencies and no Django project exists
- [x] 8.3 *(found during the pass, beyond the original scope)* Fix the Tailwind setup in roadmap M1: `npx tailwindcss init -p` was removed in Tailwind 4 (latest is 4.3.3), replaced with the `@tailwindcss/vite` plugin and `@import "tailwindcss";`, and pinned the tech-stack row to 4.x
- [x] 8.4 *(found during the pass)* Clarify in `specs/mission.md` that "no Docker files or deployment infrastructure" does not exclude the Podman local database container
