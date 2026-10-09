## MODIFIED Requirements

### Requirement: Selection criteria produce a deterministic MVP subset
The ingestion process SHALL select exercises using quality and beginner-suitability
filters, and SHALL produce the same exercises on every run against the same corpus
with the same selection size. The selection size SHALL be a run-time parameter that
is either a positive count or "all". With a count, the first that many kept rows are
selected. With "all", every kept row is selected. When no size is given, the count is
100.

Filters:
- `up_votes >= 2` and `down_votes == 0`
- sentence length between 10 and 25 characters inclusive
- clip duration at most 6000 ms, read from `clip_durations.tsv`
- the referenced clip file exists under `<corpus_root>/th/clips/`
- one exercise per distinct sentence

Selection SHALL be a pure function of the corpus contents and the selection size:
no random sampling and no seed. The candidate rows that survive the filters SHALL be
placed in a total order by `up_votes` descending, then clip duration ascending, then
`sentence_id` ascending. `sentence_id` breaks every remaining tie, so the order is
total. Walking that order, the first row for each distinct sentence is kept, and
later rows for an already-selected sentence are skipped. A count selects a prefix
of the "all" selection.

#### Scenario: Selecting the MVP subset
- **WHEN** the ingestion script runs against the Thai corpus at the supplied corpus root (release directory `cv-corpus-25.0-2026-03-09`) with no selection size given
- **THEN** it emits exactly 100 exercises, each with a unique `sentence`, drawn from the candidate pool matching the filters above

#### Scenario: Selecting an explicit count
- **WHEN** the ingestion script runs with a count of N
- **THEN** it emits exactly N exercises: the first N distinct sentences in the defined order

#### Scenario: Selecting every candidate
- **WHEN** the ingestion script runs with the selection size "all"
- **THEN** it emits one exercise for every distinct sentence that has at least one row passing the filters, and no other exercises

#### Scenario: A count and "all" are not both accepted
- **WHEN** the ingestion script is invoked with both a count and "all"
- **THEN** it exits with a non-zero status and an error saying the two cannot be combined, and writes no rows

#### Scenario: A count selects a prefix of "all"
- **WHEN** the same corpus is ingested once with a count of N and once with "all"
- **THEN** the N exercises from the first run are the first N exercises of the second run, in the same order

#### Scenario: Repeated runs agree
- **WHEN** the ingestion script is run twice against the same corpus with the same selection size
- **THEN** both runs select the identical set of `sentence_id` values in the identical order, with no seed or other run-time input affecting the result

#### Scenario: Ordering is total
- **WHEN** two candidate rows share the same `up_votes` and the same clip duration
- **THEN** their relative order is fixed by ascending `sentence_id`, so no tie is left to input order or dictionary iteration order

#### Scenario: Duplicate sentences collapse to the best clip
- **WHEN** several clips in the candidate pool carry the same sentence
- **THEN** exactly one is selected (the one that comes first in the defined order), and the others are skipped without failing the run

#### Scenario: Not enough candidates
- **WHEN** a count of N is requested and fewer than N distinct sentences satisfy the filters
- **THEN** ingestion SHALL fail with an error stating how many candidates were found, rather than emitting a short dataset, and SHALL write no rows

#### Scenario: No candidates at all
- **WHEN** "all" is requested and no row satisfies the filters
- **THEN** ingestion SHALL fail with an error saying no candidates matched, rather than reporting success with an empty catalog

### Requirement: The corpus stays outside the repository
The corpus SHALL be read from a path outside the repository working tree and SHALL NOT be copied into version control. Only the clips referenced by the selected exercises SHALL be copied into the application's media storage.

#### Scenario: Copying audio for selected exercises
- **WHEN** a set of exercises is selected
- **THEN** exactly the `.mp3` files those exercises reference, one per exercise, are copied into `MEDIA_ROOT`, and the remaining corpus clips are left untouched in place

#### Scenario: Corpus path is configurable
- **WHEN** the corpus lives at a path other than the current default
- **THEN** the ingestion script accepts that path as a parameter rather than requiring a code edit

### Requirement: Ingestion loads exercises into the database
The ingestion process SHALL persist the selected exercises as `Exercise` rows, and SHALL be safe to re-run.

#### Scenario: First load
- **WHEN** ingestion runs against an empty database
- **THEN** one `Exercise` row exists per selected exercise, each with `sentence`, `sentence_id`, `original_audio`, `up_votes`, and derived `difficulty` populated

#### Scenario: Re-running ingestion
- **WHEN** ingestion runs a second time against a database already holding those exercises
- **THEN** it completes without raising a uniqueness error and does not create duplicate rows

#### Scenario: Growing the catalog
- **WHEN** ingestion runs with "all" against a database already holding a smaller selection from the same corpus
- **THEN** the existing exercises are updated in place and only the additional ones are created
