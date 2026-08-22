# local-dev-environment Specification

## Purpose
TBD - created by archiving change align-specs-with-reality. Update Purpose after archive.
## Requirements
### Requirement: PostgreSQL runs in a Podman container
Local development SHALL use PostgreSQL 17 hosted by Podman via `podman-compose`, not a host-installed database and not Docker. Podman is the chosen runtime because it is rootless and daemonless while remaining Docker-CLI compatible.

#### Scenario: Starting the database
- **WHEN** a developer runs the project's compose command
- **THEN** a `postgres:17` container starts on the project network with a persistent volume, and the backend can connect to it

#### Scenario: Data survives a restart
- **WHEN** the database container is stopped and started again
- **THEN** previously ingested exercises are still present, because storage is a named volume rather than container-local

#### Scenario: Credentials are not hardcoded
- **WHEN** the compose file is read
- **THEN** `POSTGRES_PASSWORD` and `POSTGRES_DB` come from an environment file rather than literals in the compose file, and that environment file is not committed

### Requirement: Repository ignore rules cover generated and downloaded artifacts
The repository SHALL carry ignore rules that actually match the paths they name. A `.gitignore` pattern containing a slash is anchored to the directory holding that `.gitignore` file, so `src/backend/.venv` written inside `src/.gitignore` matches `src/src/backend/.venv` and never ignores the real virtualenv.

Ignored: `data/`, `__pycache__/`, `.venv/`, environment files holding credentials, frontend `node_modules/` and build output.

#### Scenario: Virtualenv is ignored
- **WHEN** `git status` runs with a virtualenv present at `src/backend/.venv`
- **THEN** no file under that directory is listed as untracked

#### Scenario: Corpus and media are ignored
- **WHEN** downloaded corpus data or copied audio is present under `data/`
- **THEN** `git status` lists nothing from that directory

#### Scenario: Credential files are ignored
- **WHEN** the database environment file exists locally
- **THEN** it is not offered for commit

### Requirement: Project naming is language-neutral
Code-level names SHALL NOT hardcode "Thai", because the application is designed to support any language and Thai is only the first dataset. The Django project SHALL be named `typelearn`.

#### Scenario: Django project name
- **WHEN** the backend settings module is imported
- **THEN** its dotted path is under `typelearn`, not `thai_learn`

#### Scenario: Language-specific components stay named for their language
- **WHEN** a component is genuinely Thai-specific, such as the on-screen Thai keyboard layout
- **THEN** it may carry the language in its name, since it is not a project-wide identifier

### Requirement: Repository layout
The repository SHALL keep backend and frontend under `src/`, with corpus and generated data under an ignored `data/` directory at the repository root.

#### Scenario: Locating the backend
- **WHEN** a developer looks for Django code
- **THEN** it is under `src/backend/`, alongside `pyproject.toml` and `manage.py`

#### Scenario: Locating the frontend
- **WHEN** a developer looks for Vue code
- **THEN** it is under `src/frontend/`, alongside `package.json` and `vite.config.js`

