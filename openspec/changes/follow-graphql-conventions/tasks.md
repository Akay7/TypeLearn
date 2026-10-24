## 1. Baseline

- [x] 1.1 Export the published schema (`schema.as_str()` from
      `exercises.schema`) to a scratch file before any change, and verify the
      backend suite passes against PostgreSQL 17.

## 2. Test conventions

- [x] 2.1 Restructure `exercises/tests/test_schema.py`: documents as
      constants at the top with arguments passed as variables, then helpers,
      then flat `@pytest.mark.django_db()` tests. Every response is
      inspected, `len(errors)` is asserted before an error is read, and
      shared literals are named locals. Verify the module passes unchanged in
      count.
- [x] 2.2 Restructure `exercises/tests/test_translation_schema.py` the same
      way. Setup `rate`/`propose` calls assert the state they produce, and
      `refusal_code` (was `error_code`) asserts exactly one error and no data.
      Verify the module passes.

## 3. audioUrl costs no query per row

- [x] 3.1 Red: add tests that `deck(size: 20) { id sentence audioUrl difficulty }`
      and `exercises { id audioUrl }` each run one query, and verify both
      fail with one query per row.
- [x] 3.2 Green: give `audio_url` an `only=['original_audio']` hint, and
      verify the two tests and the module pass.

## 4. deck refusal carries a code

- [x] 4.1 Red: assert `INVALID_SIZE` and exactly one error in the size-below-one
      test, and verify it fails.
- [x] 4.2 Green: refuse through `fail('INVALID_SIZE', …)`, and verify the
      test passes.

## 5. Origins come from the model

- [x] 5.1 Add a test that the published `TranslationOrigin` values are
      exactly the member names of `Translation.Origin`, and that a learner
      translation is served as `LEARNER`. Verify it passes before the change,
      as the safety net for the refactor.
- [x] 5.2 Replace the hand-written enum and resolver with
      `strawberry.enum(models.Translation.Origin, name='TranslationOrigin')`
      and a plain `origin` field, and verify the module passes.

## 6. Proposals are validated by the model

- [x] 6.1 Red: add tests that a proposal at exactly the column's length is
      accepted, and that one character over is `TOO_LONG` even when
      `TRANSLATION_MAX_LENGTH` is set above the column. Verify the second
      fails with an uncoded database error.
- [x] 6.2 Green: declare `Translation.TEXT_MAX_LENGTH = 500` and use it for
      `text`, verifying with `makemigrations --check` that no migration
      results. Validate proposals with `full_clean()`, mapping
      `blank`/`max_length`/`unique_together` to
      `BLANK`/`TOO_LONG`/`DUPLICATE` and anything else to `INVALID`. Verify
      every proposal test passes.
- [x] 6.3 Move the provider's `validated()` and `load_translations` onto
      `Translation.TEXT_MAX_LENGTH`, delete the `TRANSLATION_MAX_LENGTH`
      setting, and rewrite the tests that lowered it to patch the constant
      instead. Drop the now-meaningless setting override from 6.1's test.
      Verify with `grep -rn TRANSLATION_MAX_LENGTH src` (no hits) and the
      full suite.

## 7. Mutation and type idiom

- [x] 7.1 Make `rate_translation` atomic by decorator, use
      `@strawberry_django.mutation` for both mutations, and narrow
      `refresh_from_db` to the two count fields. Then write `X | None` for
      `Optional[X]`, pass `model=` to `strawberry_django.type`, and annotate
      `fail` as `NoReturn`. Verify the full suite passes.

## 8. Verification

- [x] 8.1 Export the schema again and verify it is identical to 1.1's.
      (Superseded by 9.4, since group 9 changes `exercises` deliberately.)
- [x] 8.2 Run the full backend suite against PostgreSQL 17, and
      `openspec validate follow-graphql-conventions --strict`.

## 9. Standard pagination for exercises

- [x] 9.1 Red: switch the `limit` tests in `test_schema.py` to
      `pagination: {limit: …}`, and add tests for an offset page, for
      paging after filters and ordering, and for the page cap
      (`STRAWBERRY_DJANGO['PAGINATION_MAX_LIMIT']` lowered in the test).
      Verify they fail because `pagination` is not an argument.
- [x] 9.2 Green: replace `LimitedField` and the `exercises` resolver with
      `strawberry_django.field(pagination=True)`, and declare
      `STRAWBERRY_DJANGO = {'PAGINATION_MAX_LIMIT': …}` from
      `STRAWBERRY_PAGINATION_MAX_LIMIT` in settings. Verify the module passes,
      and that the 200-exercise frontend query test still returns all 200.
- [x] 9.3 Correct the schema block in the spec delta to the SDL the schema
      actually exports. (It already matched.)
- [x] 9.4 Export the schema, verify its only difference from 1.1's is the
      `exercises` arguments plus `OffsetPaginationInput`, and run the full
      suite and `openspec validate follow-graphql-conventions --strict`.

## 10. Mutations take model inputs through `data`

- [x] 10.1 Red: unit-test `typelearn.graphql.update_model_instance_based_on_input`
      (scalars set, an enum set by value, a `{ set: id }` relation resolved,
      an unknown or malformed id and `set: null` on a required relation each
      reported as `not_found`, `UNSET` skipped). Verify the tests fail on the
      missing module.
- [x] 10.2 Green: write the applier, and verify its tests pass.
- [x] 10.3 Red: rewrite `test_translation_schema.py`'s mutation documents to
      `mutation { translation { …(data: …) } }`, expect `proposeTranslation`
      to return the stored `Translation`, and add a parametrized test that a
      pending, a rejected, an unknown and a malformed translation id all get
      the identical literal response. Verify they fail.
- [x] 10.4 Green: add `TranslationCreateInput`, `TranslationRatingInput` and
      `TranslationMutations`, rewrite both resolvers onto the applier, delete
      `object_or_fail` and `ProposeTranslationResult`, and verify the full
      backend suite passes.
- [x] 10.5 Red: change the frontend store tests, the panel test and the e2e
      stub and spec to the new documents and variables
      (`{ data: { translation: { set } , clientId, value } }`,
      `{ data: { exercise: { set }, language, text, clientId } }`,
      responses under `translation`). Verify vitest fails.
- [x] 10.6 Green: change `stores/translation.js`, and verify `npm run test` and
      `npm run test:e2e` pass.
- [x] 10.7 Correct the amended mutation schema block in
      `add-phrase-translations`' delta to the exported SDL. Then export the
      schema, rerun the cluster smoke test against the rebuilt stack with
      rating and proposing included, and run
      `openspec validate follow-graphql-conventions --strict`.

## 11. File fields as a project-wide `File` type

- [x] 11.1 Red: in `typelearn/tests/test_graphql.py`, test that `FileField`
      and `ImageField` map to `File`. In `test_schema.py`, ask for
      `originalAudio { url }` wherever `audioUrl` was asked for, and add tests
      that `originalAudio { path }` and `{ size }` fail validation. Verify
      they fail.
- [x] 11.2 Green: declare `File` and the map override in `typelearn.graphql`,
      replace `audio_url` with `original_audio: auto`, and verify the full
      backend suite passes, including the one-query deck and catalog tests.
- [x] 11.3 Red: change the frontend tests and the e2e fixture to
      `originalAudio: { url }`. Verify vitest fails.
- [x] 11.4 Green: `stores/exercise.js` asks for `originalAudio { url }`, and
      `SentenceView.vue` plays `originalAudio.url`. Verify `npm run test`,
      `npm run test:e2e` and `npm run build`.
- [x] 11.5 Export the schema and check the delta's schema block against it.
      Rerun the in-pod suite and the live smoke tests (deck audio plays), and
      `openspec validate follow-graphql-conventions --strict`.

## Workflow follow-up

- Archive after `add-phrase-translations` is archived, since this change
  amends wording in that change's delta.
