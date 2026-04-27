# Tech Stack

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                         browser                          │
│                                                         │
│    Vue 3 + Pinia  →  Strawberry GraphQL client  →  API  │
└─────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────┐
│                      Django backend                       │
│                                                         │
│    Strawberry GraphQL schema  →  Django models  →  ORM   │
└─────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────┐
│                    PostgreSQL 9.3+                        │
│                                                         │
│    exercises    progress    audio_files    users (v2+)    │
└─────────────────────────────────────────────────────────┘
```

## Backend

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Framework | Django | 5.x | Established, mature, large ecosystem |
| API | Strawberry GraphQL | 0.46+ | Less boilerplate than DRF, auto introspection, type safe |
| Database | PostgreSQL | 9.3+ | FK integrity, full-text search, ACID compliance |
| DB driver | psycopg (binary) | 3.x | Native async, type hinting over psycopg2 |
| Storage | Django FileField | — | Audio files stored on filesystem via `MEDIA_ROOT` |
| Package manager | Poetry | 2.x | Lock files, dependency resolution, Django ecosystem fit |
| WSGI server | Gunicorn | 21.x | Standard for Django production deployment |

## Frontend

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Framework | Vue | 3.x | Reactivity, options + composition API, smaller than Angular |
| Build | Vite | 6.x | Fast HMR, modern, lighter than webpack |
| State | Pinia | 2.x | Official Vue store, simpler than Vuex |
| Routing | vue-router | 4.x | Official, well-integrated |
| HTTP | graphql-tag / native fetch | — | GraphQL client or direct fetch for MVP |
| Keyboard | Custom component | — | On-screen Thai characters, no external dependency |

## Data Layer

| Layer | Choice | Notes |
|---|---|---|
| Corpus source | Mozilla Common Voice | CC-0 license, 150+ languages, 366K Thai clips |
| Corpus format | TSV + mp3 clips | `validated_sentences.tsv`, `clips/*.mp3` |
| MVP dataset | JSON file | `processed/mvp_dataset.json`, load at startup |
| MVP count | 100 exercises | Easy difficulty, up_votes >= 2, verified |
| Database | PostgreSQL | `exercises`, `progress` tables with FK relationships |

## Project Structure

```
ThaiLanguage/
├── specs/                         # Spec files (this directory)
│   ├── mission.md
│   ├── roadmap.md
│   └── tech-stack.md
├── src/
│   ├── backend/
│   │   ├── manage.py
│   │   ├── pyproject.toml
│   │   ├── thai_learn/
│   │   │   ├── settings.py
│   │   │   ├── urls.py
│   │   │   └── wsgi.py
│   │   └── exercises/
│   │       ├── models.py
│   │       ├── schema.py
│   │       └── utils.py
│   └── frontend/
│       ├── package.json
│       ├── vite.config.js
│       └── src/
│           ├── main.js
│           ├── App.vue
│           └── components/
├── data/                          # Large files, not committed
│   ├── cv-corpus-*/
│   ├── processed/
│   └── *.tar.gz
└── .gitignore
```

## Data Model (MVP)

### `Exercise`

```python
class Exercise(models.Model):
    sentence = CharField(unique=True)        # Thai text to type
    sentence_id = CharField(blank=True)      # Common Voice source ID
    original_audio = FileField()             # Path to audio clip
    up_votes = IntegerField(default=0)       # Validation quality indicator
    difficulty = IntegerField(default=1)     # 1-5 scale
    created_at = DateTimeField(auto_now_add=True)
```

### `Progress`

```python
class Progress(models.Model):
    exercise = ForeignKey(Exercise, on_delete=CASCADE)
    typed_text = CharField()
    is_correct = BooleanField()
    attempts = IntegerField(default=0)
    created_at = DateTimeField(auto_now_add=True)
```

## Excluded Tools (deliberately)

| Tool | Why not |
|---|---|
| Django REST Framework | Switched to Strawberry GraphQL — less boilerplate, type safety |
| pip / pip-tools | Chose Poetry for dependency management |
| psycopg2 | Outdated, chose psycopg3 for async support |
| Docker / Kubernetes | Out of MVP scope; adds infrastructure before product validation |
| Tailwind / CSS frameworks | MVP has no UI requirements; minimal custom CSS is fine |
| Redux / Vuex | Chose Pinia as the official Vue state management library |
| Jest / Pytest | Not in MVP scope; add after the core loop works |
| Nginx / Caddy | No deployment until MVP product validation succeeds |
