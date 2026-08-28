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
# against the same cluster. The mapping is derived by scripts/worktree-env.sh
# and read from here rather than recomputed, so Tilt and anything else that
# needs to know where a worktree lives cannot disagree.

# Pinned once, read by both local development and CI. The spike in this change
# verified these versions work together on kind.
CALICO_VERSION = "v3.32.1"
CNPG_CHART = "cnpg/cloudnative-pg"

# --- Worktree identity --------------------------------------------------------
def _wt(field):
    return str(local("./scripts/worktree-env.sh %s" % field, quiet=True, echo_off=True)).strip()

SLUG = _wt("slug")
NAMESPACE = _wt("namespace")
PORT = int(_wt("port"))

print("Worktree slug=%s namespace=%s gateway=http://localhost:%d" % (SLUG, NAMESPACE, PORT))

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
    local("kubectl apply --server-side -f https://raw.githubusercontent.com/projectcalico/calico/%s/manifests/tigera-operator.yaml" % CALICO_VERSION)
    # The CRDs land with the operator, but a client that has already cached
    # discovery will not see them: applying the Installation in the same breath
    # fails with `no matches for kind "Installation"`. Wait for the CRD itself.
    local("kubectl wait --for=condition=Established --timeout=120s crd/installations.operator.tigera.io")

if _missing("kubectl get installation default --ignore-not-found -o name"):
    print("Installing Calico's CNI ...")
    local("kubectl apply -f k8s/calico-installation.yaml")
    local("kubectl wait --for=condition=Available --timeout=600s tigerastatus/calico")

if _missing("kubectl get gatewayapi default --ignore-not-found -o name"):
    print("Enabling the Calico Gateway API ...")
    local("kubectl apply -f k8s/calico-gatewayapi.yaml")
    local("kubectl wait --for=condition=Accepted --timeout=600s gatewayclass/tigera-gateway-class")

if _missing("kubectl get crd clusters.postgresql.cnpg.io --ignore-not-found -o name"):
    print("Installing CloudNativePG ...")
    local("helm repo add cnpg https://cloudnative-pg.github.io/charts && helm repo update cnpg", quiet=True)
    local("helm upgrade --install cnpg %s --namespace cnpg-system --create-namespace --wait --timeout 6m" % CNPG_CHART)

# The shared media directory is written by a non-root container. Under a
# rootless container runtime the container's user maps to an unprivileged subuid
# that owns nothing on the host, so without this the first ingestion fails with
# a permission error. Recursive, because the subdirectories Django creates under
# it (media/clips) are owned by that subuid too: without the sweep a developer
# cannot delete their own ingested clips without root. Dev-only, on a dev-only
# directory, and cheap enough to redo on every `tilt up`.
local("mkdir -p data/media && chmod -R a+rwX data/media", quiet=True)

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
# One .env, read by the cluster through this ConfigMap and by any management
# command run on the host. A new checkout gets a working one by copying the
# example, which carries no secret.
if not os.path.exists(".env"):
    local("cp .env.example .env")

def env_configmap(name, path):
    """A ConfigMap from a dotenv file, without pulling in an extension.

    The namespace is set explicitly. This object is built here rather than
    passed through the kustomize overlay, so nothing else would put it in the
    worktree's namespace — and a backend in `typelearn-<slug>` looking for a
    ConfigMap that landed in `default` fails with CreateContainerConfigError.
    """
    data = {}
    for line in str(read_file(path)).split("\n"):
        line = line.strip()
        if line == "" or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return encode_yaml({
        "apiVersion": "v1",
        "kind": "ConfigMap",
        "metadata": {"name": name, "namespace": NAMESPACE},
        "data": data,
    })

# --- The stack ----------------------------------------------------------------
# The namespace is applied through a generated kustomize overlay rather than a
# Tilt extension, so bringing the stack up needs nothing fetched from the network.
watch_file("k8s")
local("mkdir -p .tilt/overlay", quiet=True)
local("""cat > .tilt/overlay/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: %s
resources:
  - ../../k8s/base
EOF""" % NAMESPACE, quiet=True)

if NAMESPACE != "default":
    k8s_yaml(encode_yaml({
        "apiVersion": "v1",
        "kind": "Namespace",
        "metadata": {"name": NAMESPACE},
    }))

# The manifests carry placeholders for the three values only this worktree knows.
manifests = str(kustomize(".tilt/overlay"))
manifests = manifests.replace("WORKTREE_NAMESPACE", NAMESPACE)
manifests = manifests.replace("WORKTREE_SLUG", SLUG)
manifests = manifests.replace("GATEWAY_PORT", '"%d"' % PORT)
k8s_yaml(blob(manifests))
k8s_yaml(env_configmap("backend-env", ".env"))

# --- Resources ----------------------------------------------------------------
k8s_resource(
    new_name="postgres",
    objects=["postgres:cluster"],
    labels=["data"],
)
k8s_resource(
    "backend",
    objects=["backend-env:configmap", "media-%s:persistentvolume" % SLUG, "media:persistentvolumeclaim"],
    resource_deps=["postgres"],
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
    argv=["sh", "-c", """
        kubectl delete job ingest -n %s --ignore-not-found
        sed -e 's/WORKTREE_NAMESPACE/%s/' k8s/ingest-job.yaml | kubectl apply -n %s -f -
        kubectl wait --for=condition=Ready pod -l job-name=ingest -n %s --timeout=120s || true
        kubectl logs -n %s -f job/ingest
    """ % (NAMESPACE, NAMESPACE, NAMESPACE, NAMESPACE, NAMESPACE)],
)
