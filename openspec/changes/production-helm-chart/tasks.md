## 1. Chart skeleton and the values contract

- [ ] 1.1 Create `chart/` with `Chart.yaml` (name `typelearn`, an app version, no dependencies — the operators are cluster prerequisites, not subcharts)
- [ ] 1.2 Write `chart/values.yaml` with deployment-shaped defaults: debug off, no development affordance switched on, and every key documented in place rather than in a separate table that will drift
- [ ] 1.3 Write `chart/templates/_helpers.tpl` — name, fullname, labels, and one helper resolving which Secret the backend reads (the chart's own, or `existingSecret`)
- [ ] 1.4 Add `chart/values-prod.yaml.example`, a commented starting point showing image tags, hostname, storage class, and `existingSecret`

## 2. Configuration and secrets

- [ ] 2.1 `templates/configmap.yaml` — render every entry of `.Values.env`, so a new backend setting is a values entry and never a template edit
- [ ] 2.2 `templates/secret.yaml` — render `.Values.secrets`, and render nothing at all when `existingSecret` is set or the map is empty
- [ ] 2.3 Wire the backend's `envFrom` to the ConfigMap and to whichever Secret the helper resolved
- [ ] 2.4 Keep the database credentials out of both maps: map CNPG's generated Secret key by key (`dbname`, `username`, `password`, `host`, `port`) to the names Django reads, because CNPG's keys are lowercase and injecting them wholesale would put a bare `host`, `port`, and `user` into the environment
- [ ] 2.5 Confirm by rendering: a secret value never appears in a ConfigMap, and with `existingSecret` set the chart emits no Secret of its own

## 3. The database

- [ ] 3.1 `templates/postgres-cluster.yaml` — a CNPG `Cluster` from values: `instances`, `imageName` (pinned to PostgreSQL 17, matching the specs), `storage.size`, `storage.storageClass`, and `resources`
- [ ] 3.2 Annotate the Cluster `helm.sh/resource-policy: keep`, so `helm uninstall` cannot take the data with it
- [ ] 3.3 Support `postgres.enabled: false` with an `externalDatabase` block — host, port, database, user, and a Secret reference for the password — and confirm no database is rendered in that case
- [ ] 3.4 Render both ways and check the backend's environment resolves correctly in each

## 4. Workloads, routing, and storage

- [ ] 4.1 `templates/backend.yaml` — Deployment and Service, with the migrate initContainer, probes, replica count, resources, and image reference all from values
- [ ] 4.2 `templates/frontend.yaml` — one template, `frontend.mode: dev|serve` choosing the dev server or the built bundle behind nginx, with the port and probe following the mode
- [ ] 4.3 `templates/gateway.yaml` and `templates/httproute.yaml` — the GatewayClass from values, and `gateway.host` adding a hostname to the listener and the route when set
- [ ] 4.4 `templates/media.yaml` — when `media.hostPath` is set, the static PV (slug in the name, `claimRef` pre-bound) and its PVC that let worktrees share one directory; otherwise an ordinary PVC on `media.storageClass`
- [ ] 4.5 `templates/ingest-job.yaml`, disabled by default and a plain Job rather than a hook, so it never runs on an upgrade (design's second open question)
- [ ] 4.6 Add prerequisite checks that fail with a named error when the GatewayClass or the CNPG CRD is absent, rather than leaving resources that never become ready

## 5. Prove the chart reproduces what already works

- [ ] 5.1 `helm lint` and `helm template` the chart with development values and with the production example, and confirm both render without a cluster
- [ ] 5.2 Diff the development rendering against the current `kubectl kustomize k8s/base` output with the Tiltfile's substitutions applied; reconcile until every remaining difference is one the chart intends
- [ ] 5.3 Diff the production rendering against `kubectl kustomize k8s/overlays/prod` for the same reason
- [ ] 5.4 Record any intended differences in the design, so the diff is a decision rather than a surprise

## 6. Switch development onto the chart

- [ ] 6.1 Replace the Tiltfile's kustomize path with `helm()`, rendering the chart with generated development values
- [ ] 6.2 Generate those values from `.env` into Tilt's scratch directory, so `.env` stays the one file a developer edits and `local-dev-environment`'s single-configuration-file requirement still holds
- [ ] 6.3 Move the worktree namespace, slug, and gateway port from string substitution into values — this is what makes the quote-stripping class of bug impossible rather than fixed
- [ ] 6.4 Confirm `tilt up` still brings up a working stack: the SPA at `/`, GraphQL on the same origin, and no CORS headers
- [ ] 6.5 Confirm live update still works — a backend edit and a frontend edit both reach the running pods
- [ ] 6.6 Confirm two worktrees still run side by side with separate databases and shared audio
- [ ] 6.7 Delete `k8s/base/` and `k8s/overlays/`, keeping `k8s/kind.yaml` and the Calico bootstrap manifests, which configure the cluster rather than the application

## 7. Install it as a deployment would

- [ ] 7.1 `helm install` the chart into the local cluster in its own namespace with production-shaped values — served frontend, provisioned media volume, sized database — and confirm it comes up
- [ ] 7.2 Confirm the served-bundle frontend actually serves the built bundle through the Gateway, since this is the branch development never exercises
- [ ] 7.3 Confirm the provisioned media volume branch works, rather than only the hostPath one
- [ ] 7.4 Confirm `existingSecret` works: create a Secret by hand, install with no secret in values, and check the backend reads it
- [ ] 7.5 Confirm `helm uninstall` removes the workloads and leaves the database's volume, then clean up

## 8. CI and documentation

- [ ] 8.1 Point CI's smoke job at the chart, keeping it off anything that gates on the Gateway reporting `Programmed` — on kind it never does
- [ ] 8.2 Add a chart-rendering job so a template that does not render fails before anything is installed
- [ ] 8.3 Decide whether CI publishes the chart as an OCI artefact (design's first open question) — the default answer is no until there is somewhere to deploy
- [ ] 8.4 Document in the README how to install the chart, what the cluster must already have, and which of `secrets` and `existingSecret` belongs where
- [ ] 8.5 Update `specs/tech-stack.md` — Helm as the deployment description, and kustomize's removal
- [ ] 8.6 Add decision-log rows to `specs/roadmap.md` for the chart replacing kustomize, the config/secret split, and the database being optional
- [ ] 8.7 Run everything — backend pytest, frontend unit, frontend browser, `helm lint`, and `openspec validate production-helm-chart`
