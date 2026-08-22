## Context

The repository holds three prose specs and an empty shell: `src/backend/pyproject.toml` with zero dependencies, a `.venv` containing only pip, no Django project, no frontend, no `.gitignore` at the root, and an empty `data/`. `openspec/specs/` is empty, so this change writes the first capability specs rather than deltas against existing ones.

The corpus is on disk and was inspected directly while writing this change:

| Fact | Value |
|---|---|
| Corpus root | Release directory `cv-corpus-25.0-2026-03-09/th` (9.6 GB, outside the repo, path passed in) |
| `validated.tsv` | 148,765 rows; columns include `path`, `sentence_id`, `sentence`, `up_votes`, `down_votes` |
| `validated_sentences.tsv` | 64,491 rows; `sentence_id, sentence, variant, sentence_domain, source, is_used, clips_count` — **no votes, no path** |
| `clip_durations.tsv` | 366,508 rows mapping clip filename → duration in ms |
| `clips/` | 366,508 `.mp3` files |
| `up_votes >= 2 & down_votes == 0` | 132,153 rows |
| Sentence length in that pool | min 2, p25 18, median 28, max 165 characters |
| After 10–25 chars and ≤6 s audio | 51,324 rows → **21,432 unique sentences** |

That last number is what makes the MVP filter safe: sampling 100 from 21,432 leaves ample headroom if the criteria tighten later.

Two constraints are fixed by prior decision: Podman-hosted PostgreSQL 17 for local development, and the `Exercise` model landing before the GraphQL milestone.

## Goals / Non-Goals

**Goals:**
- Establish `openspec/specs/` as the normative record of required behavior, derived from the existing prose specs.
- Correct every documented instruction that cannot execute as written, so the next change can scaffold without hitting a contradiction.
- Restore Podman/PostgreSQL as the local development database across all three prose docs, so the architecture diagram, roadmap M1, and the tooling table agree.
- Re-sequence the roadmap so each milestone depends only on earlier ones.

**Non-Goals:**
- Writing application code. No Django project, no Vue app, no ingestion script is created by this change — only the corrected plan and the specs they must satisfy.
- Adding dependencies to `pyproject.toml` or creating `poetry.lock`.
- Redesigning the product. The MVP scope, UI layout, and phase plan from `specs/mission.md` are preserved as-is except where they were internally inconsistent.
- Changing anything about Phases 2–4.

## Decisions

### Prose specs are kept as background; OpenSpec specs become normative

`specs/mission.md` (vision, target users, UI layout) and `specs/roadmap.md` (milestone sequencing, decision log) have no natural home in the OpenSpec capability model — they are project context, not requirements. Rather than deleting them, each gains a header line pointing at `openspec/specs/` as the normative source for behavior, and the tech-stack content that *is* normative (data model constraints, GraphQL contract, corpus filter) is restated as requirements in the capability specs.

*Alternative considered:* delete `specs/` entirely and fold everything into `openspec/config.yaml` context. Rejected — the mission's UI layout sketch and the roadmap's decision log are genuinely useful and would be lossy to compress into a context blob. See Open Questions if the user prefers a full move.

### Selection source is `validated.tsv`

`validated_sentences.tsv` was named in the tech stack as the MVP source with an `up_votes >= 2` filter. That file has no `up_votes` column and no clip path, so the documented pipeline could never produce a playable exercise. `validated.tsv` is the clip-level manifest and carries both.

*Alternative considered:* join the two files on `sentence_id` to keep the documented source. Rejected — the join adds a step and yields nothing `validated.tsv` does not already have.

### Difficulty formula: character length plus clip duration

The corpus has no difficulty signal. Two proxies are available per row: sentence character length (from `validated.tsv`) and clip duration (from `clip_durations.tsv`). Both correlate with how hard a sentence is to type by ear — longer text is more to produce, longer audio holds more to retain. The score buckets the combination into 1–5.

*Alternative considered:* a Thai-linguistics difficulty model (tone-mark density, cluster complexity, rare consonants). Deferred — it is a real improvement but needs validation against learners, and the MVP only needs a coarse ordering. The spec requires the derivation inputs be recorded so the score can be recomputed when a better model arrives.

*Alternative considered:* `up_votes` as a difficulty proxy. Rejected — votes measure recording quality, not learner difficulty.

### GraphQL contract is written in camelCase

Strawberry applies `auto_camel_case` by default, so a Python field `audio_url` is published as `audioUrl`. The documented contract used snake_case throughout, and roadmap M2's acceptance query `{ exercises { sentence up_votes } }` would have failed validation on first run.

Two ways to reconcile: write the contract in camelCase, or disable auto-camel-casing in the schema config. Writing camelCase wins — it matches GraphQL convention, it is what every client tool and IDE plugin expects, and disabling the default is a surprise for anyone who knows Strawberry.

### Milestone reorder

The current sequence has M2 returning "all 100 exercises" from a model that M7 creates. The reorder moves the model, migration, and ingestion to the front. The new sequence:

1. Skeleton — scaffolds, Podman Postgres, configs
2. Exercise model + migration + ingestion of 100 exercises *(was M7)*
3. GraphQL query over real rows *(was M2)*
4. Frontend skeleton + sentence display
5. Audio playback
6. Thai keyboard + input
7. Validation and feedback — core loop complete

The `Progress` model stays defined but unwritten in the MVP, matching the existing decision that answer checking is client-side.

*Alternative considered:* keep the order and serve M2/M3 from a static JSON fixture, swapping the resolver later. Rejected by the user in favor of model-first, which avoids writing a resolver twice.

### Root `.gitignore` replaces `src/.gitignore`

`src/.gitignore` contains `src/backend/.venv`. Because a pattern containing a slash is anchored to the directory holding the `.gitignore`, that pattern matches `src/src/backend/.venv` — a path that does not exist. The virtualenv is currently unignored and only looks ignored because git collapses the untracked `src/` directory in `git status` output. A single root `.gitignore` covering `data/`, `__pycache__/`, `.venv/`, `node_modules/`, and the database env file replaces it.

## Risks / Trade-offs

- **The 100-exercise sample may include awkward beginner content** (the corpus is crowd-sourced and unfiltered for register; the candidate pool visibly contains coarse language) → the selection is deterministic and re-runnable, so a content filter can be added as a later criterion without invalidating the pipeline.
- **Copying 100 clips into `MEDIA_ROOT` duplicates data already on disk** → negligible at 100 files; symlinking was rejected because it breaks the moment the corpus directory moves, and `FileField` expects a real file under `MEDIA_ROOT`.
- **Deterministic selection depends on a fixed seed and stable input ordering** → the spec requires identical output across runs; if a corpus version bump changes row order, the sample changes and re-ingestion must be intentional.
- **Prose docs and OpenSpec specs can drift** now that behavior is stated in two places → mitigated by making the prose non-normative and keeping the overlap to a minimum, but it remains the main maintenance cost of keeping `specs/`.
- **Podman brings setup cost back into the MVP** that the reverted edit had removed → accepted by explicit decision; the payoff is that local dev matches the documented PostgreSQL-17 target instead of silently diverging onto SQLite.

## Migration Plan

This change edits documentation only; there is no deployment and no runtime rollback concern.

1. Revert the uncommitted `specs/tech-stack.md` edit that marked Podman out of scope.
2. Apply the corrections to `specs/tech-stack.md`, `specs/roadmap.md`, and `specs/mission.md`.
3. Fill `openspec/config.yaml` `context` with the tech stack and conventions.
4. Replace `src/.gitignore` with a correct root `.gitignore`, then confirm `git status` no longer sees the virtualenv.
5. Log the decisions in the roadmap's decision log with today's date.

Rollback is `git checkout` of the touched files; nothing outside the repository is modified, and the corpus is only read.

## Open Questions

- **Should `specs/` survive at all?** This design keeps mission and roadmap as background docs. If the intent of "migrate to OpenSpec" was a full move, the alternative is to compress them into `openspec/config.yaml` context and delete the directory. Cheap to change either way.
- **What difficulty buckets?** The spec fixes the inputs and the 1–5 range but not the exact thresholds. Left to the ingestion change, where the distribution can be inspected against the real candidate pool.
- **Should coarse-language filtering be an MVP criterion or a later addition?** Currently the latter.
