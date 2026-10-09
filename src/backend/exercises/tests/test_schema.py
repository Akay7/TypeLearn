"""Schema tests go through the URL conf, so they cover the route, the CSRF
exemption, and the view wiring alongside the resolvers."""
import json

import pytest

from exercises.models import Exercise
from exercises.schema import build_schema

GRAPHQL_URL = '/graphql/'


def query(client, document):
    """POST a GraphQL document and return the decoded response body."""
    response = client.post(
        GRAPHQL_URL,
        data=json.dumps({'query': document}),
        content_type='application/json',
    )
    return response, json.loads(response.content)


@pytest.fixture
def exercises(db):
    """Two rows, so `limit` has something to cut."""
    return [
        Exercise.objects.create(
            sentence='สวัสดีตอนเช้าครับ',
            sentence_id='sentence-one',
            original_audio='clips/one.mp3',
            up_votes=3,
            difficulty=2,
        ),
        Exercise.objects.create(
            sentence='ผมชอบกินข้าวผัด',
            sentence_id='sentence-two',
            original_audio='clips/two.mp3',
            up_votes=5,
            difficulty=4,
        ),
    ]


def test_documented_query_returns_data(client, exercises):
    response, body = query(client, '{ exercises { id sentence audioUrl difficulty } }')

    assert response.status_code == 200
    assert 'errors' not in body
    assert len(body['data']['exercises']) == 2


def test_snake_case_field_is_not_part_of_the_contract(client, exercises):
    _, body = query(client, '{ exercises { sentence up_votes } }')

    assert 'errors' in body
    assert 'up_votes' in body['errors'][0]['message']


def test_up_votes_is_published_as_camel_case(client, exercises):
    _, body = query(client, '{ exercises { upVotes } }')

    assert [item['upVotes'] for item in body['data']['exercises']] == [3, 5]


def test_limit_caps_the_result(client, exercises):
    _, body = query(client, '{ exercises(limit: 1) { id sentence audioUrl } }')

    assert len(body['data']['exercises']) == 1
    assert all(body['data']['exercises'][0].values())


def test_empty_catalog_returns_an_empty_list(client, db):
    _, body = query(client, '{ exercises { id } }')

    assert 'errors' not in body
    assert body['data']['exercises'] == []


def test_audio_url_is_absolute(client, exercises):
    _, body = query(client, '{ exercises(limit: 1) { audioUrl } }')

    audio_url = body['data']['exercises'][0]['audioUrl']
    assert audio_url.startswith('http://')
    assert audio_url.endswith('/media/clips/one.mp3')


def test_single_exercise_by_id(client, exercises):
    _, body = query(client, '{ exercise(id: %d) { sentence } }' % exercises[0].pk)

    assert body['data']['exercise']['sentence'] == exercises[0].sentence


def test_unknown_id_returns_null(client, exercises):
    _, body = query(client, '{ exercise(id: 999999) { sentence } }')

    assert 'errors' not in body
    assert body['data']['exercise'] is None


def test_filters_narrow_the_catalog(client, exercises):
    _, body = query(client, '{ exercises(filters: {difficulty: {lte: 2}}) { difficulty } }')

    assert 'errors' not in body
    assert body['data']['exercises'] == [{'difficulty': 2}]


def test_ordering_overrides_the_model_default(client, exercises):
    _, body = query(client, '{ exercises(ordering: [{difficulty: DESC}]) { difficulty } }')

    assert [item['difficulty'] for item in body['data']['exercises']] == [4, 2]


def test_limit_is_applied_after_filters_and_ordering(client, exercises):
    """The regression this combination guards: a resolver that sliced the
    queryset itself would make Django raise `Cannot reorder a query once a
    slice has been taken` as soon as `ordering` arrived with `limit`."""
    _, body = query(
        client,
        '{ exercises(limit: 1, filters: {upVotes: {gte: 3}}, ordering: [{upVotes: DESC}])'
        ' { upVotes } }',
    )

    assert 'errors' not in body
    assert body['data']['exercises'] == [{'upVotes': 5}]


def test_introspection_is_available_in_development(client, db, settings):
    settings.DEBUG = True
    schema = build_schema()

    result = schema.execute_sync('{ __schema { queryType { name } } }')

    assert result.errors is None
    assert result.data['__schema']['queryType']['name'] == 'Query'


def test_introspection_is_disabled_outside_development(db, settings):
    settings.DEBUG = False
    schema = build_schema()

    result = schema.execute_sync('{ __schema { queryType { name } } }')

    assert result.errors
    assert 'introspection' in result.errors[0].message.lower()


def test_alias_bomb_is_rejected(client, exercises, settings):
    """The limits are read per request, so overriding the setting is enough —
    the schema does not have to be rebuilt."""
    settings.STRAWBERRY_MAX_ALIASES = 2

    _, body = query(client, '{ a: exercises { id } b: exercises { id } c: exercises { id } }')

    assert body['errors'][0]['message'] == '3 aliases found. Allowed: 2'


def test_oversized_document_is_rejected(client, exercises, settings):
    settings.STRAWBERRY_MAX_TOKENS = 5

    _, body = query(client, '{ exercises { id sentence difficulty upVotes } }')

    assert 'more than 5 tokens' in body['errors'][0]['message']


@pytest.fixture
def catalog(db):
    """Enough rows that two random decks drawn from it practically never agree."""
    return Exercise.objects.bulk_create(
        Exercise(sentence=f'ประโยค {i}', original_audio=f'clips/{i}.mp3')
        for i in range(60)
    )


def deck_ids(client, size):
    response, body = query(client, f'{{ deck(size: {size}) {{ id sentence audioUrl }} }}')
    assert response.status_code == 200
    assert 'errors' not in body, body
    return [item['id'] for item in body['data']['deck']]


def test_deck_returns_the_requested_number_of_distinct_exercises(client, catalog):
    _, body = query(client, '{ deck(size: 20) { id sentence audioUrl } }')

    deck = body['data']['deck']
    assert len(deck) == 20
    assert len({item['id'] for item in deck}) == 20
    assert all(item['sentence'] and item['audioUrl'].startswith('http') for item in deck)


def test_two_decks_differ(client, catalog):
    # Two independent 20-of-60 draws in the same order: odds far below one in 10^30.
    assert deck_ids(client, 20) != deck_ids(client, 20)


def test_a_deck_larger_than_the_catalog_returns_it_once(client, exercises):
    ids = deck_ids(client, 50)

    assert sorted(ids) == sorted(str(e.pk) for e in exercises)


def test_the_deck_size_is_capped(client, catalog, settings):
    settings.EXERCISE_DECK_MAX_SIZE = 7

    assert len(deck_ids(client, 50)) == 7


@pytest.mark.parametrize('size', [0, -3])
def test_a_deck_size_below_one_is_an_error(client, catalog, size):
    _, body = query(client, f'{{ deck(size: {size}) {{ id }} }}')

    assert 'errors' in body
    assert 'size' in body['errors'][0]['message']
    assert body['data'] is None


def test_a_deck_from_an_empty_catalog_is_empty(client, db):
    assert deck_ids(client, 10) == []
