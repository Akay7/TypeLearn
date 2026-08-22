import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from exercises.management.commands.load_corpus import derive_difficulty
from exercises.models import Exercise
from exercises.tests.conftest import MANIFEST_COLUMNS, clip_row

pytestmark = pytest.mark.django_db


def load(corpus_root, count=1, **options):
    call_command('load_corpus', str(corpus_root), count=count, **options)


def test_loads_the_requested_number_of_exercises(build_corpus, media_root):
    corpus = build_corpus([clip_row(i) for i in range(5)])

    load(corpus, count=3)

    assert Exercise.objects.count() == 3
    for exercise in Exercise.objects.all():
        assert (media_root / exercise.original_audio.name).is_file()


@pytest.mark.parametrize(
    'rejected',
    [
        pytest.param({'up_votes': 1}, id='too_few_up_votes'),
        pytest.param({'down_votes': 1}, id='has_a_down_vote'),
        pytest.param({'sentence': 'ก' * 9}, id='sentence_too_short'),
        pytest.param({'sentence': 'ก' * 26}, id='sentence_too_long'),
        pytest.param({'duration_ms': 6001}, id='clip_too_long'),
        pytest.param({'duration_ms': None}, id='no_duration_recorded'),
        pytest.param({'clip_exists': False}, id='clip_file_missing'),
    ],
)
def test_each_filter_rejects_its_own_case(build_corpus, media_root, rejected):
    good = clip_row(0)
    bad = clip_row(1, **rejected)
    corpus = build_corpus([good, bad])

    load(corpus, count=1)

    assert [e.sentence for e in Exercise.objects.all()] == [good['sentence']]


@pytest.mark.parametrize('length', [10, 25])
def test_length_boundaries_are_inclusive_and_counted_in_code_points(
    build_corpus, media_root, length
):
    # Thai characters are three UTF-8 bytes and these sentences carry combining
    # vowel and tone marks, so a byte count or a grapheme count would both differ
    # from the code-point count the filter is specified in.
    sentence = ('เก่ง' * 10)[:length]
    assert len(sentence) == length
    corpus = build_corpus([clip_row(0, sentence=sentence)])

    load(corpus, count=1)

    assert Exercise.objects.get().sentence == sentence


def test_duplicate_sentences_collapse_to_the_highest_voted_clip(build_corpus, media_root):
    weak = clip_row(0, sentence='ก' * 15, up_votes=2)
    strong = clip_row(1, sentence='ก' * 15, up_votes=9)
    corpus = build_corpus([weak, strong])

    load(corpus, count=1)

    exercise = Exercise.objects.get()
    assert exercise.up_votes == 9
    assert exercise.original_audio.name.endswith(strong['path'])


def test_ties_on_votes_and_duration_resolve_by_sentence_id(build_corpus, media_root):
    later = clip_row(0, sentence='ก' * 15, sentence_id='sentence-b')
    earlier = clip_row(1, sentence='ข' * 15, sentence_id='sentence-a')
    # Written in the order that would win if input order leaked into the result.
    corpus = build_corpus([later, earlier])

    load(corpus, count=1)

    assert Exercise.objects.get().sentence_id == 'sentence-a'


def test_two_runs_select_the_same_exercises_in_the_same_order(build_corpus, media_root):
    corpus = build_corpus([clip_row(i, up_votes=2 + i % 3) for i in range(12)])

    load(corpus, count=4)
    first = list(Exercise.objects.order_by('id').values_list('sentence_id', flat=True))
    Exercise.objects.all().delete()
    load(corpus, count=4)
    second = list(Exercise.objects.order_by('id').values_list('sentence_id', flat=True))

    assert first == second


def test_rerunning_does_not_duplicate_rows(build_corpus, media_root):
    corpus = build_corpus([clip_row(i) for i in range(5)])

    load(corpus, count=3)
    created_at = {e.sentence: e.created_at for e in Exercise.objects.all()}
    load(corpus, count=3)

    assert Exercise.objects.count() == 3
    assert {e.sentence: e.created_at for e in Exercise.objects.all()} == created_at


def test_too_few_candidates_fails_without_writing_rows(build_corpus, media_root):
    corpus = build_corpus([clip_row(i) for i in range(2)])

    with pytest.raises(CommandError, match=r'Only 2 candidate exercises'):
        load(corpus, count=100)

    assert Exercise.objects.count() == 0


def test_missing_corpus_names_the_path_it_looked_for(tmp_path, media_root):
    with pytest.raises(CommandError, match=r'validated\.tsv'):
        load(tmp_path / 'not-a-corpus', count=1)

    assert Exercise.objects.count() == 0


def test_sentence_only_manifest_is_rejected_naming_its_missing_columns(
    build_corpus, media_root
):
    # validated_sentences.tsv carries neither up_votes nor a clip path.
    columns = ['sentence_id', 'sentence', 'variant', 'sentence_domain', 'source',
               'is_used', 'clips_count']
    corpus = build_corpus(
        [clip_row(0)], manifest='validated_sentences.tsv', columns=columns
    )

    with pytest.raises(CommandError) as failure:
        load(corpus, count=1, manifest='validated_sentences.tsv')

    message = str(failure.value)
    assert 'path' in message and 'up_votes' in message
    assert Exercise.objects.count() == 0


def test_difficulty_stays_in_range_and_rises_with_length_and_duration(
    build_corpus, media_root
):
    easiest = derive_difficulty(10, 0)
    hardest = derive_difficulty(25, 6000)

    assert easiest == 1 and hardest == 5
    assert easiest < derive_difficulty(18, 3000) < hardest
    # Out-of-range inputs still clamp rather than escaping the 1-5 scale.
    assert derive_difficulty(0, 0) == 1
    assert derive_difficulty(500, 99000) == 5


def test_loaded_exercises_carry_a_difficulty_in_range(build_corpus, media_root):
    corpus = build_corpus([
        clip_row(i, sentence='ก' * (10 + i), duration_ms=500 * (i + 1)) for i in range(10)
    ])

    load(corpus, count=10)

    assert all(1 <= e.difficulty <= 5 for e in Exercise.objects.all())


def test_reports_what_it_did(build_corpus, media_root, capsys):
    corpus = build_corpus([clip_row(i) for i in range(3)])

    load(corpus, count=3)
    load(corpus, count=3)

    output = capsys.readouterr().out
    assert '3 created' in output
    assert '3 already existed' in output


def test_manifest_columns_cover_the_real_header():
    # Guards the fixture against drifting from the corpus the command reads.
    for column in ('path', 'sentence_id', 'sentence', 'up_votes', 'down_votes'):
        assert column in MANIFEST_COLUMNS
