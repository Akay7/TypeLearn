## 1. Derive the Tilt port in the one place

- [x] 1.1 Add a `tilt-port` subcommand to `scripts/worktree-env.sh` printing `${TILT_PORT:-$(( 10350 + OFFSET ))}`, mirroring the existing `port` line
- [x] 1.2 Add `WT_TILT_PORT=<n>` to the `export` subcommand's output line
- [x] 1.3 Replace the "Tilt's own UI is deliberately not derived here" comment block with the derivation's rationale (base 10350, offset spaces linked worktrees to 10351..10400, so several Tilts attach at once)
- [x] 1.4 Update the `Usage` and `Rules` comment blocks to list `tilt-port` and the `TILT_PORT | 10350 + offset` rule

## 2. Put it in the environment before Tilt starts

- [x] 2.1 In `.envrc`, run `scripts/worktree-env.sh` and `export TILT_PORT` from `WT_TILT_PORT`, with a comment that Tilt reads it before its own server binds so the Tiltfile cannot set it
- [x] 2.2 Confirm direnv reloads cleanly in the main checkout and `TILT_PORT` resolves to 10350 there

## 3. Say the address at bring-up

- [x] 3.1 Update the Tiltfile header comment so it describes Tilt's UI port as per-worktree alongside the Gateway port, not fixed
- [x] 3.2 Extend the bring-up `print(...)` line so it reports the Tilt UI address (`http://localhost:$TILT_PORT`) next to the gateway address

## 4. Documentation

- [x] 4.1 Rewrite `README.md`'s "Running several worktrees at once": audio is the only thing left that is not per-worktree; drop the "one Tilt at a time" consequence
- [x] 4.2 Present `TILT_PORT` as the explicit override parallel to `WORKTREE_OFFSET` / `GATEWAY_PORT`, not as the "if you really want two Tilts" escape hatch
- [x] 4.3 Update the `tilt up   # e.g. http://localhost:8517` example area to also show the worktree's Tilt UI address

## 5. Verify

- [ ] 5.1 `tilt up` in the main checkout still serves its UI on `localhost:10350`
- [ ] 5.2 `tilt up` in a linked worktree serves its UI on `localhost:10350 + offset` while the main checkout's Tilt stays up and attached
- [ ] 5.3 A file edited in the linked worktree `live_update`-syncs into its pod with the main checkout's Tilt still running
- [x] 5.4 `scripts/worktree-env.sh tilt-port` and `... export` report the expected values in the main checkout and in a linked worktree, and `WORKTREE_OFFSET=N` moves the Tilt port with the namespace and Gateway port
- [x] 5.5 `openspec validate per-worktree-tilt-port --strict` passes
