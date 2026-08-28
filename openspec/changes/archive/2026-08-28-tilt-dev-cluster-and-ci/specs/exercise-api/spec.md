## MODIFIED Requirements

### Requirement: audioUrl is directly playable
`audioUrl` SHALL be an absolute URL — scheme, host, port, and media path — that an HTML5 `<audio>` element can load without further transformation by the client. It is built from the incoming request, so it names whatever origin the client reached the API through, and no deployment has to configure a media host separately.

#### Scenario: Playing a clip
- **WHEN** the frontend sets an `<audio>` element's `src` to an exercise's `audioUrl`
- **THEN** the clip loads and plays, with no path rewriting in the client

#### Scenario: Absolute URL in the response
- **WHEN** a client queries `{ exercises(limit: 1) { audioUrl } }`
- **THEN** the returned value begins with `http://` or `https://` and includes the host, not a bare `/media/...` path

#### Scenario: The URL names the origin the client used
- **WHEN** the API is reached through the Gateway
- **THEN** `audioUrl` carries that same origin, so the clip is fetched from where the rest of the application is served

## REMOVED Requirements

### Requirement: Cross-origin requests from the dev frontend are allowed
**Reason**: The frontend is no longer a separate origin. It is served through the same Gateway as the API, so a GraphQL query is a same-origin request and needs no CORS headers to succeed. Keeping the requirement would mandate configuration that exists only to support a topology the project no longer runs — and which no deployment would ever use.

**Migration**: Remove `django-cors-headers` from the backend's dependencies, delete `corsheaders` from `INSTALLED_APPS` and its middleware entry, and delete the `CORS_ALLOWED_ORIGINS` setting. The frontend stops pointing `VITE_API_URL` at another origin and calls the same-origin path instead. Nothing needs to replace them: the Gateway's routing is what makes the request same-origin, and that requirement now lives in `local-dev-environment`.
