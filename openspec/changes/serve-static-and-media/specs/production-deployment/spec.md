## ADDED Requirements

### Requirement: Everything the application serves is served in every environment
Every path the application answers on SHALL be served in every environment — the
SPA, the GraphQL endpoint, the ingested clips, and Django's own static files —
by something chosen for that job. No path may be served only as a
side effect of the application's debug mode: a route that exists solely when
`DEBUG` is on is a route no deployment has, and its absence shows up as a 404 on
the thing users came for rather than as a failure anyone can read.

#### Scenario: Clips play with debug off
- **WHEN** an exercise is opened in an environment where `DJANGO_DEBUG` is false
- **THEN** its clip loads and plays, because the media store is served by a web
  server that does not consult Django's debug setting

#### Scenario: The admin is styled with debug off
- **WHEN** the Django admin is opened in an environment where `DJANGO_DEBUG` is
  false
- **THEN** its static files are served and the page renders styled, because they
  are collected into the image and served by the application in every environment

#### Scenario: Serving clips does not occupy the application
- **WHEN** clips are being downloaded
- **THEN** the application's own workers are not the ones transferring them, so a
  slow client consumes no capacity that the GraphQL endpoint needs

#### Scenario: A clip ingested after start is served
- **WHEN** ingestion writes new clips into the media store while the stack is
  running
- **THEN** they are served on request without restarting or redeploying
  anything, because the server reads the store rather than an index built at
  start

#### Scenario: The media store is read by a server that is not the backend
- **WHEN** the chart is installed
- **THEN** the media volume is mounted by the media server read-only and by the
  backend for writing, and both see the same store

#### Scenario: Media can be served from outside the chart
- **WHEN** a deployment turns the chart's media server off, having arranged to
  serve the clips elsewhere
- **THEN** no media server is created and the Gateway routes nothing to one,
  while the rest of the stack is unchanged

#### Scenario: Static files are in the image, not collected at start
- **WHEN** the backend image is built
- **THEN** Django's static files are collected into it, so no pod start depends
  on a collection step and no two replicas can disagree about what they serve
