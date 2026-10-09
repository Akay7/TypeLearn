import pytest
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from exercises.admin import recount_votes
from exercises.models import Exercise, Translation, TranslationRating

CHANGELIST = reverse('admin:exercises_translation_changelist')


@pytest.fixture
def staff_client(client, db):
    client.force_login(User.objects.create_superuser('mod', 'mod@example.com', 'x'))
    return client


@pytest.fixture
def exercise(db):
    return Exercise.objects.create(sentence='สวัสดี', original_audio='clips/a.mp3')


@pytest.fixture
def machine(exercise):
    return Translation.objects.create(
        exercise=exercise, language='en', text='Hello', origin=Translation.Origin.MACHINE,
        status=Translation.Status.PUBLISHED, published_at=timezone.now(),
    )


@pytest.fixture
def suggestion(exercise):
    return Translation.objects.create(
        exercise=exercise, language='en', text='Hi there', origin=Translation.Origin.LEARNER,
        status=Translation.Status.PENDING,
    )


def run_action(client, action, *translations):
    # The action applies within the changelist's filter, which opens on pending
    # rows; `all` is what a moderator picks to reach published ones.
    return client.post(f'{CHANGELIST}?status=all', {
        'action': action, '_selected_action': [t.pk for t in translations],
    })


def shown(language='en'):
    return Translation.objects.shown_first(language).first()


def test_changelist_opens_on_pending_suggestions(staff_client, machine, suggestion):
    response = staff_client.get(CHANGELIST)

    assert response.status_code == 200
    listed = list(response.context['cl'].queryset)
    assert listed == [suggestion]
    # Shown next to the machine translation it would replace.
    assert b'Hello' in response.content


def test_approving_publishes_and_becomes_shown(staff_client, machine, suggestion):
    assert shown() == machine

    run_action(staff_client, 'approve', suggestion)

    suggestion.refresh_from_db()
    assert suggestion.status == Translation.Status.PUBLISHED
    assert suggestion.published_at is not None
    assert shown() == suggestion


def test_rejecting_hides_it(staff_client, machine, suggestion):
    run_action(staff_client, 'reject', suggestion)

    suggestion.refresh_from_db()
    assert suggestion.status == Translation.Status.REJECTED
    assert shown() == machine


def test_recount_repairs_drifted_counts(staff_client, machine):
    for client_id, value in [('a', 1), ('b', 1), ('c', -1)]:
        TranslationRating.objects.create(translation=machine, client_id=client_id, value=value)
    Translation.objects.filter(pk=machine.pk).update(up_votes=40, down_votes=0)

    run_action(staff_client, 'recount', machine)

    machine.refresh_from_db()
    assert (machine.up_votes, machine.down_votes) == (2, 1)


def test_recount_zeroes_a_translation_with_no_ratings(machine):
    Translation.objects.filter(pk=machine.pk).update(up_votes=3, down_votes=3)

    recount_votes(Translation.objects.all())

    machine.refresh_from_db()
    assert (machine.up_votes, machine.down_votes) == (0, 0)
