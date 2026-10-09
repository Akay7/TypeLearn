"""translate_catalog fills the fixture from the corpus; load_translations copies
it into the catalog. A counting stub stands in for the provider, so every test
can say exactly how many requests a run made."""
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from exercises.management.commands import translate_catalog
from exercises.models import Exercise, Translation, TranslationRating
from exercises.tests.conftest import clip_row
from exercises.translation.fixture import TranslationFixture, fixture_path
from exercises.translation.providers import OfflineProvider, ProviderError


class CountingProvider(OfflineProvider):
    """Offline output, counting requests, failing the batches it is told to."""

    name = 'stub'
    model = 'm'
    placeholder = False

    def __init__(self, fail_containing=()):
        self.requests = []
        self.fail_containing = set(fail_containing)

    def translate(self, sentences, source, target):
        self.requests.append((target, list(sentences)))
        if self.fail_containing & set(sentences):
            raise ProviderError('stubbed failure')
        return super().translate(sentences, source, target)


@pytest.fixture
def stub(monkeypatch):
    provider = CountingProvider()
    monkeypatch.setattr(translate_catalog, 'get_provider', lambda *args, **kwargs: provider)
    return provider


@pytest.fixture
def directory(tmp_path, settings, monkeypatch):
    """A fixture directory of the test's own, standing in for the committed one."""
    settings.SUPPORTED_INTERFACE_LANGUAGES = ['en', 'fr', 'th']
    settings.TRANSLATION_SOURCE_LANGUAGE = 'th'
    root = tmp_path / 'translations'
    for module in ('translate_catalog', 'load_translations'):
        monkeypatch.setattr(f'exercises.management.commands.{module}.DEFAULT_DIR', root)
    return root


def sentence(index):
    return clip_row(index)['sentence']


@pytest.fixture
def corpus(build_corpus):
    """A release with the given number of selectable sentences, 0..count-1 in
    selection order (vote counts descending)."""

    def _corpus(count):
        return build_corpus([clip_row(index, up_votes=100 - index) for index in range(count)])

    return _corpus


def translate(corpus_root, **options):
    call_command('translate_catalog', str(corpus_root), batch_size=2, **options)


def load_fixture(root):
    return TranslationFixture.load(fixture_path(root, 'th'), 'th')


def translated(root, language):
    return {sentence: text for sentence, _, text in load_fixture(root).records(language)}


def make_exercises(count):
    return [
        Exercise.objects.create(sentence=sentence(index), sentence_id=f'sentence-{index:08d}',
                                original_audio=f'clips/{index}.mp3')
        for index in range(count)
    ]


# --- translate_catalog ------------------------------------------------------

def test_a_fresh_run_writes_every_default_target(stub, directory, corpus):
    translate(corpus(3))

    for target in ('en', 'fr'):
        assert translated(directory, target) == {
            sentence(index): f'[{target}] {sentence(index)}' for index in range(3)
        }
    fixture = load_fixture(directory)
    assert fixture.entries[sentence(1)]['sentence_id'] == 'sentence-00000001'
    assert fixture.generated_by == 'stub m'
    # Never the source language.
    assert 'th' not in fixture.languages()


def test_the_file_reads_as_one_entry_per_sentence(stub, directory, corpus):
    translate(corpus(1), languages='fr,en')

    text = fixture_path(directory, 'th').read_text(encoding='utf-8')
    # Unicode as itself, and languages in interface order whatever the run's order.
    assert f'- sentence: {sentence(0)}\n  sentence_id: sentence-00000000\n' \
           f'  en: \'[en] {sentence(0)}\'\n  fr: \'[fr] {sentence(0)}\'\n' in text
    assert text.startswith('# ')


@pytest.mark.django_db
def test_translating_touches_no_database(stub, directory, corpus, django_assert_num_queries):
    with django_assert_num_queries(0):
        translate(corpus(2))
    assert not Translation.objects.exists()


def test_a_rerun_makes_no_requests_and_changes_nothing(stub, directory, corpus):
    root = corpus(3)
    translate(root, languages='en')
    before = fixture_path(directory, 'th').read_bytes()
    stub.requests.clear()

    translate(root, languages='en')

    assert stub.requests == []
    assert fixture_path(directory, 'th').read_bytes() == before


def test_a_failed_batch_is_reported_skipped_and_retried_next_run(stub, directory, corpus):
    root = corpus(4)
    stub.fail_containing = {sentence(2)}

    with pytest.raises(CommandError, match='1 batch'):
        translate(root, languages='en')

    assert set(translated(directory, 'en')) == {sentence(0), sentence(1)}

    stub.fail_containing = set()
    stub.requests.clear()
    translate(root, languages='en')

    assert stub.requests == [('en', [sentence(2), sentence(3)])]
    assert len(translated(directory, 'en')) == 4


def test_an_interrupted_run_keeps_what_came_back(stub, directory, corpus, monkeypatch):
    root = corpus(4)
    original = stub.translate

    def interrupted(sentences, source, target):
        if sentence(2) in sentences:
            raise KeyboardInterrupt
        return original(sentences, source, target)

    monkeypatch.setattr(stub, 'translate', interrupted)
    with pytest.raises(KeyboardInterrupt):
        translate(root, languages='en')

    assert set(translated(directory, 'en')) == {sentence(0), sentence(1)}


def test_only_missing_languages_and_sentences_are_requested(stub, directory, build_corpus):
    rows = [clip_row(index, up_votes=100 - index) for index in range(3)]
    translate(build_corpus(rows[:2]), languages='en')
    stub.requests.clear()

    translate(build_corpus(rows), languages='en,fr')

    assert stub.requests == [
        ('en', [sentence(2)]),
        ('fr', [sentence(0), sentence(1)]),
        ('fr', [sentence(2)]),
    ]


def test_a_hand_correction_is_kept(stub, directory, corpus):
    root = corpus(1)
    translate(root, languages='en')
    fixture = load_fixture(directory)
    fixture.set(sentence(0), '', 'en', 'Corrected by hand')
    fixture.save(fixture_path(directory, 'th'))

    translate(root)

    assert translated(directory, 'en') == {sentence(0): 'Corrected by hand'}


def test_limit_caps_a_trial_run(stub, directory, corpus):
    translate(corpus(5), languages='en', limit=3)

    assert len(translated(directory, 'en')) == 3


@pytest.mark.parametrize('languages', ['th', 'xx', 'en,xx'])
def test_untranslatable_targets_are_refused(stub, directory, corpus, languages):
    with pytest.raises(CommandError, match='Cannot translate'):
        translate(corpus(1), languages=languages)


def test_offline_provider_refuses_the_committed_fixture(directory, corpus):
    with pytest.raises(CommandError, match='--dir'):
        call_command('translate_catalog', str(corpus(1)), provider='offline')

    assert not directory.exists()


def test_offline_provider_writes_to_an_explicit_directory(directory, corpus, tmp_path):
    scratch = tmp_path / 'offline'

    call_command('translate_catalog', str(corpus(1)), provider='offline',
                 directory=str(scratch), languages='fr')

    assert translated(scratch, 'fr') == {sentence(0): f'[fr] {sentence(0)}'}
    assert not directory.exists()


def test_missing_key_fails_before_translating(directory, corpus, monkeypatch):
    for variable in ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_PROFILE'):
        monkeypatch.delenv(variable, raising=False)

    with pytest.raises(CommandError, match='ANTHROPIC_API_KEY'):
        call_command('translate_catalog', str(corpus(1)), provider='anthropic')

    assert not directory.exists()


def test_a_missing_corpus_is_named(stub, directory, tmp_path):
    with pytest.raises(CommandError, match='Corpus file not found'):
        translate(tmp_path / 'nowhere')


# --- load_translations ------------------------------------------------------

def write_fixture(root, entries, generated_by='stub m'):
    fixture = TranslationFixture('th', generated_by)
    for entry in entries:
        for language, text in entry.items():
            if language not in ('sentence', 'sentence_id'):
                fixture.set(entry['sentence'], entry.get('sentence_id', ''), language, text)
    fixture.save(fixture_path(root, 'th'))


def machine_texts(language='en'):
    return dict(Translation.objects.filter(
        language=language, origin=Translation.Origin.MACHINE
    ).values_list('exercise__sentence', 'text'))


@pytest.mark.django_db
def test_loading_into_a_fresh_catalog(directory):
    make_exercises(2)
    write_fixture(directory, [{'sentence': sentence(0), 'en': 'Zero', 'fr': 'Zéro'},
                              {'sentence': sentence(1), 'en': 'One'}])

    call_command('load_translations')

    assert machine_texts('en') == {sentence(0): 'Zero', sentence(1): 'One'}
    assert machine_texts('fr') == {sentence(0): 'Zéro'}
    row = Translation.objects.get(text='Zero')
    assert row.status == Translation.Status.PUBLISHED
    assert row.published_at is not None
    assert row.provider == 'stub m'


@pytest.mark.django_db
def test_reloading_changes_nothing_and_keeps_ratings(directory):
    make_exercises(1)
    write_fixture(directory, [{'sentence': sentence(0), 'en': 'Zero'}])
    call_command('load_translations')
    row = Translation.objects.get()
    TranslationRating.objects.create(translation=row, client_id='a', value=1)
    Translation.objects.filter(pk=row.pk).update(up_votes=1)

    call_command('load_translations')

    row.refresh_from_db()
    assert (Translation.objects.count(), row.up_votes, TranslationRating.objects.count()) == (1, 1, 1)


@pytest.mark.django_db
def test_changed_text_replaces_it_and_clears_its_ratings(directory):
    make_exercises(1)
    write_fixture(directory, [{'sentence': sentence(0), 'en': 'Zero'}])
    call_command('load_translations')
    row = Translation.objects.get()
    TranslationRating.objects.create(translation=row, client_id='a', value=-1)
    Translation.objects.filter(pk=row.pk).update(down_votes=1)

    write_fixture(directory, [{'sentence': sentence(0), 'en': 'Nought'}])
    call_command('load_translations')

    row.refresh_from_db()
    assert (row.text, row.down_votes) == ('Nought', 0)
    assert not TranslationRating.objects.exists()


@pytest.mark.django_db
def test_learner_rows_are_never_touched(directory):
    exercise, = make_exercises(1)
    learner = Translation.objects.create(
        exercise=exercise, language='en', text='Mine', origin=Translation.Origin.LEARNER,
        status=Translation.Status.PENDING,
    )
    write_fixture(directory, [{'sentence': sentence(0), 'en': 'Machine'}])

    call_command('load_translations')

    learner.refresh_from_db()
    assert (learner.text, learner.status) == ('Mine', Translation.Status.PENDING)
    assert machine_texts() == {sentence(0): 'Machine'}


@pytest.mark.django_db
def test_unmatched_entries_are_counted_not_errors(directory, capsys):
    make_exercises(1)
    write_fixture(directory, [{'sentence': sentence(0), 'en': 'Zero'},
                              {'sentence': 'not in this catalog', 'en': 'Elsewhere'}])

    call_command('load_translations')

    assert machine_texts() == {sentence(0): 'Zero'}
    assert '1 matched no exercise' in capsys.readouterr().out


@pytest.mark.django_db
def test_sentence_id_matches_when_the_text_changed_upstream(directory):
    make_exercises(1)
    write_fixture(directory, [{'sentence': 'old wording', 'sentence_id': 'sentence-00000000',
                               'en': 'Zero'}])

    call_command('load_translations')

    assert machine_texts() == {sentence(0): 'Zero'}


@pytest.mark.django_db
def test_an_over_long_hand_edit_is_skipped_not_fatal(directory, settings, capsys):
    settings.TRANSLATION_MAX_LENGTH = 5
    make_exercises(2)
    write_fixture(directory, [{'sentence': sentence(0), 'en': 'Far too long'},
                              {'sentence': sentence(1), 'en': 'One'}])

    call_command('load_translations')

    assert machine_texts() == {sentence(1): 'One'}
    assert '1 longer than 5 characters' in capsys.readouterr().out


@pytest.mark.django_db
def test_no_fixture_is_a_quiet_no_op(directory, capsys):
    call_command('load_translations')

    assert 'nothing to load' in capsys.readouterr().out
    assert not Translation.objects.exists()


@pytest.mark.django_db
def test_a_broken_fixture_fails_loudly(directory):
    directory.mkdir()
    fixture_path(directory, 'th').write_text('sentences: [unclosed', encoding='utf-8')

    with pytest.raises(CommandError, match='not valid YAML'):
        call_command('load_translations')


@pytest.mark.django_db
def test_a_rebuilt_database_is_restored_with_no_provider_requests(stub, directory, corpus):
    root = corpus(3)
    translate(root)
    make_exercises(3)
    call_command('load_translations')
    before = {language: machine_texts(language) for language in ('en', 'fr')}

    # The database goes; the fixture stays.
    Exercise.objects.all().delete()
    make_exercises(3)
    stub.requests.clear()
    translate(root)
    call_command('load_translations')

    assert stub.requests == []
    assert {language: machine_texts(language) for language in ('en', 'fr')} == before
    assert len(before['en']) == 3
