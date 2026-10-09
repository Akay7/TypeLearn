"""Load the machine translations from the committed fixture into the catalog.

The fixture is the record; the machine rows in the database are a copy of it,
matched to exercises by sentence text (and by corpus sentence id, for an entry
whose sentence no longer matches). Idempotent: unchanged text is left alone,
ratings included. A changed text replaces the old one and clears its ratings,
which were cast on different words. Learner translations are never touched.
"""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction
from django.utils import timezone

from exercises.models import Exercise, Translation
from exercises.translation.fixture import (
    DEFAULT_DIR,
    FixtureError,
    TranslationFixture,
    fixture_path,
)

CHUNK = 1000


class Command(BaseCommand):
    help = 'Load machine translations from the translation fixture into the database.'

    def add_arguments(self, parser):
        parser.add_argument('--dir', dest='directory',
                            help='Where the fixture lives. Default: the committed one.')
        parser.add_argument('--languages',
                            help='Comma-separated targets to load. Default: all present.')

    def handle(self, *args, **options):
        source = settings.TRANSLATION_SOURCE_LANGUAGE
        path = fixture_path(Path(options['directory'] or DEFAULT_DIR), source)
        if not path.exists():
            # Before anyone has translated anything: not an error, and the
            # ingest Job runs this unconditionally.
            self.stdout.write(f'No {source} translations at {path}; nothing to load.')
            return
        try:
            fixture = TranslationFixture.load(path, source)
        except FixtureError as error:
            raise CommandError(str(error)) from error

        wanted = (
            {language.strip() for language in options['languages'].split(',') if language.strip()}
            if options['languages'] else None
        )
        for target in fixture.languages():
            if target == source or (wanted is not None and target not in wanted):
                continue
            if target not in settings.SUPPORTED_INTERFACE_LANGUAGES:
                self.stderr.write(f'{path}: {target!r} is not an interface language; skipped.')
                continue
            records = [
                {'sentence': sentence, 'sentence_id': sentence_id, 'text': text}
                for sentence, sentence_id, text in fixture.records(target)
            ]
            counts = self.load(target, records, fixture.generated_by[:64])
            self.stdout.write(self.style.SUCCESS(
                f'{source}->{target}: {counts["created"]} created, {counts["updated"]} updated, '
                f'{counts["unchanged"]} unchanged, {counts["unmatched"]} matched no exercise'
                + (f', {counts["conflicts"]} clashed with a learner translation'
                   if counts['conflicts'] else '')
                + (f', {counts["too_long"]} longer than {settings.TRANSLATION_MAX_LENGTH} '
                   'characters' if counts['too_long'] else '') + '.'
            ))

    def load(self, language, records, provider):
        counts = dict.fromkeys(
            ('created', 'updated', 'unchanged', 'unmatched', 'conflicts', 'too_long'), 0
        )
        for start in range(0, len(records), CHUNK):
            with transaction.atomic():
                self.load_chunk(language, records[start:start + CHUNK], provider, counts)
        return counts

    def load_chunk(self, language, records, provider, counts):
        by_sentence = dict(Exercise.objects.filter(
            sentence__in=[record['sentence'] for record in records]
        ).values_list('sentence', 'id'))
        # An entry whose sentence matches nothing may still name its corpus
        # sentence by id — the text was corrected upstream after translating.
        unmatched_ids = [record.get('sentence_id') for record in records
                         if record['sentence'] not in by_sentence and record.get('sentence_id')]
        by_sentence_id = dict(Exercise.objects.filter(
            sentence_id__in=unmatched_ids
        ).values_list('sentence_id', 'id')) if unmatched_ids else {}

        matched = {}
        for record in records:
            exercise_id = by_sentence.get(record['sentence']) or by_sentence_id.get(
                record.get('sentence_id') or None
            )
            if exercise_id is None:
                counts['unmatched'] += 1
            else:
                matched[exercise_id] = record

        existing = {
            translation.exercise_id: translation
            for translation in Translation.objects.filter(
                exercise_id__in=matched, language=language, origin=Translation.Origin.MACHINE
            )
        }
        now = timezone.now()
        for exercise_id, record in matched.items():
            text = record['text'].strip()
            if len(text) > settings.TRANSLATION_MAX_LENGTH:
                # A hand edit gone long: skipped and reported, rather than
                # failing the whole load on the column's limit.
                counts['too_long'] += 1
                continue
            current = existing.get(exercise_id)
            if current is not None and current.text == text:
                counts['unchanged'] += 1
                continue
            try:
                with transaction.atomic():
                    if current is None:
                        Translation.objects.create(
                            exercise_id=exercise_id, language=language, text=text,
                            origin=Translation.Origin.MACHINE,
                            status=Translation.Status.PUBLISHED,
                            provider=provider, published_at=now,
                        )
                        counts['created'] += 1
                    else:
                        current.ratings.all().delete()
                        current.text = text
                        current.provider = provider
                        current.up_votes = current.down_votes = 0
                        current.save(update_fields=['text', 'provider', 'up_votes', 'down_votes'])
                        counts['updated'] += 1
            except IntegrityError:
                # A learner already wrote exactly this text for this exercise:
                # their row stands for it, and a second copy could not exist.
                counts['conflicts'] += 1
