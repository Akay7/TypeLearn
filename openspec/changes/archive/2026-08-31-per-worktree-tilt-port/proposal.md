## Why

The parallel-worktree work stopped one port short. Each worktree gets its own
namespace and its own Gateway port, but Tilt's own web UI was deliberately left
on the fixed `10350` for every checkout, with the stated consequence that only
one Tilt attaches at a time. That was a mistake: a running `tilt up` is what
syncs source into the pods and what serves the migration, ingestion and
test buttons. With one Tilt, a developer genuinely working in two worktrees has
a live stack in only one of them — the other's pods stop receiving edits the
moment the second `tilt up` steals the port. The port that moves per worktree
should include Tilt's.

## What Changes

- **Tilt's web port is derived per worktree**, from the same identity that
  already decides the namespace and the Gateway port: `10350` for the main
  checkout, `10350 + offset` for a linked worktree.
- `scripts/worktree-env.sh` — the single source of that mapping — gains a
  `tilt-port` field and adds `WT_TILT_PORT` to its `export` line.
- `.envrc` sources the script and exports `TILT_PORT`, so `tilt up` in any
  worktree binds its own port with no flag and no `.envrc.local` edit. Pinning
  `WORKTREE_OFFSET` moves the Tilt port with everything else.
- **BREAKING (developer-facing)**: `tilt up` in a linked worktree now serves its
  UI on `localhost:10350 + offset`, not `localhost:10350`. The `print` line at
  bring-up and the README's worktree section state the address. Anyone with a
  bookmarked `:10350` for a non-main worktree updates it once.
- The Tiltfile comment and the README paragraph that explained why the UI
  *doesn't* move are replaced by the derivation and its one line of rationale.
  `TILT_PORT` stops being the "if you really want two Tilts" escape hatch and
  becomes the normal override, consistent with `WORKTREE_OFFSET`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-dev-environment`: the "Parallel worktrees run side by side" requirement
  currently carves out Tilt's UI as the one address that stays put, so that only
  one Tilt runs at a time. That scenario is replaced: every per-worktree
  identity — namespace, Gateway port, and now Tilt's web port — is derived from
  the same source, so every worktree's Tilt can attach at once.

## Impact

- **Changed**: `scripts/worktree-env.sh` (new `tilt-port` field, `WT_TILT_PORT`
  in `export`), `.envrc` (source the script, export `TILT_PORT`), `Tiltfile`
  (header comment and the bring-up `print`), `README.md` (the worktree section).
- **Unchanged**: the cluster, the chart, the images, CI, every namespace and
  Gateway-port derivation, and the shared `data/media` volume. Tilt's behaviour
  inside the cluster does not change — only the host port its UI listens on.
- **Not in scope**: the `local-run-workflows` change, which is about running a
  single component on the host and does not touch worktree identity.
