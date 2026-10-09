## Context

`load_corpus` sorts every filtered candidate into a total order and stops after
`--count` distinct sentences (default 100). The chart's ingest Job runs it with no
size argument, so every environment gets 100. On `cv-corpus-25.0-2026-03-09/th`
the filters keep 21,429 distinct sentences, and removing the cap is what
production needs.

The frontend's `Catalog` query asks for `exercises` with no `limit`. The store
then drops any sentence that no keyboard can type, shuffles the rest in the
browser, and loops back to the start when it reaches the end. Everything that
hides a slow catalog fetch (the loading state, the pause before the next
exercise) assumes the fetch is small.

For the motivation, see proposal.md (Why). The requirements are in `specs/`.

## Goals / Non-Goals

**Goals:**
- Production loads every filtered sentence with one chart value. Development
  keeps 100 by doing nothing.
- The browser downloads a bounded amount of catalog, whatever the catalog size.
- The selection stays deterministic, so a count is always a prefix of `all`.

**Non-Goals:**
- Loosening or changing the filters themselves. Longer sentences would push
  difficulty past its range, and that is a separate decision.
- Getting the corpus onto a production node. The Job still mounts it through
  `ingest.corpusHostPath`, as it does today.
- Filtering the deck by difficulty, or any learner progression. `deck` takes a
  size only.
- Capping the existing `exercises` query. It remains the catalog API. With about
  21k rows it is large but bounded. See the risks below.

## Decisions

### 1. `--all` is its own flag, exclusive with `--count`

The two go in an argparse mutually exclusive group. `--count` keeps its default
of 100, and the "not enough candidates" check still applies to it. With `--all`,
the selection loop runs with no stopping count, and the command fails only when
nothing matched.

*Alternatives:* `--count 0` or `--count -1` meaning "no limit". Rejected because
a magic number reads as a mistake in a Job log. A very large `--count` would also
work, but the check would then fail because fewer candidates exist than
requested, so it would need special-casing anyway.

### 2. One chart value, `ingest.count`, which is an integer or `all`

`values.yaml` sets `ingest.count: 100`. The template maps `all` to `--all`, maps
a value that matches `^[1-9][0-9]*$` (checked on its string form, so both `100`
and `"100"` pass) to `--count N`, and calls `fail` with the value and the
accepted forms otherwise. The arguments go on the existing `sh -c` command line,
after the corpus path. `values-prod.yaml.example` sets `all` and explains what
that means in clips, disk and time. The Tilt button renders the Job from the
same chart with the default, so it keeps ingesting 100 without changes.

*Alternatives:* two values (`ingest.all: true` plus `ingest.count`) can
contradict each other and would need their own check. An environment variable
read by the command would work, but chart values are how every other
per-environment setting reaches the Job.

### 3. `deck(size: Int!)` is a new field, ordered by the database's `random()`

The resolver returns `Exercise.objects.order_by('?')[:min(size, cap)]`.
PostgreSQL executes `ORDER BY random() LIMIT n` as a top-N heap sort over the
table. At about 21k rows that takes milliseconds. `size < 1` raises a GraphQL
error. The cap is `EXERCISE_DECK_MAX_SIZE`, a setting read from the environment
with a default of 500, placed next to the existing `STRAWBERRY_MAX_*` limits and
settable from values like every other backend variable.

*Alternatives:*
- A `random` option on `ExerciseOrder`. Strawberry-django's `Ordering` is a
  direction enum (`ASC`/`DESC`), so "random" does not fit it. It would also make
  `exercises` return a different list for the same arguments, which breaks its
  cache-friendliness.
- `TABLESAMPLE`. Its sampling is by block, so on a table this small it is lumpy
  and can return fewer rows than requested.
- Choosing random ids in Python. Ids have gaps after deletions, and this needs a
  second query to find the id range, for no measurable gain at this size.

### 4. The store fetches a deck of 200 and refills when it runs out

`DECK_SIZE = 200`. The query becomes `deck(size: 200)`, and the client-side
`shuffle` goes away because the server's order is already random. The filter
for sentences no keyboard can type stays client-side, since it depends on the
layouts the page has. When `next()` moves past the last exercise, the store
requests a new deck in the background, without switching `status` to `loading`.
The exercise that was just answered, and its verdict, stay on screen until the
new deck arrives, which is usually within the 900 ms the verdict is shown
anyway. Then the new deck replaces the old one at index 0. If the request fails,
the store logs the error and loops back to the start of the deck it already has,
as it does today.

200 is large enough that a learner rarely reaches the end of a deck in one
sitting. The response is about 40 KB, compared with about 4 MB for the whole
catalog.

*Alternatives:* prefetching the next deck as the learner approaches the end.
That is more state (a pending deck, a race with `load()`) for latency the
verdict pause already hides. Paging through `exercises` with an offset over a
fixed order is not random across sessions, and every learner would start at the
same exercise.

### 5. Ingestion reports progress

A full run creates about 21k rows, one `update_or_create` each. That takes
minutes, and a Job log that stays silent for minutes looks hung. The command
writes a progress line every 1,000 exercises. The work stays a row-by-row
upsert. The run is idempotent, so a Job that dies partway through is fixed by
running it again, and bulk upserts would complicate the created/updated counts
the command reports for no benefit at this size.

## Risks / Trade-offs

- **[Risk] `exercises` with no limit still returns the whole catalog**, about
  4 MB in production. Nothing shipped calls it that way after this change, but
  any client can. → Accepted for now: it is public read-only data, the response
  is bounded by the catalog, and capping it would change a published contract.
  If it ever matters, give `exercises` the same server-side cap as `deck`.
- **[Risk] A new deck can repeat exercises from the previous one.** →
  Deliberately accepted. With 200 out of about 21k, a repeat is rare. Avoiding
  it would mean the server remembering sessions, which is out of scope. The spec
  scopes the no-repeat guarantee to a single deck.
- **[Risk] The full ingestion copies about 21k clips (roughly 0.5 GB) and runs
  for minutes.** → The Job is on-demand only (never a hook), keeps
  `backoffLimit: 0` and its log, and is idempotent. Clip copies are skipped when
  a file of the same size is already there, so a re-run mostly just touches the
  database. The example's 50Gi claim has plenty of room.
- **[Trade-off] Development never exercises the full-size catalog.** → Running
  `load_corpus --all` by hand (or setting `ingest.count=all` in `.tilt`
  overrides) still works for anyone who wants to test at scale. The docs say
  how.

## Migration Plan

1. Deploy the new backend and frontend images. `deck` is additive, so an old
   frontend keeps working against the new backend during the rollout.
2. Set `ingest.count: all` in the deployment's values, delete any finished
   `ingest` Job, and render and apply the Job as documented.
3. The 100 existing exercises are updated in place (they are a prefix of the
   full selection) and the rest are created. Nothing is deleted.

Rollback: a previous frontend image returns to the whole-catalog fetch, which
still works but is heavy. Removing exercises is not needed and not provided.
