# corpus-ingestion Specification

## Purpose
TBD - created by archiving change align-specs-with-reality. Update Purpose after archive.
## Requirements
### Requirement: MVP exercises are selected from the validated clip manifest
The ingestion process SHALL read candidate exercises from `validated.tsv` in the local Common Voice corpus, because it is the only manifest carrying both an audio `path` and vote counts. `validated_sentences.tsv` SHALL NOT be used as the selection source: it contains `sentence_id`, `sentence`, `variant`, `sentence_domain`, `source`, `is_used`, and `clips_count` only, with no `up_votes` and no clip path.

#### Scenario: Reading the manifest
- **WHEN** the ingestion script runs against a corpus root
- **THEN** it reads `<corpus_root>/th/validated.tsv` as tab-separated data with the header row `client_id, path, sentence_id, sentence, sentence_domain, up_votes, down_votes, age, gender, accents, variant, locale, segment`

#### Scenario: Sentence-only manifest is rejected as a source
- **WHEN** a configuration or script points selection at `validated_sentences.tsv`
- **THEN** ingestion SHALL fail with an explicit error naming the missing `up_votes` and `path` columns, rather than silently producing exercises without audio

### Requirement: Selection criteria produce a deterministic MVP subset
The ingestion process SHALL select exactly 100 exercises for the MVP using quality and beginner-suitability filters, and SHALL produce the same 100 exercises on every run against the same corpus.

Filters:
- `up_votes >= 2` and `down_votes == 0`
- sentence length between 10 and 25 characters inclusive
- clip duration at most 6000 ms, read from `clip_durations.tsv`
- the referenced clip file exists under `<corpus_root>/th/clips/`
- one exercise per distinct sentence

#### Scenario: Selecting the MVP subset
- **WHEN** the ingestion script runs against the Thai corpus at the supplied corpus root (release directory `cv-corpus-25.0-2026-03-09`)
- **THEN** it emits exactly 100 exercises, each with a unique `sentence`, drawn from the candidate pool matching the filters above

#### Scenario: Repeated runs agree
- **WHEN** the ingestion script is run twice against the same corpus with the same seed
- **THEN** both runs select the identical set of 100 `sentence_id` values in the identical order

#### Scenario: Not enough candidates
- **WHEN** fewer than 100 rows satisfy the filters
- **THEN** ingestion SHALL fail with an error stating how many candidates were found, rather than emitting a short dataset

### Requirement: Difficulty is derived, not read from the corpus
The Common Voice corpus carries no difficulty field. The ingestion process SHALL compute each exercise's difficulty as an integer on a 1–5 scale from sentence character length and clip duration, and SHALL record the derivation inputs so the score can be recomputed.

#### Scenario: Deriving difficulty
- **WHEN** an exercise with a short sentence and a short clip is ingested
- **THEN** it receives a lower difficulty integer than an exercise with a longer sentence or longer clip

#### Scenario: Difficulty stays in range
- **WHEN** any exercise is ingested
- **THEN** its `difficulty` is an integer between 1 and 5 inclusive

### Requirement: The corpus stays outside the repository
The corpus SHALL be read from a path outside the repository working tree and SHALL NOT be copied into version control. Only the clips referenced by the selected 100 exercises SHALL be copied into the application's media storage.

#### Scenario: Copying audio for selected exercises
- **WHEN** the 100 exercises are selected
- **THEN** exactly the 100 referenced `.mp3` files are copied into `MEDIA_ROOT`, and the remaining corpus clips are left untouched in place

#### Scenario: Corpus path is configurable
- **WHEN** the corpus lives at a path other than the current default
- **THEN** the ingestion script accepts that path as a parameter rather than requiring a code edit

### Requirement: Ingestion loads exercises into the database
The ingestion process SHALL persist the selected exercises as `Exercise` rows, and SHALL be safe to re-run.

#### Scenario: First load
- **WHEN** ingestion runs against an empty database
- **THEN** 100 `Exercise` rows exist, each with `sentence`, `sentence_id`, `original_audio`, `up_votes`, and derived `difficulty` populated

#### Scenario: Re-running ingestion
- **WHEN** ingestion runs a second time against a database already holding those exercises
- **THEN** it completes without raising a uniqueness error and does not create duplicate rows

