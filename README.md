# TypeLearn

[![CI](https://github.com/Akay7/TypeLearn/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Akay7/TypeLearn/actions/workflows/ci.yml?query=branch%3Amain)
[![Translation status](https://hosted.weblate.org/widget/typelearn/svg-badge.svg)](https://hosted.weblate.org/engage/typelearn/)
[![License](https://img.shields.io/github/license/Akay7/TypeLearn)](LICENSE)
[![Top language](https://img.shields.io/github/languages/top/Akay7/TypeLearn)](https://github.com/Akay7/TypeLearn)

A language-learning app where you learn by typing what you hear: play a clip, read
the expected sentence, type it, get instant feedback. Thai is the first dataset; the
app is designed for any language.

- `docs/` — how to develop, deploy, and translate
- `specs/` — background docs: mission, roadmap, tech stack
- `openspec/specs/` — normative behaviour specs
- `src/backend/` — Django + Strawberry GraphQL
- `src/frontend/` — Vue 3 + Vite + Pinia + Tailwind
- `data/` — corpus and generated data, git-ignored

## Running it locally

You need `kind` 0.33+, `tilt`, `kubectl`, `helm`, `direnv`, and Docker or rootless
Podman. With Podman, first run `export KIND_EXPERIMENTAL_PROVIDER=podman`.

```bash
direnv allow
kind create cluster --config "$(scripts/kind-config.sh --write)"
tilt up
```

The app is then at **http://localhost:8500**. To load exercises, point
`TYPELEARN_CORPUS_DIR` at a Common Voice release before creating the cluster and
press **Ingest the corpus** in the Tilt UI.

Development mode, tests, debugging and running several worktrees are covered in
[docs/development.md](docs/development.md). Installing on a real cluster is in
[docs/deployment.md](docs/deployment.md).

## Translating

Help translate TypeLearn on [Hosted Weblate](https://hosted.weblate.org/engage/typelearn/).
You don't need to open a pull request: Weblate commits your translations and opens
it for you. Any text not translated yet shows in English.

To change the English wording or add a language, see
[docs/translation.md](docs/translation.md).

## License

AGPL-3.0-or-later — see [LICENSE](LICENSE). Running a modified copy of this
project as a network service still requires offering that copy's source to its
users.
