# Roadmap

## Phase 1: MVP (current)

Build the core loop: listen → type → check → feedback.

| Item | Status | Notes |
|---|---|---|
| Django backend with GraphQL | planned | Strawberry GraphQL, PostgreSQL |
| Exercise data model with FK relationships | planned | `Exercise` model with `original_audio` FileField |
| JSON corpus loader for MVP data | planned | Load from `processed/mvp_dataset.json` |
| Vue app with Vite | planned | Vue 3, Pinia, no UI framework |
| Sentence display component | planned | Shows Thai sentence, length hint |
| Audio player component | planned | Play/stop with Web Audio API |
| Virtual Thai keyboard | planned | On-screen with active key highlight |
| Input and validation logic | planned | Compare typed text against expected |
| Results feedback | planned | Correct/incorrect, show next exercise |
| Load 100 MVP exercises from corpus | planned | Easy difficulty, verified sentences |

## Phase 2: Expanded Practice

Add variety and usability.

| Item | Description | Depends on |
|---|---|---|
| Exercise picker | Filter by category, difficulty, verified | Phase 1 |
| Multiple exercises per session | Sequence of 10-20 questions | Phase 1 |
| Progress bar | Show how many done in session | Phase 1 |
| Skip and retry buttons | Skip ahead or replay the same | Phase 1 |
| Keyboard layout switching | Thai + source language overlay | Phase 1 |
| Correct answer reveal | Show what you missed | Phase 1 |
| Session summary | Score + stats at end | Phase 2 |

## Phase 3: Persistence & Accounts

Save user data and add personalization.

| Item | Description | Depends on |
|---|---|---|
| User registration | Email or OAuth | Phase 2 |
| User exercise accounts | Track completed exercises | Phase 2 |
| Persistent progress | Local storage or database | Phase 3 |
| Spaced repetition | Show words due for review | Phase 2 |
| Wrong-answer review queue | Focus on mistakes | Phase 3 |
| Stats dashboard | Accuracy over time, words learned | Phase 3 |

## Phase 4: Platform

Add features and scale.

| Item | Description | Depends on |
|---|---|---|
| Multiple language support | Spanish, Korean, etc. | Phase 3 |
| Community corpus uploads | Users submit new audio-text pairs | Phase 4 |
| Mobile app or PWA | Phone/tablet support | Phase 2 |
| Teacher mode | Set custom exercise sets for classes | Phase 4 |
| Docker Compose deployment | One-command setup | Phase 4 |
| CI/CD pipeline | Automated tests and deploy | Phase 4 |

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-21 | Start with Thai language | Largest Common Voice corpus available; user interest |
| 2026-04-21 | Use Django + Strawberry GraphQL over DRF | Less boilerplate, type safety, auto-GraphQL introspection |
| 2026-04-21 | Use Poetry over pip/pipenv/uv | Already installed, mature Django ecosystem support |
| 2026-04-21 | Use PostgreSQL with psycopg (binary) | ACID compliance, full-text search, FK integrity |
| 2026-04-21 | MVP has no Docker/k8s | Out of scope; adds deployment complexity |
| 2026-04-21 | App name: TypeLearn (generic) | Multi-language future; avoid hardcoding "Thai" |
