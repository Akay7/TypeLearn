"""Select MVP exercises from a Common Voice release directory and load them.

Selection is a pure function of the corpus: the candidate rows are placed in a
total order and the first N distinct sentences win. There is no sampling and no
seed, so two runs over the same corpus always produce the same exercises.
"""
import csv
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from exercises.models import Exercise

# Selection filters, as specified in openspec/specs/corpus-ingestion.
MIN_UP_VOTES = 2
MIN_SENTENCE_LENGTH = 10
MAX_SENTENCE_LENGTH = 25
MAX_DURATION_MS = 6000

DEFAULT_COUNT = 100
DEFAULT_LOCALE = 'th'
DEFAULT_MANIFEST = 'validated.tsv'

# The manifest must carry both a clip path and vote counts. validated_sentences.tsv
# has neither, which is why it cannot be the selection source.
REQUIRED_MANIFEST_COLUMNS = ('path', 'up_votes', 'down_votes', 'sentence', 'sentence_id')

MEDIA_SUBDIR = 'clips'


def derive_difficulty(sentence_length, duration_ms):
    """Map sentence length and clip duration onto an integer 1-5 difficulty.

    Each input contributes up to 2.5 points across its own admissible range, so a
    short sentence with a short clip scores 1 and a long sentence with a long clip
    scores 5. Rounding is half-up rather than Python's banker's rounding, so the
    band boundaries land where a reader expects.
    """
    length_span = MAX_SENTENCE_LENGTH - MIN_SENTENCE_LENGTH
    length_score = 2.5 * (sentence_length - MIN_SENTENCE_LENGTH) / length_span
    duration_score = 2.5 * duration_ms / MAX_DURATION_MS

    total = _clamp(length_score, 0, 2.5) + _clamp(duration_score, 0, 2.5)
    return int(_clamp(int(total + 0.5), 1, 5))


def _clamp(value, low, high):
    return max(low, min(high, value))


def read_durations(path):
    """Read clip_durations.tsv into a {clip filename: duration in ms} dict."""
    durations = {}
    with path.open(encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle, delimiter='\t', quoting=csv.QUOTE_NONE)
        for row in reader:
            try:
                durations[row['clip']] = int(row['duration[ms]'])
            except (KeyError, TypeError, ValueError):
                continue
    return durations


def select_exercises(manifest_path, durations, clips_dir, count):
    """Return the `count` selected rows, ordered deterministically.

    Candidates are ordered by up_votes descending, then duration ascending, then
    sentence_id ascending. sentence_id breaks every remaining tie, so the order is
    total and does not depend on the order rows appear in the manifest.
    """
    candidates = []
    with manifest_path.open(encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle, delimiter='\t', quoting=csv.QUOTE_NONE)
        _require_columns(reader.fieldnames, manifest_path)

        for row in reader:
            candidate = _as_candidate(row, durations, clips_dir)
            if candidate is not None:
                candidates.append(candidate)

    candidates.sort(key=lambda c: (-c['up_votes'], c['duration_ms'], c['sentence_id']))

    selected = []
    seen_sentences = set()
    for candidate in candidates:
        if candidate['sentence'] in seen_sentences:
            continue
        seen_sentences.add(candidate['sentence'])
        selected.append(candidate)
        if len(selected) == count:
            break

    if len(selected) < count:
        raise CommandError(
            f'Only {len(selected)} candidate exercises matched the selection filters, '
            f'but {count} were requested. No exercises were loaded.'
        )
    return selected


def _require_columns(fieldnames, manifest_path):
    missing = [c for c in REQUIRED_MANIFEST_COLUMNS if c not in (fieldnames or [])]
    if missing:
        raise CommandError(
            f'{manifest_path} cannot be used as the selection source: it is missing the '
            f'{", ".join(missing)} column(s). Selection needs a manifest carrying both a '
            f'clip path and vote counts, which validated_sentences.tsv does not have — '
            f'use validated.tsv.'
        )


def _as_candidate(row, durations, clips_dir):
    """Apply the selection filters to one manifest row. None means rejected."""
    try:
        up_votes = int(row['up_votes'])
        down_votes = int(row['down_votes'])
    except (TypeError, ValueError):
        return None

    if up_votes < MIN_UP_VOTES or down_votes != 0:
        return None

    sentence = (row['sentence'] or '').strip()
    # len() counts Unicode code points, not bytes: a Thai character is three bytes
    # in UTF-8, so a byte count would admit sentences a third of the intended length.
    if not MIN_SENTENCE_LENGTH <= len(sentence) <= MAX_SENTENCE_LENGTH:
        return None

    clip_name = (row['path'] or '').strip()
    duration_ms = durations.get(clip_name)
    if duration_ms is None or duration_ms > MAX_DURATION_MS:
        return None

    clip_path = clips_dir / clip_name
    if not clip_path.is_file():
        return None

    return {
        'sentence': sentence,
        'sentence_id': (row.get('sentence_id') or '').strip(),
        'clip_name': clip_name,
        'clip_path': clip_path,
        'up_votes': up_votes,
        'duration_ms': duration_ms,
    }


class Command(BaseCommand):
    help = (
        'Select MVP exercises from a Common Voice release directory and load them '
        'into the database, copying their audio clips into MEDIA_ROOT.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'corpus_root',
            help='Path to the Common Voice release directory (holds the locale subdirectory).',
        )
        parser.add_argument(
            '--count', type=int, default=DEFAULT_COUNT,
            help=f'How many exercises to select (default: {DEFAULT_COUNT}).',
        )
        parser.add_argument(
            '--locale', default=DEFAULT_LOCALE,
            help=f'Corpus locale subdirectory (default: {DEFAULT_LOCALE}).',
        )
        parser.add_argument(
            '--manifest', default=DEFAULT_MANIFEST,
            help=f'Manifest file within the locale directory (default: {DEFAULT_MANIFEST}).',
        )

    def handle(self, *args, **options):
        locale_dir = Path(options['corpus_root']).expanduser() / options['locale']
        manifest_path = locale_dir / options['manifest']
        durations_path = locale_dir / 'clip_durations.tsv'
        clips_dir = locale_dir / 'clips'

        for path in (manifest_path, durations_path):
            if not path.is_file():
                raise CommandError(f'Corpus file not found: {path}')
        if not clips_dir.is_dir():
            raise CommandError(f'Corpus clips directory not found: {clips_dir}')

        durations = read_durations(durations_path)
        selected = select_exercises(manifest_path, durations, clips_dir, options['count'])

        media_dir = Path(settings.MEDIA_ROOT) / MEDIA_SUBDIR
        media_dir.mkdir(parents=True, exist_ok=True)

        created = updated = copied = 0
        for candidate in selected:
            if self._copy_clip(candidate['clip_path'], media_dir / candidate['clip_name']):
                copied += 1

            _, was_created = Exercise.objects.update_or_create(
                sentence=candidate['sentence'],
                defaults={
                    'sentence_id': candidate['sentence_id'],
                    'original_audio': f'{MEDIA_SUBDIR}/{candidate["clip_name"]}',
                    'up_votes': candidate['up_votes'],
                    'difficulty': derive_difficulty(
                        len(candidate['sentence']), candidate['duration_ms']
                    ),
                },
            )
            created += was_created
            updated += not was_created

        self.stdout.write(self.style.SUCCESS(
            f'Loaded {len(selected)} exercises: {created} created, {updated} already '
            f'existed and were updated. Copied {copied} clips into {media_dir}.'
        ))

    def _copy_clip(self, source, destination):
        """Copy a clip unless an identical-size file is already there. True if copied."""
        if destination.exists() and destination.stat().st_size == source.stat().st_size:
            return False
        shutil.copyfile(source, destination)
        return True
