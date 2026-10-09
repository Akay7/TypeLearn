// A path, never a URL. The application is served from one origin in every
// environment — behind the Gateway in the cluster and in a deployment, and
// behind the dev server's proxy when the frontend runs on the host — so the
// backend is always reachable at a path on the current origin. An absolute URL
// here would be a second origin, and the backend carries no CORS configuration
// to make one work.
export const API_URL = import.meta.env.VITE_API_URL ?? '/graphql/'

/**
 * A request the API refused. `code` is the machine-readable reason the schema
 * attaches to a refusal (`RATE_LIMITED`, `BLANK`, …), or null for a failure
 * that carries none — a server error, a malformed query.
 */
export class GraphQLRequestError extends Error {
  constructor(message, code = null) {
    super(message)
    this.name = 'GraphQLRequestError'
    this.code = code
  }
}

/**
 * POST one document and return its `data`. A refusal from the API or a non-2xx
 * answer throws a GraphQLRequestError; a request that never got an answer
 * throws whatever `fetch` threw, untouched.
 */
export async function graphql(query, variables = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new GraphQLRequestError(`The backend responded ${response.status}`)
  }

  const body = await response.json()

  // A GraphQL error arrives as HTTP 200 with an `errors` array, so checking
  // response.ok alone would report success on a broken query.
  if (body.errors?.length) {
    const [first] = body.errors
    throw new GraphQLRequestError(first.message, first.extensions?.code ?? null)
  }

  return body.data
}
