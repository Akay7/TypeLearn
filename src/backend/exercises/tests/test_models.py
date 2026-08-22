import pytest
from django.db import IntegrityError, transaction

from exercises.models import Exercise, Progress


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
