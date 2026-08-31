## MODIFIED Requirements

### Requirement: Parallel worktrees run side by side
Several git worktrees of this repository SHALL be able to run their stacks at the
same time against one cluster, without any of them being edited to avoid a
collision. Each worktree's identity SHALL be derived automatically, and SHALL
determine the Kubernetes namespace it deploys into, the host port the
application is reached on, and the host port Tilt's own web UI listens on.

#### Scenario: The main checkout is unchanged
- **WHEN** `tilt up` runs in the main checkout
- **THEN** it deploys to the default namespace on the base host port, with Tilt's
  UI on its base port, so the common case needs no configuration

#### Scenario: A linked worktree gets its own namespace and port
- **WHEN** `tilt up` runs in a linked git worktree
- **THEN** it deploys into a namespace named for that worktree and is served on a
  host port derived from the same identity, leaving the main checkout's stack
  running and reachable

#### Scenario: Two worktrees at once
- **WHEN** two worktrees have both been brought up
- **THEN** each serves its own build of the application on its own port, backed
  by its own database, and neither can read the other's exercises

#### Scenario: Only the Gateway is exposed to the host
- **WHEN** a worktree's stack is running
- **THEN** the Gateway is the only service reachable from the host, and the
  database is reachable only from inside the cluster — every management command
  runs in a pod rather than against a forwarded port

#### Scenario: Every worktree's Tilt can attach at once
- **WHEN** two worktrees have both been brought up with `tilt up`
- **THEN** each worktree's Tilt serves its UI on its own host port, so both stay
  attached and keep syncing source into their pods, and neither `tilt up` fails
  to bind its port

#### Scenario: One definition of the mapping
- **WHEN** the namespace, the application port, or Tilt's web port for a worktree
  is needed by Tilt or by any editor task or script
- **THEN** all of them obtain it from a single shared derivation, so no two
  callers can disagree about where a worktree's stack lives

#### Scenario: The identity can be overridden
- **WHEN** a developer sets the worktree slug or port offset explicitly in the
  environment
- **THEN** that value is used instead of the derived one, so a predictable
  application port, namespace, and Tilt port can be pinned together

#### Scenario: Pinning an identity does not dirty the checkout
- **WHEN** a worktree pins its own slug or offset
- **THEN** it does so in a file git ignores, with a committed example beside it,
  so pinning never appears as a modification to configuration everyone shares
