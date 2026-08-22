# exercise-catalog Specification

## Purpose
TBD - created by archiving change align-specs-with-reality. Update Purpose after archive.
## Requirements
### Requirement: Exercise model
The system SHALL provide an `Exercise` model representing one audio-and-sentence practice item. Every `CharField` SHALL declare an explicit `max_length`; Django raises a system check error (`fields.E120`) for a `CharField` without one, which would block every management command including `migrate` and `test`.

Fields:
- `sentence` — `CharField(max_length=255, unique=True)`, the target text the learner types
- `sentence_id` — `CharField(max_length=64, blank=True)`, the Common Voice source identifier
- `original_audio` — `FileField`, the clip stored under `MEDIA_ROOT`
- `up_votes` — `IntegerField(default=0)`, corpus validation quality indicator
- `difficulty` — `IntegerField(default=1)`, derived 1–5 score
- `created_at` — `DateTimeField(auto_now_add=True)`

#### Scenario: Model passes Django system checks
- **WHEN** `python manage.py check` runs
- **THEN** it reports no errors for the `exercises` app, and in particular no `fields.E120` for `sentence`

#### Scenario: Duplicate sentences are rejected
- **WHEN** a second `Exercise` is saved with a `sentence` already present in the table
- **THEN** the database raises an integrity error and no duplicate row is created

#### Scenario: Sentence length is sufficient for the corpus
- **WHEN** any of the selected MVP sentences is saved
- **THEN** it fits within `max_length` without truncation

### Requirement: Progress model
The system SHALL provide a `Progress` model recording one attempt at an exercise. Its `CharField` SHALL declare an explicit `max_length` for the same reason as `Exercise.sentence`.

Fields:
- `exercise` — `ForeignKey(Exercise, on_delete=CASCADE)`
- `typed_text` — `CharField(max_length=255)`
- `is_correct` — `BooleanField()`
- `attempts` — `IntegerField(default=0)`
- `created_at` — `DateTimeField(auto_now_add=True)`

#### Scenario: Recording an attempt
- **WHEN** a `Progress` row is created referencing an existing exercise
- **THEN** it persists with its `typed_text`, `is_correct`, and `attempts` values

#### Scenario: Deleting an exercise
- **WHEN** an `Exercise` is deleted
- **THEN** its related `Progress` rows are deleted with it

#### Scenario: MVP does not write progress
- **WHEN** a learner checks an answer in the MVP frontend
- **THEN** no `Progress` row is written; the model exists for the persistence phase and answer checking stays client-side

### Requirement: Audio files are served from media storage
Audio SHALL be stored on the filesystem under `MEDIA_ROOT` and addressed through `MEDIA_URL`, so that a browser can play a clip directly from the URL exposed by the API.

#### Scenario: Resolving a clip URL
- **WHEN** an exercise's audio URL is requested
- **THEN** it resolves to a URL under `MEDIA_URL` that returns the corresponding `.mp3` with an audio content type

#### Scenario: Development serving
- **WHEN** the backend runs with `DEBUG` enabled
- **THEN** media files are served by the development server without additional web-server configuration

