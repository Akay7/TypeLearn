## Why

A learner types a phrase they hear and see, but nothing tells them what it
means. Typing a sentence you do not understand builds finger memory for the
script but no vocabulary. A translation into the learner's own language would
connect the two. Some learners want to work from sound and script alone, so the
translation has to be something they turn on, not something always shown.

Common Voice has no translations, so the first ones have to be generated. A
machine translation of a short, contextless sentence is often slightly or badly
wrong. The people best placed to notice that are the learners reading it. They
should be able to say so and suggest something better. That turns the catalog's
translations into something that improves with use rather than a one-off import.

## What Changes

- New `Translation` data: for each exercise, zero or more translations per
  target language. Each one records its origin (machine or learner-proposed) and
  its moderation state (published, pending, rejected).
- Machine translations are committed as a YAML fixture,
  `src/backend/exercises/fixtures/translations/<source>.yaml`, with one entry per
  sentence holding each target language. Entries are keyed by sentence text and
  corpus sentence id, not by database id. The file is produced once, on a
  developer's machine, and then shipped in the image and reused by every
  worktree, database rebuild and deployment, so the provider is never paid twice
  for the same sentence. No provider key exists anywhere but in that shell.
- New management command `translate_catalog` that reads the sentences ingestion
  selects straight from the Common Voice release (no database needed) and
  batch-translates them into the supported interface languages through a
  pluggable machine-translation provider, filling in the fixture. It is
  idempotent and resumable from the file itself, and it is never called while
  serving a request. A provider that makes no network calls is used in tests,
  and it writes only to an explicit scratch directory.
- New management command `load_translations` that imports the fixture into the
  database as published machine translations. The ingest Job runs it after
  `load_corpus`, so a fresh catalog comes back with its translations.
- The GraphQL `Exercise` type gains `translation(language: String!)`, which
  returns the translation currently shown for that language, or null.
- The first GraphQL mutations:
  - `rateTranslation`: rate the shown translation up or down. There is one
    rating per browser per translation, and re-rating replaces the earlier one.
  - `proposeTranslation`: suggest a better translation, or one where none exists.
    Suggestions wait for moderation and are not shown until approved.

  Both are anonymous. They are identified by a random per-browser client id,
  rate-limited, and length-validated.
- Moderation in Django admin: approve or reject pending suggestions. An
  approved suggestion becomes a published translation.
- Frontend: a "Show translation" setting, off by default. When it is on, the
  exercise shows the translation in the interface language beneath the Thai
  sentence, with up/down rating controls and a "Suggest a better translation"
  form. No translation is shown when the interface language is the exercise's
  own language.
- New interface strings are added to `en.json`, and the other locales fall back
  to them until they are translated.

## Capabilities

### New Capabilities
- `phrase-translation`: showing an exercise's translation in the learner's
  language behind an opt-in setting, rating it, and proposing a better one,
  including how the shown translation is chosen and how suggestions are
  moderated.
- `translation-generation`: batch machine translation of the corpus's selected
  sentences into a committed fixture, loading it into the catalog, a pluggable
  provider, and idempotency.

### Modified Capabilities
- `exercise-api`: the published schema gains the `translation` field on
  `Exercise` and the first mutations (`rateTranslation`, `proposeTranslation`),
  and the rules for anonymous writes (client id, limits, CSRF stance).
- `interface-localization`: the requirement that the interface language does not
  touch exercise content is narrowed. The target sentence and audio remain
  unaffected, but the optional translation follows the interface language.

## Impact

- **Backend**: `exercises/models.py` (new `Translation` and `TranslationRating`
  models plus a migration), `exercises/schema.py` (new field, mutations, and a
  schema docstring that no longer claims "no mutations"), `exercises/admin.py`
  (moderation), new `translate_catalog` and `load_translations` commands (the
  latter also run by the ingest Job), a provider module, the fixture module, and
  new settings (source language, rate limits). New dependencies: PyYAML at
  runtime, and the Anthropic Python SDK in the dev group only, since only a
  developer's machine translates.
- **`typelearn/urls.py`**: the `csrf_exempt` comment has to be resolved now that
  mutations exist. The design keeps the exemption on the grounds that the API
  carries no ambient credentials, and the comment is rewritten to say so.
- **Chart**: `load_translations` in the ingest Job, and `TRUSTED_PROXY_COUNT`.
  No translate Job and no provider key.
- **Repository**: the fixture, about 10 MB for the full Thai catalog in five
  languages. Common Voice sentence text is CC0.
- **Frontend**: `stores/settings.js` (new persisted setting), `stores/exercise.js`
  (fetch the translation with the deck and send mutations), `SentenceView.vue` or
  a new `TranslationPanel.vue`, `SettingsMenu.vue`, a client-id helper, and
  `locales/en.json`.
- **Docs**: `docs/development.md` (running the translation once) and
  `docs/deployment.md` (where the translations come from), plus a decision-log
  entry in `specs/roadmap.md`.
- **Cost**: translating about 21k sentences into 5 languages is a one-time
  batch spend on the provider. Because the result is committed, it stays
  one-time across rebuilds, worktrees, deployments, and re-ingestion.
