"""The translation field and the two mutations, through the URL conf like the
rest of the schema tests."""
import json
import uuid

import pytest
from django.utils import timezone

from exercises.models import Exercise, Translation, TranslationRating

GRAPHQL_URL = '/graphql/'
CLIENT = str(uuid.uuid4())


def gql(client, document, variables=None, **headers):
    response = client.post(
        GRAPHQL_URL,
        data=json.dumps({'query': document, 'variables': variables or {}}),
        content_type='application/json',
        **headers,
    )
    return json.loads(response.content)


def error_code(body):
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


@pytest.fixture
def exercise(db):
    return make_exercise(0)


@pytest.fixture
def published(exercise):
    return make_translation(exercise, 'Sentence zero')


# --- Read side --------------------------------------------------------------

TRANSLATION_OF = '''
query($id: ID!, $language: String!) {
  exercise(id: $id) { translation(language: $language) { id text origin upVotes downVotes } }
}
'''


def test_deck_carries_the_shown_translation(client, published):
    body = gql(client, '{ deck(size: 5) { id translation(language: "en") { text origin } } }')

    assert 'errors' not in body
    assert body['data']['deck'] == [
        {'id': str(published.exercise_id),
         'translation': {'text': 'Sentence zero', 'origin': 'MACHINE'}},
    ]


def test_translation_through_a_variable(client, published):
    body = gql(client, TRANSLATION_OF, {'id': published.exercise_id, 'language': 'en'})

    assert body['data']['exercise']['translation']['text'] == 'Sentence zero'


def test_best_rated_translation_is_shown(client, exercise):
    make_translation(exercise, 'Machine text', up_votes=0, down_votes=2)
    make_translation(exercise, 'Learner text', origin=Translation.Origin.LEARNER, up_votes=1)

    body = gql(client, TRANSLATION_OF, {'id': exercise.id, 'language': 'en'})

    assert body['data']['exercise']['translation']['text'] == 'Learner text'


@pytest.mark.parametrize('language', ['xx', 'th', ''])
def test_untranslatable_language_is_null_not_an_error(client, published, language):
    body = gql(client, TRANSLATION_OF, {'id': published.exercise_id, 'language': language})

    assert 'errors' not in body
    assert body['data']['exercise']['translation'] is None


@pytest.mark.parametrize('status', [Translation.Status.PENDING, Translation.Status.REJECTED])
def test_unpublished_translations_are_never_shown(client, exercise, status):
    make_translation(exercise, 'Hidden', origin=Translation.Origin.LEARNER, status=status,
                     up_votes=9)

    body = gql(client, TRANSLATION_OF, {'id': exercise.id, 'language': 'en'})

    assert body['data']['exercise']['translation'] is None


def test_two_languages_in_one_query_do_not_collide(client, exercise):
    make_translation(exercise, 'English')
    make_translation(exercise, 'Français', language='fr')

    body = gql(client, '''{ deck(size: 1) {
        en: translation(language: "en") { text }
        fr: translation(language: "fr") { text } } }''')

    assert body['data']['deck'] == [{'en': {'text': 'English'}, 'fr': {'text': 'Français'}}]


def test_deck_translations_cost_a_constant_number_of_queries(
    client, db, django_assert_max_num_queries
):
    for index in range(50):
        exercise = make_exercise(index)
        make_translation(exercise, f'Sentence {index}')
        make_translation(exercise, f'Better {index}', origin=Translation.Origin.LEARNER,
                         up_votes=1)

    # The deck itself, and one prefetch for every translation in it.
    with django_assert_max_num_queries(2):
        body = gql(client, '{ deck(size: 50) { id translation(language: "en") { text } } }')

    assert len(body['data']['deck']) == 50
    assert all(item['translation']['text'].startswith('Better') for item in body['data']['deck'])


# --- rateTranslation --------------------------------------------------------

RATE = '''
mutation($id: ID!, $client: String!, $value: TranslationRatingValue!) {
  rateTranslation(translationId: $id, clientId: $client, value: $value) { upVotes downVotes }
}
'''


def rate(client, translation_id, value, client_id=CLIENT, **headers):
    return gql(client, RATE, {'id': translation_id, 'client': client_id, 'value': value},
               **headers)


def test_rating_is_idempotent_per_client(client, published):
    rate(client, published.id, 'UP')
    body = rate(client, published.id, 'UP')

    assert body['data']['rateTranslation'] == {'upVotes': 1, 'downVotes': 0}
    assert TranslationRating.objects.count() == 1


def test_changing_a_rating_moves_the_vote(client, published):
    rate(client, published.id, 'UP')
    body = rate(client, published.id, 'DOWN')

    assert body['data']['rateTranslation'] == {'upVotes': 0, 'downVotes': 1}
    assert TranslationRating.objects.get().value == -1


def test_withdrawing_a_rating_removes_it(client, published):
    rate(client, published.id, 'DOWN')
    body = rate(client, published.id, 'NONE')

    assert body['data']['rateTranslation'] == {'upVotes': 0, 'downVotes': 0}
    assert not TranslationRating.objects.exists()


def test_two_clients_both_count(client, published):
    rate(client, published.id, 'UP')
    body = rate(client, published.id, 'UP', client_id=str(uuid.uuid4()))

    assert body['data']['rateTranslation'] == {'upVotes': 2, 'downVotes': 0}


@pytest.mark.parametrize('status', [Translation.Status.PENDING, Translation.Status.REJECTED])
def test_rating_an_unpublished_translation_fails(client, exercise, status):
    translation = make_translation(exercise, 'Hidden', origin=Translation.Origin.LEARNER,
                                   status=status)

    body = rate(client, translation.id, 'UP')

    assert error_code(body) == 'NOT_PUBLISHED'
    assert not TranslationRating.objects.exists()


def test_rating_an_unknown_translation_fails(client, db):
    assert error_code(rate(client, 999999, 'UP')) == 'NOT_FOUND'
    assert error_code(rate(client, 'abc', 'UP')) == 'NOT_FOUND'


def test_rating_with_a_malformed_client_id_fails(client, published):
    body = rate(client, published.id, 'UP', client_id='me')

    assert error_code(body) == 'INVALID_CLIENT_ID'
    assert not TranslationRating.objects.exists()


def test_ratings_over_the_limit_are_refused(client, exercise, settings):
    settings.TRANSLATION_RATINGS_PER_HOUR = 2
    translations = [make_translation(exercise, f'T{i}', language=lang)
                    for i, lang in enumerate(['en', 'fr', 'de'])]

    rate(client, translations[0].id, 'UP')
    rate(client, translations[1].id, 'UP')
    body = rate(client, translations[2].id, 'UP')

    assert error_code(body) == 'RATE_LIMITED'
    assert TranslationRating.objects.count() == 2


def test_rating_limit_also_counts_by_address(client, exercise, settings):
    # A browser that rotates its id still shares its address.
    settings.TRANSLATION_RATINGS_PER_HOUR = 1
    first, second = (make_translation(exercise, f'T{i}', language=lang)
                     for i, lang in enumerate(['en', 'fr']))

    rate(client, first.id, 'UP')
    body = rate(client, second.id, 'UP', client_id=str(uuid.uuid4()))

    assert error_code(body) == 'RATE_LIMITED'


# --- proposeTranslation -----------------------------------------------------

PROPOSE = '''
mutation($exercise: ID!, $language: String!, $text: String!, $client: String!) {
  proposeTranslation(exerciseId: $exercise, language: $language, text: $text, clientId: $client) {
    accepted
  }
}
'''


def propose(client, exercise_id, text, language='en', client_id=CLIENT):
    return gql(client, PROPOSE, {'exercise': exercise_id, 'language': language, 'text': text,
                                 'client': client_id})


def test_proposal_is_stored_as_pending_and_not_shown(client, published):
    body = propose(client, published.exercise_id, '  A better sentence  ')

    assert body['data']['proposeTranslation'] == {'accepted': True}
    suggestion = Translation.objects.get(origin=Translation.Origin.LEARNER)
    assert (suggestion.text, suggestion.status, suggestion.client_id) == (
        'A better sentence', Translation.Status.PENDING, CLIENT)
    assert suggestion.address_hash

    shown = gql(client, TRANSLATION_OF, {'id': published.exercise_id, 'language': 'en'})
    assert shown['data']['exercise']['translation']['text'] == 'Sentence zero'


def test_proposal_where_no_translation_exists(client, exercise):
    body = propose(client, exercise.id, 'First translation', language='ru')

    assert body['data']['proposeTranslation'] == {'accepted': True}


@pytest.mark.parametrize(('kwargs', 'code'), [
    ({'text': '   '}, 'BLANK'),
    ({'text': 'x' * 501}, 'TOO_LONG'),
    ({'text': 'Sentence zero'}, 'DUPLICATE'),
    ({'text': 'Fine', 'language': 'th'}, 'UNSUPPORTED_LANGUAGE'),
    ({'text': 'Fine', 'language': 'xx'}, 'UNSUPPORTED_LANGUAGE'),
    ({'text': 'Fine', 'client_id': 'not-a-uuid'}, 'INVALID_CLIENT_ID'),
])
def test_invalid_proposals_are_refused(client, published, kwargs, code):
    body = propose(client, published.exercise_id, **kwargs)

    assert error_code(body) == code
    assert not Translation.objects.filter(origin=Translation.Origin.LEARNER).exists()


def test_proposal_for_an_unknown_exercise(client, db):
    assert error_code(propose(client, 999999, 'Fine')) == 'NOT_FOUND'


def test_resubmitting_rejected_text_is_a_duplicate(client, exercise):
    make_translation(exercise, 'Rejected text', origin=Translation.Origin.LEARNER,
                     status=Translation.Status.REJECTED)

    assert error_code(propose(client, exercise.id, 'Rejected text')) == 'DUPLICATE'


def test_proposals_over_the_limit_are_refused(client, exercise, settings):
    settings.TRANSLATION_PROPOSALS_PER_HOUR = 2

    propose(client, exercise.id, 'One')
    propose(client, exercise.id, 'Two')
    body = propose(client, exercise.id, 'Three', client_id=str(uuid.uuid4()))

    assert error_code(body) == 'RATE_LIMITED'
    assert Translation.objects.count() == 2


def test_mutation_over_get_is_refused(client, published):
    response = client.get(GRAPHQL_URL, {
        'query': 'mutation { proposeTranslation(exerciseId: 1, language: "en", '
                 f'text: "Via GET", clientId: "{CLIENT}") {{ accepted }} }}',
    })

    assert response.status_code in (400, 405)
    assert not Translation.objects.filter(text='Via GET').exists()


def test_the_frontends_translations_query_fits_the_limits(client, db, settings):
    # Copied from src/frontend/src/stores/translation.js: the rest of a
    # 200-exercise deck in one request, ids as a variable so they cost no
    # tokens against STRAWBERRY_MAX_TOKENS.
    document = '''
      query Translations($ids: [ID!], $language: String!) {
        exercises(filters: { id: { inList: $ids } }) {
          id
          translation(language: $language) { id text origin upVotes downVotes }
        }
      }
    '''
    exercises = [make_exercise(index) for index in range(200)]
    make_translation(exercises[7], 'Seven')

    body = gql(client, document, {'ids': [str(e.id) for e in exercises], 'language': 'en'})

    assert 'errors' not in body
    assert len(body['data']['exercises']) == 200
    shown = {item['id']: item['translation'] for item in body['data']['exercises']}
    assert shown[str(exercises[7].id)]['text'] == 'Seven'
    assert shown[str(exercises[8].id)] is None
