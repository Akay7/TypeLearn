"""A miniature corpus on disk, so ingestion tests need neither the real 40 GB
release directory nor a network."""
import csv

import pytest

MANIFEST_COLUMNS = [
    'client_id', 'path', 'sentence_id', 'sentence', 'sentence_domain', 'up_votes',
    'down_votes', 'age', 'gender', 'accents', 'variant', 'locale', 'segment',
]

# 15 characters: inside the 10-25 filter, so a row is valid unless a test says otherwise.
DEFAULT_SENTENCE = 'ก' * 15


def clip_row(index=0, **overrides):
    """One manifest row plus its duration, with corpus-valid defaults."""
    row = {
        'path': f'common_voice_th_{index:08d}.mp3',
        'sentence_id': f'sentence-{index:08d}',
        'sentence': f'{DEFAULT_SENTENCE[:-1]}{index % 10}',
        'up_votes': 2,
        'down_votes': 0,
        'duration_ms': 3000,
        'clip_exists': True,
    }
    row.update(overrides)
    return row


@pytest.fixture
def build_corpus(tmp_path):
    """Write a corpus of the given rows and return its release-directory path."""

    def _build(rows, locale='th', manifest='validated.tsv', columns=MANIFEST_COLUMNS):
        locale_dir = tmp_path / 'cv-corpus-test' / locale
        clips_dir = locale_dir / 'clips'
        clips_dir.mkdir(parents=True, exist_ok=True)

        with (locale_dir / manifest).open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(
                handle, fieldnames=columns, delimiter='\t',
                quoting=csv.QUOTE_NONE, extrasaction='ignore',
            )
            writer.writeheader()
            for row in rows:
                writer.writerow({column: row.get(column, '') for column in columns})

        with (locale_dir / 'clip_durations.tsv').open('w', encoding='utf-8', newline='') as handle:
            handle.write('clip\tduration[ms]\n')
            for row in rows:
                if row.get('duration_ms') is not None:
                    handle.write(f'{row["path"]}\t{row["duration_ms"]}\n')

        for row in rows:
            if row.get('clip_exists', True):
                (clips_dir / row['path']).write_bytes(b'\xff\xfb' + row['path'].encode())

        return locale_dir.parent

    return _build


@pytest.fixture
def media_root(settings, tmp_path):
    """Keep copied clips out of the developer's real MEDIA_ROOT."""
    settings.MEDIA_ROOT = tmp_path / 'media'
    return settings.MEDIA_ROOT
