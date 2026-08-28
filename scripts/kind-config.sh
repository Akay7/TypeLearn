#!/bin/sh
# Print k8s/kind.yaml with this machine's paths substituted in.
#
# The paths are resolved here rather than written into the committed file: the
# media directory belongs to whoever cloned the repository, and the corpus lives
# outside it entirely and differs per machine. Neither belongs in git.
#
#   kind create cluster --config "$(scripts/kind-config.sh --write)"
#
# kind talks to a container runtime through KIND_EXPERIMENTAL_PROVIDER. It is
# forced to docker below: kind 0.32 cannot drive podman 6, whose `ps --format`
# reports .Labels as a slice, so `kind get clusters` fails with a template error
# and nothing that scripts against kind can work.
#
#   TYPELEARN_CORPUS_DIR   the Common Voice release directory. Optional — when
#                          unset the media directory is mounted in its place,
#                          because a kind mount needs a path that exists.
set -eu

export KIND_EXPERIMENTAL_PROVIDER=docker

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MEDIA_DIR="${TYPELEARN_MEDIA_DIR:-$ROOT/data/media}"
CORPUS_DIR="${TYPELEARN_CORPUS_DIR:-$MEDIA_DIR}"

mkdir -p "$MEDIA_DIR"

if [ ! -d "$CORPUS_DIR" ]; then
	echo "TYPELEARN_CORPUS_DIR does not exist: $CORPUS_DIR" >&2
	exit 1
fi

render() {
	sed -e "s#TYPELEARN_MEDIA_DIR#$MEDIA_DIR#" -e "s#TYPELEARN_CORPUS_DIR#$CORPUS_DIR#" "$ROOT/k8s/kind.yaml"
}

# `kind --config` needs a real file, and process substitution is not portable,
# so --write puts the rendered config in the gitignored scratch directory and
# prints its path.
if [ "${1:-}" = "--write" ]; then
	mkdir -p "$ROOT/.tilt"
	render > "$ROOT/.tilt/kind.yaml"
	printf '%s\n' "$ROOT/.tilt/kind.yaml"
else
	render
fi
