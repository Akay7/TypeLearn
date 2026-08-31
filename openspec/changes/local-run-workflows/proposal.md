## Why

Everything moved into the cluster, and the ways of running one piece on the host
were never rebuilt around that. What is left is partly undocumented, partly
manual, and in one case actively broken:

- **The frontend cannot run on the host against a real backend at all.** Its
  fallback API address is `http://localhost:8000/graphql/` — a different origin
  from the dev server on `:5173` — and the backend deliberately carries no CORS
  configuration. The browser sends a preflight, nothing answers it, and the
  catalog never loads. That default is a leftover from the two-origin
  arrangement the project spent a whole change removing, and it is the only
  place it still survives.
- **There is no way to debug the backend at all.** The documented route was to
  reassemble the application on the host — port-forward the database, copy a
  generated password out of a Secret — which is both a manual ritual and a
  reconstruction that differs from what actually runs. Nothing offers the
  obvious thing: attach a debugger to the container.
- **Backend tests have two homes and no stated default.** The Tilt button runs
  pytest in the pod, which is what CI does; nothing says that this is the
  normal one, or the only one that should be.

The cluster is the right default and this change does not touch it. What it adds
is a supported way to work on one piece at a time: the frontend served from the
host against the running backend, and a debugger attached to the backend where it
already runs.

## What Changes

- **The frontend dev server proxies backend paths**, so a page served from
  `:5173` still sees exactly one origin. `/graphql/`, `/media/`, `/admin/` and
  `/static/` are forwarded to a target chosen by one environment variable; the
  browser issues no cross-origin request, sends no preflight, and needs no CORS
  headers — the same property the Gateway gives the deployed stack.
- **BREAKING (developer-facing)** the frontend's fallback API address becomes the
  same-origin path `/graphql/`. Anything relying on the old
  `http://localhost:8000/graphql/` default was relying on a request that cannot
  succeed against this backend.
- **The proxy target defaults to the cluster's Gateway**, which Tilt already
  forwards. Running the frontend on the host against real exercises then needs
  no additional setup at all — no second backend, no database, no port-forward.
- **The backend is debugged in the container, not on the host.** Switched on, it
  runs under `debugpy` and Tilt forwards the attach port; an editor connects to
  it. Nothing about the application runs on a developer's machine, so no database
  password is copied out of the cluster and no database port is opened. The stack
  comes up whether or not anyone attaches.
- **Backend tests stay in the pod**, and that is now stated rather than implied.
- `.vscode` stops carrying setup instructions in comments: one configuration
  attaches to the container, one runs the frontend's dev server.

## Capabilities

### New Capabilities

None. This is about how an existing stack is run, not about new behaviour.

### Modified Capabilities

- `local-dev-environment`: gains requirements that the frontend can be served
  from the host against the running stack without giving up the single origin,
  that the backend is debugged where it runs rather than reassembled on a
  developer's machine, and that the test suite runs where CI judges it. The
  existing single-origin requirement is extended to cover the host dev server,
  which it currently does not mention, and bring-up gains a guard against
  deploying into a cluster that is not this project's.

## Impact

- **Changed**: `src/frontend/vite.config.js` (a dev-server proxy),
  `src/frontend/src/stores/exercise.js` (the fallback address),
  `.vscode/launch.json` and `settings.json` (call the script instead of
  describing it), `README.md`.
- **New**: `debugpy` in the backend's dev dependency group, a `backend.debug`
  branch in the chart, and an opt-in attach port forwarded by Tilt.
- **Unchanged**: the cluster, the chart, the Tiltfile's bring-up, the images, CI,
  and every test's behaviour. The browser suite already stubs the catalog and
  runs against its own dev server, so it is unaffected either way.
- **Not in scope**: serving `/media/` in a deployment, which is broken for a
  different reason — Django only serves it when `DEBUG` is on — and is recorded
  in the archived `production-helm-chart` design as its own decision.
