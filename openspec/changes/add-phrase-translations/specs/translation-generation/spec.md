## Purpose

Produces the initial translations of the exercise catalog into the interface
languages by batch machine translation, once, on a developer's machine. They are
committed as a fixture that outlives any database and are loaded into the
catalog from there, so a learner has something to read, rate, and improve from
the first visit.

## ADDED Requirements

### Requirement: Machine translations live in a committed fixture
Machine translations SHALL be stored in a YAML file committed to the repository,
one file per source language, with one entry per source sentence holding its
translation into each target language. Each entry SHALL identify its exercise by
sentence text, and by corpus sentence id when there is one, never by database
id. A target language missing from an entry SHALL mean that sentence is not yet
translated into it. The file's contents SHALL be independent of any one
database, so the same file can populate a fresh database, another worktree, CI,
or a deployment. Writing the same content twice SHALL produce an identical file.

#### Scenario: Database rebuilt
- **WHEN** the database is dropped and the corpus is re-ingested
- **THEN** loading the translations restores every machine translation without
  any provider request

#### Scenario: A deployment gets translations
- **WHEN** a deployment ingests the corpus from an image built from a commit
  that holds the fixture
- **THEN** its exercises have their machine translations, and the deployment
  holds no provider credentials

#### Scenario: Correcting a translation by hand
- **WHEN** a developer edits one translation in the fixture and it is loaded
- **THEN** that exercise's machine translation shows the edited text

### Requirement: Batch translation command fills the fixture from the corpus
The backend SHALL provide a management command that reads the sentences
ingestion would select from a Common Voice release directory and translates them
into a set of target languages, writing the results into the fixture. It SHALL
NOT require or write to the database. The target languages SHALL default to the
supported interface languages minus the source language, and SHALL be selectable
per run. The source language SHALL be a parameter with a configured default,
never a constant naming a particular language in code.

#### Scenario: Translating a fresh corpus
- **WHEN** the command runs against a release none of whose sentences are in the
  fixture, targeting English and French
- **THEN** every selected sentence has an English and a French translation in
  the fixture, and no database query is made

#### Scenario: Source language is not a target
- **WHEN** the command runs with its default targets and the source language is
  Thai
- **THEN** no Thai-to-Thai translation is requested or written

### Requirement: Translation is idempotent and resumable
The command SHALL request only the target languages an entry is missing, so a
re-run does no provider work for translations already present, and SHALL leave
existing translations, including hand corrections, as they are. A run that is
interrupted part-way SHALL keep what it had saved, and the file SHALL never be
left partially written.

#### Scenario: Re-running
- **WHEN** the command is run twice with the same arguments
- **THEN** the second run makes no provider requests and the file is unchanged

#### Scenario: Interrupted run
- **WHEN** a run is interrupted and started again
- **THEN** the file is a complete, readable fixture, and the second run
  requests only the translations still missing

#### Scenario: New sentences or languages
- **WHEN** a newer release adds sentences, or a new target language is added,
  and the command runs again
- **THEN** only the new sentences and the new language are requested

### Requirement: Loading the fixture into the catalog
The backend SHALL provide a step that reads the fixture and makes each
translation that matches an ingested exercise a published machine translation of
that exercise. It SHALL be idempotent. Entries matching no exercise SHALL be
counted and skipped, not treated as errors. When an entry's text differs from
the machine translation already loaded for that exercise and language, the text
SHALL be replaced and that translation's ratings cleared, since they rated
different text. Loading SHALL never touch learner translations or their ratings.
Ingestion SHALL run this step after loading the corpus. A missing fixture SHALL
be a no-op, and a fixture that cannot be read SHALL fail with a message naming
the file.

#### Scenario: Loading after ingestion
- **WHEN** the corpus is ingested and the fixture holds English translations for
  all of its sentences
- **THEN** every exercise has a published English machine translation

#### Scenario: Re-loading
- **WHEN** the load step runs twice over an unchanged file
- **THEN** the second run changes nothing and no ratings are lost

#### Scenario: Fixture covers more than the catalog
- **WHEN** the fixture covers the full corpus and is loaded into a 100-exercise
  development catalog
- **THEN** the 100 exercises get their translations, and the remaining entries
  are reported as unmatched

### Requirement: Provider is pluggable, credentials stay local, and failures are contained
The provider SHALL be chosen per run. An offline provider that makes no network
calls SHALL be available for tests. It SHALL never write into the committed
fixture, so its placeholders cannot be loaded as real translations. The
provider's credentials SHALL come only from the environment of the process
running the command, never from the repository, the chart, or a deployment's
secrets. A failed or unusable result for one batch SHALL be reported and
skipped, and SHALL NOT abort the run or write partial or empty translations. The
command SHALL exit non-zero if any batch failed.

#### Scenario: Offline provider
- **WHEN** the command runs with the offline provider and an explicit scratch
  directory
- **THEN** it completes with no outbound network requests and writes
  deterministic placeholder translations there

#### Scenario: Offline provider aimed at the committed fixture
- **WHEN** the offline provider is selected without an explicit directory
- **THEN** the command refuses to run, naming the reason

#### Scenario: A batch fails
- **WHEN** the provider errors or returns a malformed response for one batch
- **THEN** that batch's sentences are reported, nothing is written for them,
  the rest of the run continues, and the command exits non-zero at the end

#### Scenario: Missing credentials
- **WHEN** a network provider is selected and its API key is not set
- **THEN** the command fails before translating anything, with a message naming
  the missing variable

### Requirement: Translation never runs while serving
Machine translation SHALL happen only in the batch command. No GraphQL request
SHALL cause a provider call, and the API SHALL NOT read the fixture. It serves
the loaded catalog. A deployment SHALL NOT need the provider's SDK or
credentials.

#### Scenario: Exercise without a translation
- **WHEN** a client requests the translation of an exercise that has none in
  that language
- **THEN** the response is null, and neither a provider request nor a fixture
  read is made
