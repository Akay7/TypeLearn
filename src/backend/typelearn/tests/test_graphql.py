"""The project-wide GraphQL helpers: the input applier, on the project's own
models with inputs of its own so it is tested apart from the schema, and the
type every file field is published as."""
from collections import defaultdict
from enum import Enum

import pytest
import strawberry
import strawberry_django
from django.db import models
from strawberry import UNSET, auto
from strawberry_django.fields.types import OneToManyInput, field_type_map

from exercises.models import Exercise, Translation, TranslationRating
from typelearn.graphql import File, update_model_instance_based_on_input


@strawberry.enum
class Vote(Enum):
    UP = 1
    DOWN = -1


@strawberry_django.input(model=Translation)
class SuggestionInput:
    exercise: auto
    language: auto
    text: auto


@strawberry_django.input(model=TranslationRating)
class VoteInput:
    translation: auto
    value: Vote


def apply(data, instance):
    field_errors = defaultdict(list)
    update_model_instance_based_on_input(data, instance, field_errors)
    return field_errors


@pytest.fixture
def exercise(db):
    return Exercise.objects.create(sentence='ประโยค', original_audio='clips/0.mp3')


@pytest.mark.django_db()
def test_scalars_and_a_relation_are_set(exercise):
    text = 'Hello'
    suggestion = Translation()

    errors = apply(
        SuggestionInput(exercise=OneToManyInput(set=str(exercise.pk)), language='en', text=text),
        suggestion,
    )

    assert errors == {}
    assert (suggestion.exercise, suggestion.language, suggestion.text) == (exercise, 'en', text)


@pytest.mark.django_db()
def test_an_enum_is_set_by_its_value(exercise):
    translation = Translation.objects.create(
        exercise=exercise, language='en', text='Hello',
        origin=Translation.Origin.MACHINE, status=Translation.Status.PUBLISHED,
    )
    rating = TranslationRating()

    errors = apply(VoteInput(translation=OneToManyInput(set=translation.pk), value=Vote.DOWN),
                   rating)

    assert errors == {}
    assert (rating.translation, rating.value) == (translation, -1)


@pytest.mark.django_db()
@pytest.mark.parametrize('pk', ['999999', 'abc', None])
def test_a_relation_naming_no_row_is_not_found(pk):
    suggestion = Translation()

    errors = apply(SuggestionInput(exercise=OneToManyInput(set=pk), language='en', text='x'),
                   suggestion)

    assert list(errors) == ['exercise']
    assert len(errors['exercise']) == 1
    assert errors['exercise'][0].code == 'not_found'
    assert errors['exercise'][0].message == 'Not found.'
    assert suggestion.exercise_id is None


@pytest.mark.django_db()
def test_unset_fields_are_left_alone(exercise):
    kept_language, kept_text = 'fr', 'Kept'
    suggestion = Translation(language=kept_language, text=kept_text)

    errors = apply(
        SuggestionInput(exercise=OneToManyInput(set=str(exercise.pk)), language=UNSET, text=UNSET),
        suggestion,
    )

    assert errors == {}
    assert (suggestion.exercise, suggestion.language, suggestion.text) == (
        exercise, kept_language, kept_text)


@pytest.mark.parametrize('field_class', [models.FileField, models.ImageField])
def test_every_file_field_is_published_as_file(field_class):
    """Looked up by exact class, so each needs its own entry; without one the
    library's own type would publish the file's path on the server."""
    assert field_type_map[field_class] is File
