## Context

`scripts/worktree-env.sh` is the single source of a worktree's identity. From a
slug it derives a namespace (`typelearn-<slug>`), an offset (`1..50`, or `0` for
the main checkout, or an explicit `WORKTREE_OFFSET`), and a Gateway port
(`8500 + offset`). The Tiltfile sources these values; nothing recomputes them.

The script currently stops there, with a comment stating that Tilt's own UI is
"deliberately not derived" and stays on `10350` for every worktree. The README
spells out the consequence: only one Tilt attaches at a time, and bringing up a
second worktree leaves the first worktree's *stack* running in the cluster while
its Tilt — and therefore its `live_update` source sync and its buttons — is gone.

That trade was made on the view that Tilt is "the tool you have open" rather than
something the project serves. In practice a developer working two worktrees at
once wants both live: editing a file in the detached worktree does nothing until
its Tilt is back, and getting it back steals the port from the other one. The
offset that already spaces out namespaces and Gateway ports should space out
Tilt too.

Tilt reads `TILT_PORT` from the environment as the default for its `--port`
flag, so the whole change is: derive the number, and put it in the environment
before `tilt up` runs.

## Goals / Non-Goals

**Goals:**

- Tilt's web port is derived from the same offset as everything else: `10350`
  for the main checkout, `10350 + offset` for a linked worktree.
- `tilt up` in any worktree binds its own Tilt port with no flag typed and no
  per-worktree file edited.
- The derivation lives only in `worktree-env.sh`, consistent with the namespace
  and the Gateway port.
- Pinning `WORKTREE_OFFSET` moves the Tilt port along with the namespace and the
  Gateway port — one knob, not two.

**Non-Goals:**

- Changing anything Tilt does inside the cluster, the chart, the images, or CI.
- Moving Tilt's port for the main checkout. It stays `10350`; a bare clone with
  no worktrees sees no change.
- Deriving any other Tilt-internal port. Tilt listens on one host port for its
  UI and API; that is the one that collides and the only one addressed here.

## Decisions

### 1. `worktree-env.sh` gains a `tilt-port` field

`tilt-port` prints `${TILT_PORT:-$(( 10350 + OFFSET ))}`, mirroring how `port`
prints `${GATEWAY_PORT:-$(( 8500 + OFFSET ))}`. The `export` subcommand adds
`WT_TILT_PORT=<n>` to its line. `10350` is Tilt's own default, so the main
checkout (`OFFSET=0`) is unchanged and the base stays recognisable.

The offset is `1..50`, so linked worktrees land in `10351..10400` — clear of the
`8500` application range and of Tilt's default with room to spare.

*Alternatives considered.* A separate `TILT_OFFSET`: a second knob for something
that should track the one identity. Basing the Tilt port on the Gateway port
(`GATEWAY_PORT + 1850` or similar): couples two numbers that are only related
through the offset, and breaks the moment someone pins `GATEWAY_PORT` alone.

### 2. `.envrc` exports `TILT_PORT`

`.envrc` is committed and loaded by direnv on entering the project, before any
`tilt up`. It gains a block that runs `scripts/worktree-env.sh` and exports
`TILT_PORT` from `WT_TILT_PORT` (and it is natural to export the sibling values
too, but `TILT_PORT` is the one this change needs). Tilt then picks it up with
no flag.

This is also why the Tiltfile itself does not set the port: by the time the
Tiltfile is evaluated, Tilt's HTTP server is already bound. The number has to be
in the environment first, and direnv is where this project already puts
per-checkout environment.

*Alternatives considered.* A wrapper script (`scripts/tilt.sh`) that exports the
port and execs `tilt`: another entry point to document and to remember to use
instead of `tilt up`. A `.vscode` task that passes `--port`: covers the editor
and not the terminal. direnv covers both and is already a project prerequisite.

### 3. `TILT_PORT` becomes the normal override, not an escape hatch

The README currently presents `TILT_PORT` as the thing to set "if you really
want two Tilts at once". After this change two Tilts at once is the default and
`TILT_PORT` is just the explicit override, exactly parallel to `GATEWAY_PORT`
and `WORKTREE_OFFSET`. The worktree section is rewritten so that only the audio
volume remains in the "deliberately not per-worktree" list.

## Risks / Trade-offs

- **A bookmarked `:10350` for a non-main worktree breaks** → it is a
  developer-facing break, called out as BREAKING in the proposal. The bring-up
  `print` and the README name the real address, and `worktree-env.sh tilt-port`
  reports it. One-time fix per bookmark.
- **direnv not allowed in a fresh worktree** → `TILT_PORT` is unset and Tilt
  falls back to `10350`, colliding with the main checkout as it does today.
  `direnv allow` is already a documented first step; this adds one more reason
  it matters, and the README note stays.
- **`.envrc` now shells out to a script on every directory entry** →
  `worktree-env.sh` is a few lines of `sh` and one `git rev-parse`; the cost is
  negligible and direnv caches the result until `.envrc` changes.
- **Someone pins `GATEWAY_PORT` but not `WORKTREE_OFFSET`** → the Tilt port
  still derives from the offset, so the two can diverge. This is already true of
  the namespace, and pinning is meant to be done through `WORKTREE_OFFSET`,
  which moves all three together. The README points at the offset, not the
  individual ports.

## Migration Plan

1. Add `tilt-port` to `worktree-env.sh` and `WT_TILT_PORT` to its `export` line;
   replace the "deliberately not derived" comment with the derivation's
   rationale.
2. Add the `TILT_PORT` export to `.envrc`.
3. Update the Tiltfile header comment and the bring-up `print` so both name the
   Tilt address alongside the Gateway address.
4. Rewrite the README's "Running several worktrees at once" section: audio is
   the only thing left that is not per-worktree; `TILT_PORT` is the override,
   not the escape hatch.
5. Verify: `tilt up` in the main checkout still serves its UI on `10350`;
   `tilt up` in a linked worktree serves on `10350 + offset` while the main
   checkout's Tilt keeps running; a file edited in the linked worktree syncs
   into its pod with the main checkout's Tilt still up.

Rollback is reverting the commit. No cluster state, data, or image changes.

## Open Questions

- **Whether `.envrc` should export `WT_NAMESPACE` and `WT_PORT` too** while it is
  sourcing the script, so a shell in a worktree can echo them without re-running
  the script. Leaning yes for convenience, but only `TILT_PORT` is required by
  this change and the others can be added when something needs them.
