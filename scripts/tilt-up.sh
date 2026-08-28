#!/bin/sh
# Start Tilt for this worktree.
#
# Two things have to be right, and neither is Tilt's default:
#
#   KIND_EXPERIMENTAL_PROVIDER=docker — kind must drive docker, not podman.
#     Tilt builds images with the docker daemon and then hands them to
#     `kind load`; pointed at podman, that looks for them in podman's storage,
#     does not find them, and the cluster ends up pulling `typelearn-backend`
#     from Docker Hub and failing with ImagePullBackOff. (kind 0.32 cannot drive
#     podman 6 at all — its `ps --format` template errors — so docker is the only
#     working provider here regardless.)
#
#   --port — Tilt's UI binds 10350 and refuses to start when it is taken, so a
#     second worktree could not run Tilt at all without its own port.
#
# Anything after `--` is passed through to `tilt up`.
set -eu

export KIND_EXPERIMENTAL_PROVIDER=docker

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PORT=$("$ROOT/scripts/worktree-env.sh" tilt-port)
GATEWAY=$("$ROOT/scripts/worktree-env.sh" port)

echo "Tilt UI:   http://localhost:$PORT"
echo "TypeLearn: http://localhost:$GATEWAY"

cd "$ROOT"
exec tilt up --port "$PORT" "$@"
