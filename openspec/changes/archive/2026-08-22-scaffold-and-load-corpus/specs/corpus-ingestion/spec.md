## MODIFIED Requirements

### Requirement: Selection criteria produce a deterministic MVP subset
The ingestion process SHALL select exactly 100 exercises for the MVP using quality and beginner-suitability filters, and SHALL produce the same 100 exercises on every run against the same corpus.

Filters:
- `up_votes >= 2` and `down_votes == 0`
- sentence length between 10 and 25 characters inclusive
- clip duration at most 6000 ms, read from `clip_durations.tsv`
- the referenced clip file exists under `<corpus_root>/th/clips/`
- one exercise per distinct sentence

Selection SHALL be a pure function of the corpus contents: no random sampling and no
seed. The candidate rows surviving the filters SHALL be placed in a total order by
`up_votes` descending, then clip duration ascending, then `sentence_id` ascending —
`sentence_id` breaks every remaining tie, so the order is total. Walking that order,
the first row for each distinct sentence is kept and later rows for an
already-selected sentence are skipped; the first 100 kept rows are the MVP subset.

#### Scenario: Selecting the MVP subset
- **WHEN** the ingestion script runs against the Thai corpus at the supplied corpus root (release directory `cv-corpus-25.0-2026-03-09`)
- **THEN** it emits exactly 100 exercises, each with a unique `sentence`, drawn from the candidate pool matching the filters above

#### Scenario: Repeated runs agree
- **WHEN** the ingestion script is run twice against the same corpus
- **THEN** both runs select the identical set of 100 `sentence_id` values in the identical order, with no seed or other run-time input affecting the result

#### Scenario: Ordering is total
- **WHEN** two candidate rows share the same `up_votes` and the same clip duration
- **THEN** their relative order is fixed by ascending `sentence_id`, so no tie is left to input order or dictionary iteration order

#### Scenario: Duplicate sentences collapse to the best clip
- **WHEN** several clips in the candidate pool carry the same sentence
- **THEN** exactly one is selected — the one that comes first in the defined order — and the others are skipped without failing the run

#### Scenario: Not enough candidates
- **WHEN** fewer than 100 rows satisfy the filters
- **THEN** ingestion SHALL fail with an error stating how many candidates were found, rather than emitting a short dataset

## ADDED Requirements

### Requirement: Ingestion runs as a Django management command
The ingestion process SHALL be invocable as a Django management command so that it
runs inside the configured Django application context, with the ORM, settings, and
`MEDIA_ROOT` already resolved.

#### Scenario: Invoking ingestion
- **WHEN** a developer runs the ingestion management command with a corpus root argument
- **THEN** the selected exercises are written to the configured database and their clips to the configured `MEDIA_ROOT`, with no separate bootstrap step

#### Scenario: Missing corpus root
- **WHEN** the supplied corpus root does not exist or does not contain `th/validated.tsv`
- **THEN** the command exits with a non-zero status and an error naming the path it looked for, and writes no rows

#### Scenario: Reporting the outcome
- **WHEN** ingestion completes
- **THEN** the command reports how many exercises were created, how many already existed, and how many clips were copied
