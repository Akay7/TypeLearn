# production-deployment Specification

## Purpose
What the Helm chart must install, what a deployment has to supply, what it may
override, and the rules that keep one set of templates serving both a laptop and
a cluster.

## Requirements
### Requirement: One chart describes every environment
The project SHALL describe its stack in exactly one set of templates, rendered
with different values for different environments, rather than one description per
environment. A second description of the same Deployment is a second thing to
keep in step, and the environment it describes badly is always the one nobody
runs daily.

#### Scenario: Development renders the same templates as production
- **WHEN** the stack is brought up locally
- **THEN** it is rendered from the same chart a deployment uses, with development
  values, and no second set of manifests exists for it to drift from

#### Scenario: An environment is a values file, not a fork
- **WHEN** a new environment needs different sizing, hostnames, or images
- **THEN** it is expressed as values, and no template is copied or patched to
  accommodate it

#### Scenario: The chart renders without a cluster
- **WHEN** the chart is rendered with the values for any environment
- **THEN** it produces valid manifests without contacting a cluster, so a change
  can be reviewed and tested before anything is installed

### Requirement: Configuration is settable from values
Every environment variable the backend reads SHALL be settable from values,
without editing a template. A setting that requires a template change to
introduce is a setting that will be introduced somewhere else instead.

#### Scenario: Adding a setting
- **WHEN** the backend gains an environment variable
- **THEN** it can be supplied by adding one entry to values, and the chart passes
  it to the backend

#### Scenario: Overriding a default
- **WHEN** an environment sets a variable the chart already defaults
- **THEN** the environment's value is used

#### Scenario: Defaults are safe for a deployment
- **WHEN** the chart is installed with no values supplied
- **THEN** its defaults are the ones a deployment would want — debug off, and no
  development-only affordance switched on

### Requirement: Secrets are not configuration
Secret values SHALL NOT be rendered into a ConfigMap, and the chart SHALL be
installable without any secret being written into values at all. Values are
readable by anyone who can read the release, so a chart that can only receive a
secret through values forces every deployment to keep one there.

#### Scenario: Secrets render into a Secret
- **WHEN** secret values are supplied to the chart
- **THEN** they are rendered into a Secret, never into a ConfigMap

#### Scenario: A Secret the chart does not own
- **WHEN** a deployment names an existing Secret instead of supplying values
- **THEN** the chart references that Secret and creates none of its own, so a
  secret managed by an operator is never copied into the release

#### Scenario: Database credentials are never restated
- **WHEN** the chart deploys its own database
- **THEN** the backend reads that database's credentials from the Secret the
  database operator generated, and they appear in no values file and no template

### Requirement: The database is parameterised, and optional
The chart SHALL let a deployment size and class the database's storage, choose
its instance count and image, and SHALL let a deployment use a database the chart
does not manage at all. Storage that cannot be sized is storage that is wrong
everywhere except where it was written.

#### Scenario: Sizing the storage
- **WHEN** a deployment sets the database's storage size and storage class
- **THEN** the database is provisioned with them

#### Scenario: An external database
- **WHEN** a deployment disables the in-cluster database and supplies the address
  and credentials of another one
- **THEN** no database is created in the cluster, and the backend connects to the
  one supplied

#### Scenario: The database's data outlives the release
- **WHEN** the release is uninstalled
- **THEN** the database's volume is not silently discarded with it

### Requirement: Deployment-shaped defaults are expressed, not described
Where development and a deployment genuinely differ, the chart SHALL express the
difference as a value with both settings implemented, rather than describing the
production behaviour in a comment. A difference that exists only as prose is one
nobody has run.

#### Scenario: The frontend is served two ways
- **WHEN** a deployment selects the served-bundle mode
- **THEN** the frontend runs the built bundle behind a web server, and when
  development selects the dev-server mode it runs that instead — from the same
  template

#### Scenario: Storage differs without forking the template
- **WHEN** development shares one host directory for audio and a deployment uses
  ordinary provisioned storage
- **THEN** both come from the same template, chosen by values

#### Scenario: A hostname and TLS
- **WHEN** a deployment supplies a hostname
- **THEN** the Gateway listens for it and the route matches it, and when no
  hostname is supplied the Gateway serves every host, as it does locally

### Requirement: The chart installs the application, not the cluster
The chart SHALL NOT install cluster-scoped controllers — the CNI, the Gateway API
implementation, or the database operator. Those are shared by every release in a
cluster, so a chart that installed them would fight any other chart that did, and
uninstalling one application would take the cluster's networking with it.

#### Scenario: Prerequisites are stated, not installed
- **WHEN** the chart is installed into a cluster that has the controllers it
  depends on
- **THEN** it creates only its own resources, and the controllers are untouched

#### Scenario: A missing prerequisite fails clearly
- **WHEN** the chart is installed into a cluster missing a controller it depends
  on
- **THEN** the failure names what is missing, rather than leaving resources that
  never become ready for an unexplained reason
