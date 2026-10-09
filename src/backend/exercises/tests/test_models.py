import pytest
from django.db import IntegrityError, transaction

from datetime import timedelta

from django.utils import timezone

from exercises.models import Exercise, Progress, Translation, TranslationRating


@pytest.mark.django_db
def test_duplicate_sentence_is_rejected():
    Exercise.objects.create(sentence='สวัสดีตอนเช้าครับ', original_audio='clips/a.mp3')

    with pytest.raises(IntegrityError), transaction.atomic():
        Exercise.objects.create(sentence='สวัสดีตอนเช้าครับ', original_audio='clips/b.mp3')

    assert Exercise.objects.count() == 1


@pytest.mark.django_db
def test_deleting_an_exercise_cascades_to_progress():
    exercise = Exercise.objects.create(sentence='ผมชอบกินข้าวผัด', original_audio='clips/a.mp3')
    Progress.objects.create(exercise=exercise, typed_text='ผมชอบ', is_correct=False, attempts=1)

    exercise.delete()

    assert Progress.objects.count() == 0


@pytest.mark.django_db
def test_progress_persists_its_attempt():
    exercise = Exercise.objects.create(sentence='วันนี้อากาศดีมาก', original_audio='clips/a.mp3')

    progress = Progress.objects.create(
        exercise=exercise, typed_text='วันนี้อากาศ', is_correct=False, attempts=2
    )
    progress.refresh_from_db()

    assert (progress.typed_text, progress.is_correct, progress.attempts) == (
        'วันนี้อากาศ',
        False,
        2,
    )


@pytest.mark.django_db
def test_longest_selectable_sentence_is_stored_without_truncation():
    # The selection filter caps sentences at 25 characters, far under max_length=255,
    # but a Thai character is three UTF-8 bytes — this pins that the column counts
    # characters, not bytes.
    sentence = 'ก' * 25

    Exercise.objects.create(sentence=sentence, original_audio='clips/a.mp3')

    assert Exercise.objects.get().sentence == sentence


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
    return Exercise.objects.create(sentence='สวัสดีตอนเช้าครับ', original_audio='clips/a.mp3')


def test_second_machine_translation_in_a_language_is_rejected(exercise):
    make_translation(exercise, 'Good morning')

    with pytest.raises(IntegrityError), transaction.atomic():
        make_translation(exercise, 'Morning greetings')

    # A machine translation in another language, and learner rows in the same
    # one, are unaffected by the constraint.
    make_translation(exercise, 'Bonjour', language='fr')
    make_translation(exercise, 'Hello', origin=Translation.Origin.LEARNER)
    assert Translation.objects.count() == 3


def test_identical_text_is_rejected_even_once_rejected(exercise):
    make_translation(
        exercise, 'Hello', origin=Translation.Origin.LEARNER, status=Translation.Status.REJECTED
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        make_translation(exercise, 'Hello', origin=Translation.Origin.LEARNER,
                         status=Translation.Status.PENDING)


def test_one_rating_per_client(exercise):
    translation = make_translation(exercise, 'Good morning')
    TranslationRating.objects.create(translation=translation, client_id='a', value=1)

    with pytest.raises(IntegrityError), transaction.atomic():
        TranslationRating.objects.create(translation=translation, client_id='a', value=-1)


def test_shown_first_prefers_net_rating_then_recency(exercise):
    now = timezone.now()
    machine = make_translation(exercise, 'Good morning', up_votes=0, down_votes=2,
                               published_at=now - timedelta(days=2))
    learner = make_translation(exercise, 'Morning!', origin=Translation.Origin.LEARNER,
                               up_votes=1, published_at=now - timedelta(days=1))

    assert Translation.objects.shown_first('en').first() == learner

    # A newer suggestion at the same net rating wins the tie.
    newer = make_translation(exercise, 'Good morning to you', origin=Translation.Origin.LEARNER,
                             up_votes=2, down_votes=1, published_at=now)
    assert Translation.objects.shown_first('en').first() == newer
    assert machine in Translation.objects.shown_first('en')


def test_shown_first_never_returns_unpublished_rows(exercise):
    for status in (Translation.Status.PENDING, Translation.Status.REJECTED):
        make_translation(exercise, f'text {status}', origin=Translation.Origin.LEARNER,
                         status=status, up_votes=10)

    assert not Translation.objects.shown_first('en').exists()
