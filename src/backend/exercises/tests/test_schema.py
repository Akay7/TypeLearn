"""Schema tests go through the URL conf, so they cover the route, the CSRF
exemption, and the view wiring alongside the resolvers."""
import json

import pytest

from exercises.models import Exercise
from exercises.schema import build_schema

GRAPHQL_URL = '/graphql/'

DOCUMENTED_QUERY = '{ exercises { id sentence originalAudio { url } difficulty } }'
SNAKE_CASE_QUERY = '{ exercises { sentence up_votes } }'
UP_VOTES = '{ exercises { upVotes } }'
IDS = '{ exercises { id } }'
PAGE = (
    'query($page: OffsetPaginationInput) {'
    ' exercises(pagination: $page) { id sentence originalAudio { url } } }'
)
EXERCISE = 'query($id: ID!) { exercise(id: $id) { sentence } }'
EASY = '{ exercises(filters: {difficulty: {lte: 2}}) { difficulty } }'
HARDEST_FIRST = '{ exercises(ordering: [{difficulty: DESC}]) { difficulty } }'
PAGE_FILTERED_ORDERED = (
    '{ exercises(pagination: {limit: 1}, filters: {upVotes: {gte: 3}},'
    ' ordering: [{upVotes: DESC}]) { upVotes } }'
)
INTROSPECTION = '{ __schema { queryType { name } } }'
THREE_ALIASES = '{ a: exercises { id } b: exercises { id } c: exercises { id } }'
SEVEN_TOKENS_AND_MORE = '{ exercises { id sentence difficulty upVotes } }'
DECK = 'query($size: Int!) { deck(size: $size) { id sentence originalAudio { url } } }'
DECK_IDS = 'query($size: Int!) { deck(size: $size) { id } }'
FULL_DECK = (
    'query($size: Int!) { deck(size: $size) { id sentence originalAudio { url } difficulty } }'
)
CATALOG_AUDIO = '{ exercises { id originalAudio { url } } }'
FILE_FIELD = '{ exercises { originalAudio { %s } } }'


def query(client, document, variables=None):
    """POST a GraphQL document and return the response and its decoded body."""
    response = client.post(
        GRAPHQL_URL,
        data=json.dumps({'query': document, 'variables': variables or {}}),
        content_type='application/json',
    )
    return response, json.loads(response.content)


def deck_ids(client, size):
    response, body = query(client, DECK, {'size': size})
    assert response.status_code == 200
    assert 'errors' not in body, body
    return [item['id'] for item in body['data']['deck']]


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


@pytest.fixture
def catalog(db):
    """Enough rows that two random decks drawn from it practically never agree."""
    return Exercise.objects.bulk_create(
        Exercise(sentence=f'ประโยค {i}', original_audio=f'clips/{i}.mp3')
        for i in range(60)
    )


@pytest.mark.django_db()
def test_documented_query_returns_data(client, exercises):
    response, body = query(client, DOCUMENTED_QUERY)

    assert response.status_code == 200
    assert 'errors' not in body
    assert len(body['data']['exercises']) == 2


@pytest.mark.django_db()
def test_snake_case_field_is_not_part_of_the_contract(client, exercises):
    _, body = query(client, SNAKE_CASE_QUERY)

    assert len(body['errors']) == 1
    assert 'up_votes' in body['errors'][0]['message']


@pytest.mark.django_db()
def test_up_votes_is_published_as_camel_case(client, exercises):
    _, body = query(client, UP_VOTES)

    assert 'errors' not in body
    assert body['data']['exercises'] == [{'upVotes': 3}, {'upVotes': 5}]


@pytest.mark.django_db()
def test_a_limit_cuts_the_list(client, exercises):
    first = exercises[0]

    _, body = query(client, PAGE, {'page': {'limit': 1}})

    assert 'errors' not in body
    assert len(body['data']['exercises']) == 1
    shown = body['data']['exercises'][0]
    assert shown['id'] == str(first.pk)
    assert shown['sentence'] == first.sentence
    assert shown['originalAudio']['url'].endswith('/media/clips/one.mp3')


@pytest.mark.django_db()
def test_empty_catalog_returns_an_empty_list(client):
    _, body = query(client, IDS)

    assert 'errors' not in body
    assert body['data']['exercises'] == []


@pytest.mark.django_db()
def test_audio_url_is_absolute(client, exercises):
    _, body = query(client, PAGE, {'page': {'limit': 1}})

    assert 'errors' not in body
    audio_url = body['data']['exercises'][0]['originalAudio']['url']
    assert audio_url.startswith('http://')
    assert audio_url.endswith('/media/clips/one.mp3')


@pytest.mark.django_db()
def test_single_exercise_by_id(client, exercises):
    wanted = exercises[0]

    _, body = query(client, EXERCISE, {'id': wanted.pk})

    assert 'errors' not in body
    assert body['data']['exercise'] == {'sentence': wanted.sentence}


@pytest.mark.django_db()
def test_unknown_id_returns_null(client, exercises):
    _, body = query(client, EXERCISE, {'id': 999999})

    assert 'errors' not in body
    assert body['data']['exercise'] is None


@pytest.mark.django_db()
def test_filters_narrow_the_catalog(client, exercises):
    _, body = query(client, EASY)

    assert 'errors' not in body
    assert body['data']['exercises'] == [{'difficulty': 2}]


@pytest.mark.django_db()
def test_ordering_overrides_the_model_default(client, exercises):
    _, body = query(client, HARDEST_FIRST)

    assert 'errors' not in body
    assert body['data']['exercises'] == [{'difficulty': 4}, {'difficulty': 2}]


@pytest.mark.django_db()
def test_a_page_is_cut_after_filters_and_ordering(client, exercises):
    """Slicing before ordering would make Django raise `Cannot reorder a
    query once a slice has been taken`, and slicing before filtering would cut
    the wrong rows."""
    _, body = query(client, PAGE_FILTERED_ORDERED)

    assert 'errors' not in body
    assert body['data']['exercises'] == [{'upVotes': 5}]


@pytest.mark.django_db()
def test_an_offset_pages_through_the_catalog(client, exercises):
    second = exercises[1]

    _, body = query(client, PAGE, {'page': {'offset': 1, 'limit': 1}})

    assert 'errors' not in body
    assert [item['id'] for item in body['data']['exercises']] == [str(second.pk)]


@pytest.mark.django_db()
def test_the_page_size_is_capped(client, exercises, settings):
    settings.STRAWBERRY_DJANGO = {'PAGINATION_MAX_LIMIT': 1}

    _, body = query(client, PAGE, {'page': {'limit': 2}})

    assert 'errors' not in body
    assert len(body['data']['exercises']) == 1


@pytest.mark.django_db()
def test_without_pagination_the_whole_list_is_returned(client, exercises, settings):
    """The cap applies to a page a client asks for, never to a list it did
    not page: the frontend fetches a whole deck's translations this way."""
    settings.STRAWBERRY_DJANGO = {'PAGINATION_MAX_LIMIT': 1}

    _, body = query(client, IDS)

    assert 'errors' not in body
    assert len(body['data']['exercises']) == len(exercises)


def test_introspection_is_available_in_development(settings):
    settings.DEBUG = True
    schema = build_schema()

    result = schema.execute_sync(INTROSPECTION)

    assert result.errors is None
    assert result.data['__schema']['queryType']['name'] == 'Query'


def test_introspection_is_disabled_outside_development(settings):
    settings.DEBUG = False
    schema = build_schema()

    result = schema.execute_sync(INTROSPECTION)

    # One refusal per introspection field the document names.
    assert len(result.errors) == 2
    assert "introspection has been disabled" in result.errors[0].message
    assert "the field '__schema'" in result.errors[0].message
    assert "introspection has been disabled" in result.errors[1].message
    assert "the field 'queryType'" in result.errors[1].message


@pytest.mark.django_db()
def test_alias_bomb_is_rejected(client, exercises, settings):
    """The limits are read per request, so overriding the setting is enough —
    the schema does not have to be rebuilt."""
    settings.STRAWBERRY_MAX_ALIASES = 2

    _, body = query(client, THREE_ALIASES)

    assert len(body['errors']) == 1
    assert body['errors'][0]['message'] == '3 aliases found. Allowed: 2'


@pytest.mark.django_db()
def test_oversized_document_is_rejected(client, exercises, settings):
    settings.STRAWBERRY_MAX_TOKENS = 5

    _, body = query(client, SEVEN_TOKENS_AND_MORE)

    assert len(body['errors']) == 1
    assert 'more than 5 tokens' in body['errors'][0]['message']


@pytest.mark.django_db()
def test_deck_returns_the_requested_number_of_distinct_exercises(client, catalog):
    size = 20

    _, body = query(client, DECK, {'size': size})

    assert 'errors' not in body
    deck = body['data']['deck']
    assert len(deck) == size
    assert len({item['id'] for item in deck}) == size
    assert all(item['sentence'] and item['originalAudio']['url'].startswith('http')
               for item in deck)


@pytest.mark.django_db()
def test_two_decks_differ(client, catalog):
    # Two independent 20-of-60 draws in the same order: odds far below one in 10^30.
    assert deck_ids(client, 20) != deck_ids(client, 20)


@pytest.mark.django_db()
def test_a_deck_larger_than_the_catalog_returns_it_once(client, exercises):
    ids = deck_ids(client, 50)

    assert sorted(ids) == sorted(str(e.pk) for e in exercises)


@pytest.mark.django_db()
def test_the_deck_size_is_capped(client, catalog, settings):
    settings.EXERCISE_DECK_MAX_SIZE = 7

    assert len(deck_ids(client, 50)) == 7


@pytest.mark.django_db()
@pytest.mark.parametrize('size', [0, -3])
def test_a_deck_size_below_one_is_an_error(client, catalog, size):
    _, body = query(client, DECK_IDS, {'size': size})

    assert len(body['errors']) == 1
    assert body['errors'][0]['extensions']['code'] == 'INVALID_SIZE'
    assert 'size' in body['errors'][0]['message']
    assert body['data'] is None


@pytest.mark.django_db()
def test_a_deck_from_an_empty_catalog_is_empty(client):
    assert deck_ids(client, 10) == []


@pytest.mark.django_db()
def test_a_deck_with_its_audio_is_one_query(client, catalog, django_assert_num_queries):
    """The clip's URL is built from a column, and a column the optimizer
    leaves out of its `.only()` costs a query per row."""
    size = 20

    with django_assert_num_queries(1):
        _, body = query(client, FULL_DECK, {'size': size})

    assert 'errors' not in body
    assert len(body['data']['deck']) == size


@pytest.mark.django_db()
def test_the_catalog_with_its_audio_is_one_query(client, catalog, django_assert_num_queries):
    with django_assert_num_queries(1):
        _, body = query(client, CATALOG_AUDIO)

    assert 'errors' not in body
    assert len(body['data']['exercises']) == len(catalog)


@pytest.mark.django_db()
@pytest.mark.parametrize('field', ['path', 'size', 'name'])
def test_a_file_publishes_nothing_but_its_url(client, exercises, field):
    """Not the library's file type, which would publish where the file lives
    on the server and read its size from disk for every row."""
    _, body = query(client, FILE_FIELD % field)

    assert len(body['errors']) == 1
    assert body['errors'][0]['message'] == f"Cannot query field '{field}' on type 'File'."
