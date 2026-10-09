import pytest

from exercises.translation.fixture import (
    DEFAULT_DIR,
    FixtureError,
    TranslationFixture,
    fixture_path,
)
from exercises.translation.providers import OfflineProvider, ProviderError, validated


@pytest.fixture
def path(tmp_path):
    return fixture_path(tmp_path, 'th')


def test_layout(tmp_path):
    assert fixture_path(tmp_path, 'th') == tmp_path / 'th.yaml'
    # The committed fixture sits in the app, so it ships in the image.
    assert DEFAULT_DIR.parts[-3:] == ('exercises', 'fixtures', 'translations')


def test_round_trip_keeps_awkward_text(path):
    awkward = 'He said: "no"\tthen # left\n\'again\' [x] {y} - z: yes'
    fixture = TranslationFixture('th', 'stub m')
    fixture.set('สวัสดีครับ', 'id-1', 'en', awkward)
    fixture.set('ลาก่อน', '', 'ru', 'Пока')

    fixture.save(path)
    loaded = TranslationFixture.load(path, 'th')

    assert loaded.records('en') == [('สวัสดีครับ', 'id-1', awkward)]
    assert loaded.records('ru') == [('ลาก่อน', '', 'Пока')]
    assert loaded.generated_by == 'stub m'
    assert 'สวัสดีครับ' in path.read_text(encoding='utf-8')


def test_saving_is_stable_and_ordered(path):
    fixture = TranslationFixture('th')
    fixture.set('ข', '', 'ru', 'b')
    fixture.set('ข', '', 'en', 'b')
    fixture.set('ก', '', 'en', 'a')
    fixture.save(path, ['en', 'ru'])
    first = path.read_bytes()

    TranslationFixture.load(path, 'th').save(path, ['en', 'ru'])

    assert path.read_bytes() == first
    text = first.decode()
    # Entries in the order they were added, languages in the given order.
    assert text.index('sentence: ข') < text.index('sentence: ก')
    assert text.index('en: b') < text.index('ru: b')


def test_a_missing_file_is_empty(path):
    fixture = TranslationFixture.load(path, 'th')

    assert fixture.entries == {}
    assert fixture.languages() == []


@pytest.mark.parametrize(('content', 'message'), [
    ('sentences: [unclosed', 'not valid YAML'),
    ('- just a list', 'not a format 1'),
    ('format: 2\nsource: th\n', 'not a format 1'),
    ('format: 1\nsource: lo\n', "'lo' sentences"),
])
def test_a_file_that_is_not_a_fixture_is_an_error(path, content, message):
    path.write_text(content, encoding='utf-8')

    with pytest.raises(FixtureError, match=message):
        TranslationFixture.load(path, 'th')


def test_entries_without_a_sentence_are_skipped(path):
    path.write_text(
        'format: 1\nsource: th\nsentences:\n- en: orphan\n- sentence: ก\n  en: a\n',
        encoding='utf-8',
    )

    assert TranslationFixture.load(path, 'th').records('en') == [('ก', '', 'a')]


def test_a_missing_language_is_untranslated(path):
    fixture = TranslationFixture('th')
    fixture.set('ก', '', 'en', 'a')

    assert fixture.translation('ก', 'en') == 'a'
    assert fixture.translation('ก', 'fr') is None
    assert fixture.translation('ข', 'en') is None
    assert fixture.records('fr') == []


# --- providers ----------------------------------------------------------------

def test_offline_provider_is_deterministic():
    assert OfflineProvider().translate(['ก', 'ข'], 'th', 'fr') == ['[fr] ก', '[fr] ข']
    assert OfflineProvider().generated_by == 'offline'


@pytest.mark.parametrize('result', [
    ['only one'],
    ['a', '   '],
    ['a', 3],
    'not a list',
    ['a', 'x' * 501],
])
def test_validated_refuses_unusable_results(result, settings):
    settings.TRANSLATION_MAX_LENGTH = 500

    with pytest.raises(ProviderError):
        validated(result, ['ก', 'ข'])


def test_validated_strips():
    assert validated([' a ', 'b\n'], ['ก', 'ข']) == ['a', 'b']
