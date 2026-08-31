#!/bin/sh
# Resolve this git worktree's identity — slug, Kubernetes namespace, the host
# port the application is served on, and the host port Tilt's own UI listens on
# — so that several checkouts can run their stacks at once against one cluster
# without any of them being edited to avoid a collision.
#
# This script is the single source of truth. The Tiltfile sources these values
# rather than re-deriving them, and anything else that needs to know where a
# worktree's stack lives asks here too: two callers computing the same mapping
# independently is two callers that can disagree, and the failure would look
# like data appearing in the wrong namespace.
#
# Rules:
#   slug      = WORKTREE_SLUG (sanitized) | linked-worktree dir name | "default"
#   namespace = "default"                 | "typelearn-<slug>"
#   offset    = WORKTREE_OFFSET | 0 (for "default") | cksum(slug) % 50 + 1
#   port      = GATEWAY_PORT    | 8500 + offset
#   tilt-port = TILT_PORT       | 10350 + offset
#
# The Gateway is the host port the application is served on; the database is
# reached from inside the cluster and exposes none. Both the Gateway port and
# Tilt's own UI port move with the offset, so several worktrees can serve their
# stacks and keep their Tilts attached at the same time — a detached Tilt stops
# syncing source into its worktree's pods, so it is not the tool you merely have
# open, it is part of the running stack. The main checkout (offset 0) keeps
# Tilt's default 10350, so a bare clone with no worktrees sees no change.
#
# Usage:
#   worktree-env.sh slug        # "default" or e.g. "add-session-summary"
#   worktree-env.sh namespace   # "default" or "typelearn-<slug>"
#   worktree-env.sh offset      # 0 for the main checkout, else 1..50
#   worktree-env.sh port        # the Gateway's host port
#   worktree-env.sh tilt-port   # the host port Tilt's UI listens on
#   worktree-env.sh export      # WT_SLUG=… WT_NAMESPACE=… … for `eval`
#   worktree-env.sh sanitize X  # reduce an arbitrary value to a slug label
set -eu

# Lower-case and reduce to a DNS-1123 label (alnum + '-'); trim stray dashes.
# An empty result falls back to "default" rather than producing an invalid name.
sanitize_label() {
	out=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9-]/-/g' -e 's/^-*//' -e 's/-*$//')
	if [ -n "$out" ]; then printf '%s' "$out"; else printf 'default'; fi
}

# `sanitize` needs only its argument — short-circuit before touching git, which
# is irrelevant to sanitizing a value and would fail outside a repository.
if [ "${1:-}" = "sanitize" ]; then
	sanitize_label "${2:-}"
	echo
	exit 0
fi

resolve_slug() {
	if [ -n "${WORKTREE_SLUG:-}" ]; then
		sanitize_label "$WORKTREE_SLUG"
		return
	fi
	# A linked worktree's git-dir differs from the resolved common (main) git-dir;
	# in the main checkout the two are the same path. So only a linked worktree
	# gets a slug, and a bare `tilt up` in the main checkout is unchanged.
	if [ "$(git rev-parse --absolute-git-dir)" = "$(cd "$(git rev-parse --git-common-dir)" && pwd)" ]; then
		printf 'default'
	else
		sanitize_label "$(basename "$(pwd)")"
	fi
}

resolve_offset() {
	if [ -n "${WORKTREE_OFFSET:-}" ]; then
		printf '%s' "$WORKTREE_OFFSET"
		return
	fi
	if [ "$1" = "default" ]; then
		printf '0'
		return
	fi
	# Deterministic per-slug fallback in 1..50 when no explicit index is given:
	# the same worktree always lands on the same port, across runs and shells.
	cks=$(printf '%s' "$1" | cksum | cut -d' ' -f1)
	printf '%s' "$(( cks % 50 + 1 ))"
}

SLUG=$(resolve_slug)
if [ "$SLUG" = "default" ]; then
	NAMESPACE="default"
else
	NAMESPACE="typelearn-$SLUG"
fi
OFFSET=$(resolve_offset "$SLUG")
# Both bases end in 00 and the offset stays under 100, so the last two digits of
# each port name the worktree, and the main checkout gets the bare 8500 / 10350.
PORT=${GATEWAY_PORT:-$(( 8500 + OFFSET ))}
TILT_PORT=${TILT_PORT:-$(( 10350 + OFFSET ))}

case "${1:-export}" in
	slug) printf '%s\n' "$SLUG" ;;
	namespace) printf '%s\n' "$NAMESPACE" ;;
	offset) printf '%s\n' "$OFFSET" ;;
	port) printf '%s\n' "$PORT" ;;
	tilt-port) printf '%s\n' "$TILT_PORT" ;;
	export) printf 'WT_SLUG=%s WT_NAMESPACE=%s WT_OFFSET=%s WT_PORT=%s WT_TILT_PORT=%s\n' "$SLUG" "$NAMESPACE" "$OFFSET" "$PORT" "$TILT_PORT" ;;
	*) echo "usage: $0 {slug|namespace|offset|port|tilt-port|export|sanitize <value>}" >&2; exit 2 ;;
esac
