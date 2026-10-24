"""The translation field and the two mutations, through the URL conf like the
rest of the schema tests."""
import json
import uuid

import pytest
from django.utils import timezone
from graphql import GraphQLError

from exercises.models import Exercise, Translation, TranslationRating
from exercises.schema import build_schema, clean_or_fail

GRAPHQL_URL = '/graphql/'
CLIENT = str(uuid.uuid4())

TRANSLATION_OF = '''
query($id: ID!, $language: String!) {
  exercise(id: $id) { translation(language: $language) { id text origin upVotes downVotes } }
}
'''
DECK_TRANSLATIONS = '''
query($size: Int!, $language: String!) {
  deck(size: $size) { id translation(language: $language) { text origin } }
}
'''
TWO_LANGUAGES = '''{ deck(size: 1) {
  en: translation(language: "en") { text }
  fr: translation(language: "fr") { text } } }'''
RATE = '''
mutation($data: TranslationRatingInput!) {
  translation { rateTranslation(data: $data) { upVotes downVotes } }
}
'''
PROPOSE = '''
mutation($data: TranslationCreateInput!) {
  translation { proposeTranslation(data: $data) { id text origin upVotes downVotes } }
}
'''
ORIGIN_VALUES = '{ __type(name: "TranslationOrigin") { enumValues { name } } }'
PROPOSE_INLINE = (
    'mutation { translation { proposeTranslation(data: {exercise: {set: 1}, language: "en", '
    'text: "Via GET", clientId: "%s"}) { id } } }' % CLIENT
)
# Copied from src/frontend/src/stores/translation.js: the rest of a
# 200-exercise deck in one request, ids as a variable so they cost no tokens
# against STRAWBERRY_MAX_TOKENS.
FRONTEND_TRANSLATIONS = '''
  query Translations($ids: [ID!], $language: String!) {
    exercises(filters: { id: { inList: $ids } }) {
      id
      translation(language: $language) { id text origin upVotes downVotes }
    }
  }
'''


def gql(client, document, variables=None, **headers):
    response = client.post(
        GRAPHQL_URL,
        data=json.dumps({'query': document, 'variables': variables or {}}),
        content_type='application/json',
        **headers,
    )
    return json.loads(response.content)


def refusal_code(body):
    """The code of the response's one error. A refusal is exactly one error
    and no data, so a second error cannot hide behind the first."""
    assert len(body['errors']) == 1, body['errors']
    assert body['data'] is None
    return body['errors'][0]['extensions']['code']


def make_exercise(index):
    return Exercise.objects.create(
        sentence=f'ประโยค{index}', original_audio=f'clips/{index}.mp3'
    )


def make_translation(exercise, text, **overrides):
    fields = {
        'language': 'en',
        'origin': Translation.Origin.MACHINE,
        'status': Translation.Status.PUBLISHED,
        'published_at': timezone.now(),
    }
    fields.update(overrides)
    return Translation.objects.create(exercise=exercise, text=text, **fields)


def shown_translation(client, exercise_id, language='en'):
    body = gql(client, TRANSLATION_OF, {'id': exercise_id, 'language': language})
    assert 'errors' not in body
    return body['data']['exercise']['translation']


def rate(client, translation_id, value, client_id=CLIENT, **headers):
    data = {'translation': {'set': translation_id}, 'clientId': client_id, 'value': value}
    return gql(client, RATE, {'data': data}, **headers)


def propose(client, exercise_id, text, language='en', client_id=CLIENT):
    data = {'exercise': {'set': exercise_id}, 'language': language, 'text': text,
            'clientId': client_id}
    return gql(client, PROPOSE, {'data': data})


def rated(body):
    return body['data']['translation']['rateTranslation']


def proposed(body):
    return body['data']['translation']['proposeTranslation']


PUBLISHED_TEXT = 'Sentence zero'


@pytest.fixture
def exercise(db):
    return make_exercise(0)


@pytest.fixture
def published(exercise):
    return make_translation(exercise, PUBLISHED_TEXT)


# --- Read side --------------------------------------------------------------


@pytest.mark.django_db()
def test_deck_carries_the_shown_translation(client, published):
    body = gql(client, DECK_TRANSLATIONS, {'size': 5, 'language': 'en'})

    assert 'errors' not in body
    assert body['data']['deck'] == [
        {'id': str(published.exercise_id),
         'translation': {'text': PUBLISHED_TEXT, 'origin': 'MACHINE'}},
    ]


@pytest.mark.django_db()
def test_translation_through_a_variable(client, published):
    body = gql(client, TRANSLATION_OF, {'id': published.exercise_id, 'language': 'en'})

    assert 'errors' not in body
    assert body['data']['exercise']['translation'] == {
        'id': str(published.id), 'text': PUBLISHED_TEXT, 'origin': 'MACHINE',
        'upVotes': 0, 'downVotes': 0,
    }


@pytest.mark.django_db()
def test_best_rated_translation_is_shown(client, exercise):
    learner_text = 'Learner text'
    make_translation(exercise, 'Machine text', up_votes=0, down_votes=2)
    make_translation(exercise, learner_text, origin=Translation.Origin.LEARNER, up_votes=1)

    shown = shown_translation(client, exercise.id)

    assert (shown['text'], shown['origin']) == (learner_text, 'LEARNER')


def test_every_origin_the_model_knows_is_published(settings):
    settings.DEBUG = True

    result = build_schema().execute_sync(ORIGIN_VALUES)

    assert result.errors is None
    published = [value['name'] for value in result.data['__type']['enumValues']]
    assert published == [origin.name for origin in Translation.Origin]


@pytest.mark.django_db()
@pytest.mark.parametrize('language', ['xx', 'th', ''])
def test_untranslatable_language_is_null_not_an_error(client, published, language):
    body = gql(client, TRANSLATION_OF, {'id': published.exercise_id, 'language': language})

    assert 'errors' not in body
    assert body['data']['exercise']['translation'] is None


@pytest.mark.django_db()
@pytest.mark.parametrize('status', [Translation.Status.PENDING, Translation.Status.REJECTED])
def test_unpublished_translations_are_never_shown(client, exercise, status):
    make_translation(exercise, 'Hidden', origin=Translation.Origin.LEARNER, status=status,
                     up_votes=9)

    assert shown_translation(client, exercise.id) is None


@pytest.mark.django_db()
def test_two_languages_in_one_query_do_not_collide(client, exercise):
    english, french = 'English', 'Français'
    make_translation(exercise, english)
    make_translation(exercise, french, language='fr')

    body = gql(client, TWO_LANGUAGES)

    assert 'errors' not in body
    assert body['data']['deck'] == [{'en': {'text': english}, 'fr': {'text': french}}]


@pytest.mark.django_db()
def test_deck_translations_cost_a_constant_number_of_queries(
    client, django_assert_max_num_queries
):
    size = 50
    for index in range(size):
        exercise = make_exercise(index)
        make_translation(exercise, f'Sentence {index}')
        make_translation(exercise, f'Better {index}', origin=Translation.Origin.LEARNER,
                         up_votes=1)

    # The deck itself, and one prefetch for every translation in it.
    with django_assert_max_num_queries(2):
        body = gql(client, DECK_TRANSLATIONS, {'size': size, 'language': 'en'})

    assert 'errors' not in body
    assert len(body['data']['deck']) == size
    assert all(item['translation']['text'].startswith('Better') for item in body['data']['deck'])


# --- rateTranslation --------------------------------------------------------


@pytest.mark.django_db()
def test_rating_is_idempotent_per_client(client, published):
    first = rate(client, published.id, 'UP')
    assert rated(first) == {'upVotes': 1, 'downVotes': 0}

    body = rate(client, published.id, 'UP')

    assert 'errors' not in body
    assert rated(body) == {'upVotes': 1, 'downVotes': 0}
    assert TranslationRating.objects.count() == 1


@pytest.mark.django_db()
def test_changing_a_rating_moves_the_vote(client, published):
    first = rate(client, published.id, 'UP')
    assert rated(first) == {'upVotes': 1, 'downVotes': 0}

    body = rate(client, published.id, 'DOWN')

    assert 'errors' not in body
    assert rated(body) == {'upVotes': 0, 'downVotes': 1}
    assert TranslationRating.objects.get().value == -1


@pytest.mark.django_db()
def test_withdrawing_a_rating_removes_it(client, published):
    first = rate(client, published.id, 'DOWN')
    assert rated(first) == {'upVotes': 0, 'downVotes': 1}

    body = rate(client, published.id, 'NONE')

    assert 'errors' not in body
    assert rated(body) == {'upVotes': 0, 'downVotes': 0}
    assert not TranslationRating.objects.exists()


@pytest.mark.django_db()
def test_two_clients_both_count(client, published):
    first = rate(client, published.id, 'UP')
    assert rated(first) == {'upVotes': 1, 'downVotes': 0}

    body = rate(client, published.id, 'UP', client_id=str(uuid.uuid4()))

    assert 'errors' not in body
    assert rated(body) == {'upVotes': 2, 'downVotes': 0}


@pytest.mark.django_db()
@pytest.mark.parametrize('hidden', [
    Translation.Status.PENDING, Translation.Status.REJECTED, 'unknown', 'malformed', 'null',
])
def test_rating_a_hidden_translation_is_refused_as_unknown(client, exercise, hidden):
    """A pending or rejected translation answers exactly as an id no row has,
    so the response cannot tell a hidden suggestion from nothing: every case
    asserts the same literal body."""
    if hidden in Translation.Status:
        translation_id = make_translation(exercise, 'Hidden', origin=Translation.Origin.LEARNER,
                                          status=hidden).id
    else:
        translation_id = {'unknown': 999999, 'malformed': 'abc', 'null': None}[hidden]

    body = rate(client, translation_id, 'UP')

    assert body == {
        'data': None,
        'errors': [{
            'message': 'No translation has that id.',
            'locations': [{'line': 3, 'column': 17}],
            'path': ['translation', 'rateTranslation'],
            'extensions': {'code': 'NOT_FOUND'},
        }],
    }
    assert not TranslationRating.objects.exists()


@pytest.mark.django_db()
def test_rating_with_a_malformed_client_id_fails(client, published):
    body = rate(client, published.id, 'UP', client_id='me')

    assert refusal_code(body) == 'INVALID_CLIENT_ID'
    assert not TranslationRating.objects.exists()


@pytest.mark.django_db()
def test_ratings_over_the_limit_are_refused(client, exercise, settings):
    settings.TRANSLATION_RATINGS_PER_HOUR = 2
    translations = [make_translation(exercise, f'T{i}', language=lang)
                    for i, lang in enumerate(['en', 'fr', 'de'])]
    for translation in translations[:2]:
        allowed = rate(client, translation.id, 'UP')
        assert rated(allowed) == {'upVotes': 1, 'downVotes': 0}

    body = rate(client, translations[2].id, 'UP')

    assert refusal_code(body) == 'RATE_LIMITED'
    assert TranslationRating.objects.count() == 2


@pytest.mark.django_db()
def test_rating_limit_also_counts_by_address(client, exercise, settings):
    # A browser that rotates its id still shares its address.
    settings.TRANSLATION_RATINGS_PER_HOUR = 1
    first, second = (make_translation(exercise, f'T{i}', language=lang)
                     for i, lang in enumerate(['en', 'fr']))
    allowed = rate(client, first.id, 'UP')
    assert rated(allowed) == {'upVotes': 1, 'downVotes': 0}

    body = rate(client, second.id, 'UP', client_id=str(uuid.uuid4()))

    assert refusal_code(body) == 'RATE_LIMITED'


# --- proposeTranslation -----------------------------------------------------


@pytest.mark.django_db()
def test_proposal_is_stored_as_pending_and_not_shown(client, published):
    suggested = 'A better sentence'

    body = propose(client, published.exercise_id, f'  {suggested}  ')

    assert 'errors' not in body
    suggestion = Translation.objects.get(origin=Translation.Origin.LEARNER)
    assert proposed(body) == {'id': str(suggestion.id), 'text': suggested, 'origin': 'LEARNER',
                              'upVotes': 0, 'downVotes': 0}
    assert (suggestion.text, suggestion.status, suggestion.client_id) == (
        suggested, Translation.Status.PENDING, CLIENT)
    assert suggestion.address_hash
    assert shown_translation(client, published.exercise_id)['text'] == PUBLISHED_TEXT


@pytest.mark.django_db()
def test_proposal_where_no_translation_exists(client, exercise):
    first = 'First translation'

    body = propose(client, exercise.id, first, language='ru')

    assert 'errors' not in body
    assert proposed(body)['text'] == first
    assert Translation.objects.get(origin=Translation.Origin.LEARNER).language == 'ru'


@pytest.mark.django_db()
@pytest.mark.parametrize(('kwargs', 'code'), [
    ({'text': '   '}, 'BLANK'),
    ({'text': 'x' * 501}, 'TOO_LONG'),
    ({'text': PUBLISHED_TEXT}, 'DUPLICATE'),
    ({'text': 'Fine', 'language': 'th'}, 'UNSUPPORTED_LANGUAGE'),
    ({'text': 'Fine', 'language': 'xx'}, 'UNSUPPORTED_LANGUAGE'),
    ({'text': 'Fine', 'client_id': 'not-a-uuid'}, 'INVALID_CLIENT_ID'),
    ({'text': 'Fine', 'client_id': None}, 'INVALID_CLIENT_ID'),
])
def test_invalid_proposals_are_refused(client, published, kwargs, code):
    body = propose(client, published.exercise_id, **kwargs)

    assert refusal_code(body) == code
    assert not Translation.objects.filter(origin=Translation.Origin.LEARNER).exists()


@pytest.mark.django_db()
def test_a_proposal_as_long_as_the_column_is_accepted(client, exercise):
    longest = Translation._meta.get_field('text').max_length

    body = propose(client, exercise.id, 'x' * longest)

    assert 'errors' not in body
    assert len(proposed(body)['text']) == longest


@pytest.mark.django_db()
def test_a_proposal_longer_than_the_column_is_too_long(client, exercise):
    longest = Translation._meta.get_field('text').max_length

    body = propose(client, exercise.id, 'x' * (longest + 1))

    assert refusal_code(body) == 'TOO_LONG'
    assert not Translation.objects.exists()


@pytest.mark.django_db()
def test_an_unforeseen_validation_failure_is_still_coded(exercise):
    """No request reaches this today: every field a client does not supply is
    set by the server. It guards against a rule added to the model later
    turning into an uncoded error."""
    unforeseen = Translation(exercise=exercise, language='en', text='Fine', origin='robot',
                             status=Translation.Status.PENDING)

    with pytest.raises(GraphQLError) as refused:
        clean_or_fail(unforeseen)

    assert refused.value.extensions == {'code': 'INVALID'}
    assert 'robot' in refused.value.message


@pytest.mark.django_db()
@pytest.mark.parametrize('exercise_id', [999999, 'abc', None])
def test_proposal_for_an_unknown_exercise(client, exercise_id):
    body = propose(client, exercise_id, 'Fine')

    assert refusal_code(body) == 'NOT_FOUND'
    assert body['errors'][0]['message'] == 'No exercise has that id.'
    assert not Translation.objects.exists()


@pytest.mark.django_db()
def test_resubmitting_rejected_text_is_a_duplicate(client, exercise):
    rejected_text = 'Rejected text'
    make_translation(exercise, rejected_text, origin=Translation.Origin.LEARNER,
                     status=Translation.Status.REJECTED)

    body = propose(client, exercise.id, rejected_text)

    assert refusal_code(body) == 'DUPLICATE'


@pytest.mark.django_db()
def test_proposals_over_the_limit_are_refused(client, exercise, settings):
    settings.TRANSLATION_PROPOSALS_PER_HOUR = 2
    for text in ['One', 'Two']:
        allowed = propose(client, exercise.id, text)
        assert proposed(allowed)['text'] == text

    body = propose(client, exercise.id, 'Three', client_id=str(uuid.uuid4()))

    assert refusal_code(body) == 'RATE_LIMITED'
    assert Translation.objects.count() == 2


@pytest.mark.django_db()
def test_mutation_over_get_is_refused(client, published):
    response = client.get(GRAPHQL_URL, {'query': PROPOSE_INLINE})

    assert response.status_code in (400, 405)
    assert not Translation.objects.filter(text='Via GET').exists()


@pytest.mark.django_db()
def test_the_frontends_translations_query_fits_the_limits(client):
    exercises = [make_exercise(index) for index in range(200)]
    translated, untranslated = exercises[7], exercises[8]
    translated_text = 'Seven'
    make_translation(translated, translated_text)

    body = gql(client, FRONTEND_TRANSLATIONS,
               {'ids': [str(e.id) for e in exercises], 'language': 'en'})

    assert 'errors' not in body
    assert len(body['data']['exercises']) == 200
    shown = {item['id']: item['translation'] for item in body['data']['exercises']}
    assert shown[str(translated.id)]['text'] == translated_text
    assert shown[str(untranslated.id)] is None
