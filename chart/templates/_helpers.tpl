{{/*
Naming.

Resources are named for what they are — `backend`, `frontend`, `postgres`,
`media` — rather than prefixed with the release name. One release per namespace
is the model: development gives each worktree its own namespace, and a
deployment gives each environment one. Fixed names keep the label selectors, the
CNPG-generated secret (`postgres-app`), and the Tiltfile's resource wiring
stable, and they let this chart's output be diffed against the manifests it
replaced. Two releases in one namespace would collide; use two namespaces.
*/}}

{{- define "typelearn.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "typelearn.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Labels carried by every object. The selector labels below are deliberately NOT
part of this set: a Deployment's selector is immutable, so anything that changes
between releases — the chart version, the app version — must stay out of it.
*/}}
{{- define "typelearn.labels" -}}
helm.sh/chart: {{ include "typelearn.chart" . }}
app.kubernetes.io/name: {{ include "typelearn.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels for one component. `app: <component>` is what the manifests this
chart replaced used, and what the Tiltfile's buttons and the port-forward select
on, so it is kept exactly.
Usage: include "typelearn.selectorLabels" (dict "component" "backend")
*/}}
{{- define "typelearn.selectorLabels" -}}
app: {{ .component }}
{{- end -}}

{{/*
Image references. An empty tag means the chart's appVersion, so an install that
names no tags is still pinned rather than floating on `latest`.
*/}}
{{- define "typelearn.backendImage" -}}
{{- printf "%s:%s" .Values.image.backend.repository (.Values.image.backend.tag | default .Chart.AppVersion) -}}
{{- end -}}

{{- define "typelearn.frontendImage" -}}
{{- printf "%s:%s" .Values.image.frontend.repository (.Values.image.frontend.tag | default .Chart.AppVersion) -}}
{{- end -}}

{{/*
Which Secret the backend reads, if any.

Three outcomes, and the empty one matters: with no secrets supplied and no
existing Secret named, this renders nothing and the backend gets no secretRef at
all — an envFrom pointing at a Secret that does not exist would leave the pod
stuck in CreateContainerConfigError.
*/}}
{{- define "typelearn.secretName" -}}
{{- if .Values.existingSecret -}}
{{- .Values.existingSecret -}}
{{- else if .Values.secrets -}}
{{- printf "backend-secrets" -}}
{{- end -}}
{{- end -}}

{{/*
Where the backend reads its configuration and secrets from.
*/}}
{{- define "typelearn.envFrom" -}}
- configMapRef:
    name: backend-env
{{- with (include "typelearn.secretName" .) }}
- secretRef:
    name: {{ . }}
{{- end }}
{{- end -}}

{{/*
The database, as five environment variables.

Never a wholesale envFrom of the database Secret: CNPG writes its keys in
lowercase, so pulling it in whole would put a bare `host`, `port`, and `user`
into the process environment, and Django reads none of those. The password is a
secretKeyRef in both branches — it is never a value, and never in the ConfigMap.
*/}}
{{- define "typelearn.databaseEnv" -}}
{{- if .Values.postgres.enabled }}
- name: POSTGRES_DB
  valueFrom:
    secretKeyRef: {name: postgres-app, key: dbname}
- name: POSTGRES_USER
  valueFrom:
    secretKeyRef: {name: postgres-app, key: username}
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef: {name: postgres-app, key: password}
- name: POSTGRES_HOST
  valueFrom:
    secretKeyRef: {name: postgres-app, key: host}
- name: POSTGRES_PORT
  valueFrom:
    secretKeyRef: {name: postgres-app, key: port}
{{- else }}
- name: POSTGRES_DB
  value: {{ .Values.externalDatabase.database | quote }}
- name: POSTGRES_USER
  value: {{ .Values.externalDatabase.user | quote }}
- name: POSTGRES_HOST
  value: {{ required "postgres.enabled is false, so externalDatabase.host must be set" .Values.externalDatabase.host | quote }}
- name: POSTGRES_PORT
  value: {{ .Values.externalDatabase.port | quote }}
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ required "postgres.enabled is false, so externalDatabase.existingSecret must name a Secret holding the password" .Values.externalDatabase.existingSecret }}
      key: {{ .Values.externalDatabase.passwordKey }}
{{- end }}
{{- end -}}

{{/*
The media volume, mounted the same way by every pod that touches clips.
*/}}
{{- define "typelearn.mediaVolume" -}}
- name: media
  persistentVolumeClaim:
    claimName: media
{{- end -}}

{{/*
A prerequisite this chart refuses to install. Fails with a named error naming
what is missing and what provides it.
Usage: include "typelearn.requireAPI" (dict "root" $ "api" "…" "what" "…" "from" "…")
*/}}
{{- define "typelearn.requireAPI" -}}
{{- if .root.Values.prerequisiteChecks -}}
{{- if not (.root.Capabilities.APIVersions.Has .api) -}}
{{- fail (printf "%s is not available in this cluster (no %s). This chart does not install it \u2014 it is cluster-scoped and shared by every release, so an application chart that installed it would fight every other one that did. Install it first: %s. (Rendering offline? pass --api-versions %s, or set prerequisiteChecks=false.)" .what .api .from .api) -}}
{{- end -}}
{{- end -}}
{{- end -}}
