## ADDED Requirements

### Requirement: Every change is tested automatically
The repository SHALL run its test suites automatically on every pull request and
on every push to the main branch, so that a break is found by the project rather
than by the next person to run the tests by hand. A run SHALL cover the backend
tests, the frontend unit tests, and the frontend browser tests.

#### Scenario: A pull request is checked
- **WHEN** a pull request is opened or updated
- **THEN** the backend pytest suite, the frontend unit suite, and the frontend
  browser suite all run, and their results are reported on the pull request

#### Scenario: A failing test fails the run
- **WHEN** any of those suites fails
- **THEN** the run is marked failed, rather than reporting success on a partial
  result

#### Scenario: Superseded runs do not pile up
- **WHEN** a new commit is pushed to a branch whose run is still in progress
- **THEN** the earlier run is cancelled, so the reported result belongs to the
  current commit

#### Scenario: The browser suite needs no services
- **WHEN** the frontend browser suite runs in CI
- **THEN** it runs without a database, without an ingested corpus, and without
  the backend, because it stubs what it needs

### Requirement: Tests run inside the artifact that was built
The suites SHALL run inside the container images the run itself built, not in an
environment assembled separately on the runner. An image that passes is the image
that may be published; nothing is rebuilt between testing and publishing.

#### Scenario: Backend tests run in the backend image
- **WHEN** the backend suite runs
- **THEN** it executes inside the image built from this commit, so the
  dependencies under test are the ones that would ship

#### Scenario: Publishing does not rebuild
- **WHEN** a tested commit is published
- **THEN** the already-built image is retagged, so no untested rebuild can be
  released under a tested commit's name

#### Scenario: Images are tagged per commit
- **WHEN** an image is built
- **THEN** it carries a tag identifying the exact commit it was built from, so
  any run's artifact can be found again

### Requirement: The deployed stack is smoke-tested
CI SHALL bring the whole stack up in a real cluster and check that it answers
through the Gateway, because local development and CI share one set of manifests.
Unit and browser suites do not exercise the manifests, the routing, and the
container images together; without this, the first run of the real topology would
be on a developer's machine.

#### Scenario: The stack comes up in a cluster
- **WHEN** the stack is deployed to CI's cluster from the project's own manifests
- **THEN** every resource becomes ready within a bounded time, or the run fails

#### Scenario: The application answers through the Gateway
- **WHEN** the smoke test requests the application's root through the Gateway
- **THEN** the frontend's page is returned, and a GraphQL query against the same
  origin returns a valid response

#### Scenario: The smoke test needs no corpus
- **WHEN** the stack is smoke-tested against an empty catalog
- **THEN** the checks still pass, because they assert that the stack answers
  correctly rather than that it holds particular exercises

#### Scenario: The cluster is built the same way as a developer's
- **WHEN** CI provisions its cluster
- **THEN** it uses the same bring-up the project ships for local development, so
  a component that is missing or misconfigured fails CI rather than only failing
  on a developer's machine
