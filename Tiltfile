# Local development: the whole stack, in a kind cluster, on one origin.
#
#   kind create cluster --config k8s/kind.yaml   # once per machine
#   tilt up                                      # per checkout
#
# The application is served at http://localhost:<port>, where <port> is 8500 for
# the main checkout and 8500+offset for a linked worktree. Everything — the SPA,
# the GraphQL endpoint, and the audio — comes through that one origin, which is
# why the backend carries no CORS configuration at all.
#
# --- Parallel worktrees -------------------------------------------------------
# Each git worktree runs its own stack, in its own namespace, on its own port,
# with its own Tilt UI on 10350+offset, against the same cluster. The mapping is
# derived by scripts/worktree-env.sh and read from here rather than recomputed,
# so Tilt and anything else that needs to know where a worktree lives cannot
# disagree. Tilt's own port is set from .envrc (TILT_PORT), because Tilt binds
# its web server before this file is evaluated.

# Pinned once, read by both local development and CI. The spike in this change
# verified these versions work together on kind.
CALICO_VERSION = "v3.32.1"
CNPG_CHART = "cnpg/cloudnative-pg"

# --- The container runtime, on both sides ------------------------------------
# Tilt builds images with whatever DOCKER_HOST points at, and kind loads them
# into the cluster with whatever KIND_EXPERIMENTAL_PROVIDER names. When those
# two disagree, the build succeeds, the load quietly finds nothing, and the
# cluster falls back to pulling `typelearn-backend` from Docker Hub — an
# ImagePullBackOff that says nothing about the cause. So say it here instead.
#
# See the README for the exports each runtime needs.
_provider = os.getenv("KIND_EXPERIMENTAL_PROVIDER", "docker")
_docker_host = os.getenv("DOCKER_HOST", "")
_builder_is_podman = "podman" in _docker_host

if _provider == "podman" and not _builder_is_podman:
    fail("kind is set to use podman (KIND_EXPERIMENTAL_PROVIDER=podman) but Tilt " +
         "builds through " + (_docker_host if _docker_host else "the docker daemon") +
         ", so images would never reach the cluster. Either export DOCKER_HOST to " +
         "podman's socket, or unset KIND_EXPERIMENTAL_PROVIDER to use docker for both. " +
         "See the README.")

if _provider != "podman" and _builder_is_podman:
    fail("Tilt builds through podman (DOCKER_HOST=" + _docker_host + ") but kind is " +
         "set to use " + _provider + ", so images would never reach the cluster. " +
         "Export KIND_EXPERIMENTAL_PROVIDER=podman to match. See the README.")

# --- The cluster this deploys into --------------------------------------------
# Tilt refuses remote clusters on its own, but every kind cluster on this machine
# looks equally local to it — so with another project's cluster selected, `tilt
# up` here would cheerfully deploy this stack into it, create a namespace, and
# leave a CNPG cluster behind. The runtime guard above exists for the same class
# of mistake: something that is quietly wrong rather than loudly broken.
ALLOWED_CONTEXT = os.getenv("TYPELEARN_KUBE_CONTEXT", "kind-typelearn")

if k8s_context() != ALLOWED_CONTEXT:
    fail("kubectl is pointed at '" + k8s_context() + "', not '" + ALLOWED_CONTEXT + "'. " +
         "This would deploy TypeLearn into that cluster. Run " +
         "`kubectl config use-context " + ALLOWED_CONTEXT + "`, or set TYPELEARN_KUBE_CONTEXT " +
         "if this project's cluster is named differently.")

# --- Worktree identity --------------------------------------------------------
def _wt(field):
    return str(local("./scripts/worktree-env.sh %s" % field, quiet=True, echo_off=True)).strip()

SLUG = _wt("slug")
NAMESPACE = _wt("namespace")
PORT = int(_wt("port"))
OFFSET = int(_wt("offset"))

# --- Debugging the backend ----------------------------------------------------
# The debugger attaches to the container, not to a copy of the application on the
# host. That is the whole point: the thing being stepped through is the image a
# deployment runs, with its environment, its database and the Gateway in front of
# it — nothing is reconstructed on a developer's machine, so nothing about the
# reconstruction can differ.
#
# TYPELEARN_DEBUG_BACKEND=1, most usefully in .envrc.local. The port moves per
# worktree like every other one, so two checkouts can each have a debugger
# attached. The stack comes up either way: nothing waits for a client.
DEBUG_BACKEND = os.getenv("TYPELEARN_DEBUG_BACKEND", "") not in ("", "0", "false")
DEBUG_PORT = int(os.getenv("TYPELEARN_DEBUG_PORT", str(5678 + OFFSET)))
# What .envrc should have put on TILT_PORT — reported so a mismatch (direnv not
# allowed, a stale shell) is visible rather than surfacing as a port collision.
TILT_PORT = _wt("tilt-port")

print("Worktree slug=%s namespace=%s gateway=http://localhost:%d tilt=http://localhost:%s" % (SLUG, NAMESPACE, PORT, TILT_PORT))

# --- Cluster-scoped bootstrap, shared by every worktree -----------------------
# Installed only when missing, and never handed to Tilt: if Tilt owned these, a
# force-update would delete them, and every other worktree's stack would go with
# them. `kubectl apply` and `helm upgrade --install` are idempotent, so a version
# change still takes effect on the next `tilt up` without deleting a live object.

def _missing(query):
    return str(local(query, quiet=True, echo_off=True)).strip() == ""

# Each step is gated on the thing that step creates, never on something an
# earlier step happens to leave behind. Gating the Installation on its CRD looks
# equivalent and is not: the CRD arrives with the operator manifest, so an
# interrupted first run leaves the CRD present and every later run then skips
# applying the Installation — no CNI, every node NotReady, and every pod Pending
# behind a bootstrap that believes it already ran.
if _missing("kubectl get crd installations.operator.tigera.io --ignore-not-found -o name"):
    print("Installing the Tigera Operator (Calico %s) ..." % CALICO_VERSION)
    # Two manifests, and the order matters. Calico stopped shipping its CRDs
    # inside tigera-operator.yaml — at v3.32 that file defines none of them and
    # operator-crds.yaml defines all 32 — so applying only the operator leaves a
    # cluster with a Deployment and no `Installation` kind to give it. The next
    # line then fails with a bare NotFound, because `kubectl wait` errors on a
    # resource that does not exist rather than waiting for one to appear.
    #
    # This is invisible on an established cluster: the gate above skips the whole
    # block once the CRD is there, so only a fresh cluster — CI's, or a
    # developer's first run — ever executes it.
    local("kubectl apply --server-side -f https://raw.githubusercontent.com/projectcalico/calico/%s/manifests/operator-crds.yaml" % CALICO_VERSION)
    local("kubectl apply --server-side -f https://raw.githubusercontent.com/projectcalico/calico/%s/manifests/tigera-operator.yaml" % CALICO_VERSION)
    # A client that has already cached discovery will not see a new CRD:
    # applying the Installation in the same breath fails with `no matches for
    # kind "Installation"`. Wait for the CRD itself.
    local("kubectl wait --for=condition=Established --timeout=120s crd/installations.operator.tigera.io")

# Each of these waits twice, and the first wait is the one that is easy to leave
# out. `kubectl wait` errors immediately on a resource that does not exist rather
# than waiting for one to appear, and both objects below are created by the
# operator *after* it notices what was just applied — so waiting straight for the
# condition is a race against the operator's reconcile loop, lost with a bare
# NotFound that names the object and not the reason.
if _missing("kubectl get installation default --ignore-not-found -o name"):
    print("Installing Calico's CNI ...")
    local("kubectl apply -f k8s/calico-installation.yaml")
    local("kubectl wait --for=create --timeout=120s tigerastatus/calico")
    local("kubectl wait --for=condition=Available --timeout=600s tigerastatus/calico")

if _missing("kubectl get gatewayapi default --ignore-not-found -o name"):
    print("Enabling the Calico Gateway API ...")
    local("kubectl apply -f k8s/calico-gatewayapi.yaml")
    # Three waits, because three things have to arrive in order and none of them
    # is instant. Enabling Gateway API makes the operator install the Gateway API
    # CRDs, so at first the *type* does not exist — and kubectl fails discovery
    # ("the server doesn't have a resource type") rather than waiting, which
    # `--for=create` cannot rescue: it waits for an object of a type that is
    # already known. So wait for the CRD, then for the object, then for it to be
    # accepted.
    local("kubectl wait --for=create --timeout=300s crd/gatewayclasses.gateway.networking.k8s.io")
    local("kubectl wait --for=condition=Established --timeout=300s crd/gatewayclasses.gateway.networking.k8s.io")
    local("kubectl wait --for=create --timeout=300s gatewayclass/tigera-gateway-class")
    local("kubectl wait --for=condition=Accepted --timeout=600s gatewayclass/tigera-gateway-class")

if _missing("kubectl get crd clusters.postgresql.cnpg.io --ignore-not-found -o name"):
    print("Installing CloudNativePG ...")
    local("helm repo add cnpg https://cloudnative-pg.github.io/charts && helm repo update cnpg", quiet=True)
    local("helm upgrade --install cnpg %s --namespace cnpg-system --create-namespace --wait --timeout 6m" % CNPG_CHART)

# The shared media directory is written by a non-root container. Under a
# rootless container runtime that container's user maps to an unprivileged subuid
# which owns nothing on the host, so a directory it creates belongs to that
# subuid — and `chmod` needs ownership, not write permission on the parent, so
# the developer cannot chmod it afterwards, cannot delete what is inside it, and
# a recursive sweep here would simply fail.
#
# So create the directory Django writes into *before* the container can: made
# here it is owned by the developer, and world-writable so the container's user
# can still write into it. `clips` is where `Exercise.original_audio` lands
# (`upload_to='clips/'`); if that ever changes, this needs to change with it.
#
# `|| true` because a directory an older run already left behind may still be
# owned by the container's subuid, and failing the whole Tiltfile over a
# permission bit on a dev-only directory helps nobody.
local("mkdir -p data/media/clips && chmod 0777 data/media data/media/clips || true", quiet=True)

# --- Images -------------------------------------------------------------------
# CI builds the images once, loads them into its cluster, and runs `tilt ci` with
# CI_PREBUILT=1. Tilt only manages images it declares, so in that mode the
# undeclared refs deploy verbatim from what the cluster already has — the exact
# artifact CI tested, with no rebuild between testing and running.
CI_PREBUILT = os.getenv("CI_PREBUILT", "")

if not CI_PREBUILT:
    docker_build(
        "typelearn-backend",
        context="./src/backend",
        dockerfile="./src/backend/Containerfile",
        # The dev stage carries the test dependencies, so the "Run backend
        # tests" button has a pytest to run. The prod overlay uses `runtime`.
        target="dev",
        live_update=[
            sync("./src/backend", "/app"),
            # The initContainer only runs at pod start, so a new migration would
            # otherwise sit unapplied until the pod restarted.
            run("python manage.py migrate --noinput", trigger=["./src/backend/**/migrations/*.py"]),
        ],
    )

    docker_build(
        "typelearn-frontend",
        context="./src/frontend",
        dockerfile="./src/frontend/Containerfile",
        target="build",
        live_update=[
            # A dependency change is not something a sync can express, so it
            # falls back to a full rebuild. Tilt requires this to be the first
            # step: it is a guard on the steps below, not one of them.
            fall_back_on(["./src/frontend/package.json", "./src/frontend/package-lock.json"]),
            # Vite's own HMR takes it from here: the file lands in the container
            # and the browser updates without a pod restart or a page reload.
            sync("./src/frontend/src", "/app/src"),
            sync("./src/frontend/index.html", "/app/index.html"),
            sync("./src/frontend/vite.config.js", "/app/vite.config.js"),
        ],
    )

# --- Configuration ------------------------------------------------------------
# One .env, read by the cluster and by any management command run on the host. A
# new checkout gets a working one by copying the example, which carries no
# secret. The chart's values are generated from it below rather than written by
# hand, so .env stays the single file a developer edits.
if not os.path.exists(".env"):
    local("cp .env.example .env")

# A setting whose name ends one of these ways is a secret: it goes into the
# chart's `secrets` map, and so into a Secret, never into the ConfigMap. A suffix
# rule rather than a hand-kept list, so a setting added tomorrow is classified
# the moment it is named.
SECRET_SUFFIXES = ["_SECRET_KEY", "_PASSWORD", "_TOKEN", "_SECRET"]

def read_dotenv(path):
    """Split a dotenv file into (configuration, secrets)."""
    env = {}
    secrets = {}
    for line in str(read_file(path)).split("\n"):
        line = line.strip()
        if line == "" or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        is_secret = False
        for suffix in SECRET_SUFFIXES:
            if key.endswith(suffix):
                is_secret = True
        if is_secret:
            secrets[key] = value.strip()
        else:
            env[key] = value.strip()
    return env, secrets

ENV, SECRETS = read_dotenv(".env")

# --- The stack ----------------------------------------------------------------
# One chart, rendered here with development values and by a deployment with its
# own. The templates a developer exercises every day are the templates a
# deployment installs — which is the property this whole arrangement exists for.
#
# Note what is no longer here: the three placeholders the kustomize output used
# to have rewritten into it by string replacement. They are values now, so the
# class of bug where a renderer stripped the quotes from a port and Kubernetes
# rejected a number is not fixed but impossible.
DEV_VALUES = {
    # Tilt rewrites these refs to the images it just built. The tags matter only
    # in CI_PREBUILT mode, where Tilt rewrites nothing and the cluster must
    # already hold exactly these names.
    "image": {
        "backend": {"repository": "typelearn-backend", "tag": "latest"},
        "frontend": {"repository": "typelearn-frontend", "tag": "latest"},
    },
    "backend": {
        # --reload so Tilt's synced source takes effect without a pod restart.
        # A deployment sets no command and gets the image's own.
        "command": ["gunicorn", "typelearn.wsgi:application", "--bind", "0.0.0.0:8000", "--reload"],
        # Under a debugger the chart ignores the command above and runs Django's
        # own server single-process instead; see chart/values.yaml for why.
        "debug": {"enabled": DEBUG_BACKEND, "port": 5678},
    },
    # The dev server, and the port the browser really reaches the Gateway on so
    # Vite's HMR websocket connects.
    "frontend": {"mode": "dev", "hmrClientPort": str(PORT)},
    # pytest-django creates and drops its own test database on every run.
    "postgres": {"allowCreateDatabase": True},
    # The node path kind mounts the host's media directory onto, shared by every
    # worktree so the corpus is ingested once rather than per checkout.
    "media": {"hostPath": "/media"},
    "worktree": {"slug": SLUG},
    # The bootstrap above installs every prerequisite and waits for it, so the
    # chart's check has nothing left to catch here — and `helm template`, which
    # is what Tilt runs, cannot see the cluster's APIs to satisfy it anyway.
    "prerequisiteChecks": False,
    "env": ENV,
    "secrets": SECRETS,
}

# The chart is the stack; k8s/ is what the cluster needs before the stack, and a
# version bump in either should reload this file.
watch_file("chart")
watch_file("k8s")
local("mkdir -p .tilt", quiet=True)
local("cat > .tilt/values-dev.yaml <<'TILT_VALUES_EOF'\n%s\nTILT_VALUES_EOF" % str(encode_yaml(DEV_VALUES)), quiet=True)

if NAMESPACE != "default":
    k8s_yaml(encode_yaml({
        "apiVersion": "v1",
        "kind": "Namespace",
        "metadata": {"name": NAMESPACE},
    }))

k8s_yaml(helm("chart", name="typelearn", namespace=NAMESPACE, values=[".tilt/values-dev.yaml"]))

# --- Resources ----------------------------------------------------------------
k8s_resource(
    new_name="postgres",
    objects=["postgres:cluster"],
    labels=["data"],
)
# The Secret is listed only when .env actually holds one: naming an object the
# chart did not render fails the Tiltfile rather than being ignored.
BACKEND_OBJECTS = ["backend-env:configmap", "media-%s:persistentvolume" % SLUG, "media:persistentvolumeclaim"]
if SECRETS:
    BACKEND_OBJECTS.append("backend-secrets:secret")

k8s_resource(
    "backend",
    objects=BACKEND_OBJECTS,
    resource_deps=["postgres"],
    port_forwards=[port_forward(DEBUG_PORT, 5678, name="debug")] if DEBUG_BACKEND else [],
    labels=["app"],
)
k8s_resource("frontend", labels=["app"])
k8s_resource(
    new_name="networking",
    objects=["typelearn-gateway:gateway", "typelearn:httproute"],
    labels=["gateway"],
)
if NAMESPACE != "default":
    k8s_resource(new_name="namespace", objects=["%s:namespace" % NAMESPACE], labels=["setup"])

# --- Reaching the stack -------------------------------------------------------
# The Envoy Service is created by the controller in the tigera-gateway namespace,
# named after the Gateway it belongs to. Forward the one owned by THIS worktree.
#
# Note what is deliberately not waited for: the Gateway never reports
# Programmed=True on kind, because its Service is a LoadBalancer and kind has no
# controller to assign an address. The data path works regardless, so gating on
# that condition would hang forever.
local_resource(
    "gateway-forward",
    serve_cmd="""
        for i in $(seq 1 60); do
          SVC=$(kubectl get svc -n tigera-gateway \
            -l gateway.envoyproxy.io/owning-gateway-name=typelearn-gateway,gateway.envoyproxy.io/owning-gateway-namespace=%s \
            -o jsonpath='{.items[0].metadata.name}' --ignore-not-found 2>/dev/null)
          [ -n "$SVC" ] && break
          echo "waiting for the Envoy service ($i)..."; sleep 3
        done
        kubectl port-forward -n tigera-gateway "svc/$SVC" %d:80
    """ % (NAMESPACE, PORT),
    resource_deps=["backend", "frontend"],
    links=[link("http://localhost:%d" % PORT, "TypeLearn")],
    labels=["gateway"],
)

# --- Buttons ------------------------------------------------------------------
# No database port is exposed, so a management command runs in the pod. These are
# the supported way to do that.
def in_backend_pod(script):
    return [
        "sh", "-c",
        """
        POD=$(kubectl get pod -n %s -l app=backend -o jsonpath='{.items[0].metadata.name}')
        %s
        """ % (NAMESPACE, script),
    ]

load("ext://uibutton", "cmd_button")

cmd_button(
    "backend:migrate",
    resource="backend",
    text="Apply migrations",
    icon_name="storage",
    argv=in_backend_pod('kubectl exec -n %s "$POD" -- python manage.py migrate --noinput' % NAMESPACE),
)

cmd_button(
    "backend:pytest",
    resource="backend",
    text="Run backend tests",
    icon_name="science",
    argv=in_backend_pod('kubectl exec -n %s "$POD" -- pytest' % NAMESPACE),
)

# Ingestion reads the corpus mounted by k8s/kind.yaml and writes the selected
# clips into the shared media volume. Minutes long and only needed when the
# catalog is empty, so it is a button rather than part of coming up. Confirmation
# because it is long and writes into storage every worktree reads.
cmd_button(
    "backend:ingest",
    resource="backend",
    text="Ingest the corpus",
    icon_name="library_music",
    requires_confirmation=True,
    # Rendered from the same chart as everything else — one description of the
    # Job, not a second copy that drifts. It is applied straight to the cluster
    # rather than handed to Tilt or to Helm: Tilt would treat it as part of the
    # stack and re-run it on every change, and a Job's spec is immutable, so a
    # `helm upgrade` carrying one fails the moment it already exists.
    #
    # The image comes from the running Deployment, because that ref is
    # guaranteed present in the cluster: Tilt has already rewritten it to the tag
    # it built, and in CI_PREBUILT mode it is whatever CI loaded.
    # Built with .replace() rather than %-formatting: the script needs shell
    # parameter expansions like ${IMAGE%%:*}, and Starlark's % operator would eat
    # them on the way through.
    argv=["sh", "-c", """
        set -e
        IMAGE=$(kubectl get deployment backend -n NS -o jsonpath='{.spec.template.spec.containers[0].image}')
        case "$IMAGE" in
          *:*) REPO="${IMAGE%%:*}"; TAG="${IMAGE##*:}" ;;
          *)   REPO="$IMAGE";       TAG="latest" ;;
        esac
        kubectl delete job ingest -n NS --ignore-not-found
        helm template typelearn chart --namespace NS \
          --values .tilt/values-dev.yaml \
          --set ingest.enabled=true \
          --set ingest.corpusHostPath=/corpus \
          --set-string image.backend.repository="$REPO" \
          --set-string image.backend.tag="$TAG" \
          --show-only templates/ingest-job.yaml | kubectl apply -n NS -f -
        kubectl wait --for=condition=Ready pod -l job-name=ingest -n NS --timeout=120s || true
        kubectl logs -n NS -f job/ingest
    """.replace("NS", NAMESPACE)],
)
