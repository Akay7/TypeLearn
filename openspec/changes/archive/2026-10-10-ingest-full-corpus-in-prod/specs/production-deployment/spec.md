## ADDED Requirements

### Requirement: How much of the corpus is ingested is set per environment
The amount of the corpus the ingest Job loads SHALL be a chart value, either a
positive count or `all`, so a deployment can load the whole filtered corpus while
development clusters load a small sample. Both use the same template. The default
SHALL be the small sample, so an environment only gets the full corpus when it
asks for it.

#### Scenario: Default size
- **WHEN** the ingest Job is rendered with no ingestion size supplied
- **THEN** it runs ingestion with a count of 100

#### Scenario: A deployment ingests everything
- **WHEN** the ingest Job is rendered with the ingestion size set to `all`
- **THEN** it runs ingestion over every candidate that passes the filters

#### Scenario: An explicit count
- **WHEN** the ingest Job is rendered with the ingestion size set to a positive integer
- **THEN** it runs ingestion with that count

#### Scenario: An invalid size is refused at render time
- **WHEN** the ingestion size is set to anything other than a positive integer or `all`
- **THEN** rendering fails with an error naming the value and what it accepts, rather than producing a Job that fails once it starts

#### Scenario: The production example asks for the whole corpus
- **WHEN** a deployment starts from `values-prod.yaml.example`
- **THEN** its ingestion size is `all`
