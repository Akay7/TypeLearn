## 1. Prove the risky parts first

- [x] 1.1 Create a throwaway kind cluster with `disableDefaultCNI: true`, a single node, and a pod subnet matching Calico's default; install the Tigera Operator and an `Installation`, and confirm pods get addresses and can reach each other
- [x] 1.2 On that cluster, enable Gateway API by creating the `GatewayAPI` resource (`operator.tigera.io/v1`, name `default`) and confirm the `tigera-gateway-class` GatewayClass appears
- [x] 1.3 Confirm the name of the default StorageClass kind ships (Rancher's local-path-provisioner) and that a dynamically provisioned PVC binds and is writable
- [x] 1.4 Install the CloudNativePG operator and confirm a single-instance `Cluster` on that StorageClass reaches ready and accepts a connection
- [x] 1.5 Prove the shared-media shape: mount a host directory into the node via `extraMounts`, create two static hostPath PVs pointing at it with `claimRef` pre-set, bind a PVC in each of two namespaces, and confirm a file written by a pod in one is readable by a pod in the other
- [x] 1.6 Confirm the container user can actually write to that mounted directory — a hostPath mount carries the host's ownership, and a mismatch shows up as a permission error at ingestion rather than at mount
- [x] 1.7 Delete the throwaway cluster

## 2. Worktree identity

- [x] 2.1 Write `scripts/worktree-env.sh` implementing `slug` / `namespace` / `offset` / `export` / `sanitize`, with the linked-worktree test comparing the resolved git dir against the common git dir
- [x] 2.2 Confirm the main checkout resolves to slug `default`, namespace `default`, offset `0`, so the common case is unchanged
- [x] 2.3 Confirm a linked worktree resolves to its directory name, a `typelearn-<slug>` namespace, and a non-zero offset, and that `WORKTREE_SLUG` / `WORKTREE_OFFSET` override both
- [x] 2.4 Confirm the derivation is deterministic — the same slug yields the same offset across runs and across shells

## 3. Container images

- [x] 3.1 Write `src/backend/Containerfile`: Python, the backend's dependencies, and a default command running gunicorn — no corpus, no media, no secrets baked in
- [x] 3.2 Settle the Poetry-in-image vs exported-requirements question (design's second open question) by building both and comparing size and build time
- [x] 3.3 Write `src/frontend/Containerfile` with a `build` stage carrying source and `node_modules` and a `serve` stage serving the built bundle from nginx, so CI can run the suites in the first and deploy the second
- [x] 3.4 Confirm both images build and run standalone before any manifest references them

## 4. Manifests

- [x] 4.1 `k8s/kind.yaml` — a single-node cluster (the shared media directory depends on it, and a second node would fail quietly) with the default CNI disabled, the pod subnet Calico expects, and `extraMounts` bringing both the corpus directory and `data/media` into the node
- [x] 4.2 `k8s/base/postgres.yaml` — a CloudNativePG `Cluster` (single instance) plus the stable Service and secret the backend reads, on the cluster's default StorageClass
- [x] 4.3 `k8s/base/backend.yaml` — Deployment with a migrate initContainer that retries while the CNPG cluster bootstraps, the shared media PVC mounted at `MEDIA_ROOT`, readiness and liveness probes, and configuration from the environment file
- [x] 4.4 `k8s/base/media-pv.yaml` — this worktree's own static hostPath PersistentVolume (slug in the name, since PVs are cluster-scoped; `claimRef` pre-set to its PVC) pointing at the shared node path, plus the PVC bound to it — not a second claim on one shared PV, which Kubernetes forbids across namespaces
- [x] 4.5 `k8s/base/frontend.yaml` — Deployment running `vite dev --host`, for Tilt to sync source into
- [x] 4.6 `k8s/base/gateway.yaml` — a namespaced Gateway with `gatewayClassName: tigera-gateway-class`
- [x] 4.7 `k8s/base/httproute.yaml` — `/graphql/`, `/media/`, `/admin/`, `/static/` to the backend; `/` to the frontend
- [x] 4.8 `k8s/base/kustomization.yaml` tying them together
- [x] 4.9 `k8s/overlays/prod/` — swap the frontend to the nginx `serve` image and name a real StorageClass for the media volume, so the hostPath divergence is visible in the manifests rather than assumed
- [x] 4.10 `k8s/ingest-job.yaml` — a Job mounting the corpus read-only and running `load_corpus`, with the corpus path taken from the environment

## 5. Tiltfile

- [x] 5.1 Read slug, namespace, and offset from `scripts/worktree-env.sh` — never re-derive them in the Tiltfile
- [x] 5.2 Bootstrap the cluster-scoped components (Tigera Operator, `GatewayAPI`, CloudNativePG) install-if-missing, with versions pinned in one declaration, and never under Tilt's ownership so a force-update cannot delete what other worktrees depend on
- [x] 5.3 Create this worktree's media PV and PVC, named for the slug and pre-bound with `claimRef`
- [x] 5.4 Create the worktree namespace when the slug is not `default`, and inject it into every manifest
- [x] 5.5 Build both images with `live_update`: sync backend source, and run migrations in place when a migration file changes
- [x] 5.6 Port-forward the worktree's Gateway to `8500 + offset` — and nothing else, since the database is reached only from inside the cluster
- [x] 5.7 Add a `CI_PREBUILT` mode that skips image building and deploys the images already loaded into the cluster, so CI tests the exact artifact it built
- [x] 5.8 Add Tilt buttons for ingestion, migrations, and the backend test suite — these are the supported way to run a management command, since no database port is exposed
- [x] 5.9 Confirm `tilt up` in the main checkout brings up a working application reachable at `localhost:8500`

## 6. Same origin, and CORS goes away

- [x] 6.1 Delete `django-cors-headers` from `pyproject.toml`, `corsheaders` from `INSTALLED_APPS`, its middleware entry, and `CORS_ALLOWED_ORIGINS` from `settings.py`
- [x] 6.2 Read database and media configuration from the environment the cluster supplies, and set `ALLOWED_HOSTS` for the in-cluster hostnames and the Gateway
- [x] 6.3 Point `VITE_API_URL` at the same-origin path and delete the cross-origin default from `.env.development`
- [x] 6.4 Set `server.hmr.clientPort` from the worktree's gateway port so Vite's HMR websocket survives the Gateway (design's fiddly part — the prod overlay is the fallback if it cannot be made to work)
- [x] 6.5 Confirm in the browser's network panel that the GraphQL request is same-origin, sends no preflight, and carries no CORS headers
- [x] 6.6 Confirm an audio clip plays, and that `audioUrl` names the Gateway's origin
- [x] 6.7 Write the environment file handling: one ignored file read by both the cluster and host-run management commands, with a committed example carrying no secret, and delete `db.env` / `db.example.env`

## 7. Parallel worktrees

- [x] 7.1 Bring up a second worktree and confirm it lands in its own namespace on its own port with the first still running
- [x] 7.2 Confirm the two have separate databases — an exercise ingested in one is absent from the other
- [x] 7.3 Confirm the two share the audio: clips ingested by the first are readable by the second without ingesting again, and both resolve to the same host directory
- [x] 7.4 Confirm bringing the second one up did not reinstall the shared operators or recreate the shared media volume or disturb the first worktree's stack
- [x] 7.5 Confirm `tilt down` in one worktree leaves the other running, and that deleting the cluster entirely leaves the clips on the host

## 8. CI

- [x] 8.1 `.github/workflows/ci.yml` — triggers on pull requests and pushes to main, with a concurrency group cancelling superseded runs
- [x] 8.2 `setup` job computing lowercase image refs and a per-commit candidate tag
- [x] 8.3 `build-backend` and `build-frontend` jobs building and pushing the candidate images, with layer caching, and the frontend also pushing its `build` stage under a `-test` tag
- [x] 8.4 `pytest` job running the backend suite inside the backend candidate image against a Postgres service
- [x] 8.5 `vitest` job running the unit suite inside the frontend `-test` image
- [x] 8.6 `playwright` job running the 29 browser tests inside the `-test` image — no database, no corpus, no backend
- [x] 8.7 `smoke` job creating a kind cluster, bringing the stack up through the project's own Tiltfile in `CI_PREBUILT` mode, and checking the Gateway serves the frontend at `/` and answers a GraphQL query at the same origin with an empty catalog
- [x] 8.8 `publish` job retagging the tested images on main — a retag, never a rebuild
- [x] 8.9 Confirm a deliberately failing test fails the run, so the workflow is not reporting success on a partial result
- [x] 8.10 Decide whether the smoke test seeds a few exercises from the backend fixtures' miniature corpus (design's third open question) — decided against: the smoke test asserts the stack answers, not what it holds, which keeps CI free of the corpus entirely

## 9. Documentation and cleanup

- [x] 9.1 Delete `podman-compose.yml`, `db.env`, and `db.example.env`
- [x] 9.2 Rewrite the README's "Local setup": prerequisites, cluster creation, `tilt up`, ingestion, and how to run a second worktree
- [x] 9.3 Update `specs/tech-stack.md` — Tilt, kind, Calico, CloudNativePG, and the removal of `django-cors-headers` and podman-compose
- [x] 9.4 Add decision-log rows to `specs/roadmap.md` for the cluster move, the single origin, Calico, CloudNativePG, the shared host-directory media store, and CI
- [x] 9.5 Add `.gitignore` rules for anything the new tooling generates
- [x] 9.6 Run the whole suite — backend pytest, frontend unit, frontend browser — and `openspec validate tilt-dev-cluster-and-ci`, before archiving
