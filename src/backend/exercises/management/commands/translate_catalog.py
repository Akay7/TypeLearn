"""Machine-translate the corpus's selected sentences into the translation fixture.

Run once, on a developer's machine, with the provider's key exported in that
shell; the result is committed and every database loads it with
`load_translations`. The sentences come straight from the Common Voice release,
chosen by the same selection ingestion makes, so no database or cluster is
needed. A language an entry already has is never requested again, so a re-run
costs nothing and an interrupted one picks up where it stopped. See
exercises/translation/fixture.py for the format.
"""
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from exercises.management.commands.load_corpus import DEFAULT_MANIFEST, select_from_release
from exercises.translation.fixture import (
    DEFAULT_DIR,
    FixtureError,
    TranslationFixture,
    fixture_path,
)
from exercises.translation.providers import (
    ProviderConfigurationError,
    ProviderError,
    get_provider,
)

DEFAULT_BATCH_SIZE = 25
# Rewriting the whole file after every batch would cost more than the batch on
# a full catalog; this bounds what an interruption can lose instead.
SAVE_EVERY_SECONDS = 30


def split_languages(value):
    return [language.strip() for language in value.split(',') if language.strip()]


class Command(BaseCommand):
    help = 'Machine-translate the corpus sentences ingestion selects into the translation fixture.'

    def add_arguments(self, parser):
        parser.add_argument(
            'corpus_root',
            help='Path to the Common Voice release directory (holds the locale subdirectory).',
        )
        parser.add_argument(
            '--locale',
            help='The corpus locale, which is the source language. '
                 'Default: TRANSLATION_SOURCE_LANGUAGE.',
        )
        parser.add_argument(
            '--manifest', default=DEFAULT_MANIFEST,
            help=f'Manifest file within the locale directory (default: {DEFAULT_MANIFEST}).',
        )
        parser.add_argument(
            '--languages',
            help='Comma-separated targets. Default: every interface language except the source.',
        )
        parser.add_argument(
            '--provider', default='anthropic', help='anthropic, openai-compatible (a local server) or offline. Default: anthropic.'
        )
        parser.add_argument('--model', default='', help="Default: the provider's own.")
        parser.add_argument(
            '--base-url', default='',
            help='For openai-compatible: the server API root. '
                 'Default: http://localhost:8000/api/v1 (Lemonade).',
        )
        parser.add_argument(
            '--effort', default='',
            help="The model's effort level (low, medium, high, xhigh, max). "
                 "Default: the API's.",
        )
        parser.add_argument(
            '--no-refusal-fallback', dest='refusal_fallback', action='store_false',
            help="Don't re-run a declined batch on the fallback model.",
        )
        parser.add_argument(
            '--batch-size', type=int, default=DEFAULT_BATCH_SIZE,
            help=f'Sentences per provider request. Default: {DEFAULT_BATCH_SIZE}.',
        )
        parser.add_argument(
            '--limit', type=int,
            help='Translate at most this many new sentences per language — for a trial run.',
        )
        parser.add_argument(
            '--dir', dest='directory',
            help='Where the fixture lives. Default: the committed one. Required for offline.',
        )

    def handle(self, *args, **options):
        source = options['locale'] or settings.TRANSLATION_SOURCE_LANGUAGE
        translatable = [
            language for language in settings.SUPPORTED_INTERFACE_LANGUAGES if language != source
        ]
        targets = split_languages(options['languages']) if options['languages'] else translatable
        unknown = [language for language in targets if language not in translatable]
        if unknown:
            raise CommandError(
                f'Cannot translate into {", ".join(unknown)}: targets are '
                f'{", ".join(translatable)} (the interface languages other than {source}).'
            )
        if options['batch_size'] < 1:
            raise CommandError('--batch-size must be at least 1.')
        if options['limit'] is not None and options['limit'] < 1:
            raise CommandError('--limit must be at least 1.')

        try:
            provider = get_provider(options['provider'], options['model'], options['effort'],
                                    options['refusal_fallback'], options['base_url'])
        except ProviderConfigurationError as error:
            raise CommandError(str(error)) from error

        if provider.placeholder and not options['directory']:
            # The default is the committed fixture every database loads from;
            # placeholders written there would be loaded as real.
            raise CommandError(
                f'The {provider.name} provider writes placeholders, so it needs an explicit '
                '--dir away from the committed fixture.'
            )
        path = fixture_path(Path(options['directory'] or DEFAULT_DIR), source)
        try:
            fixture = TranslationFixture.load(path, source)
        except FixtureError as error:
            raise CommandError(str(error)) from error
        if not fixture.generated_by:
            fixture.generated_by = provider.generated_by
        elif fixture.generated_by != provider.generated_by:
            self.stderr.write(
                f'{path} says it was generated by {fixture.generated_by!r}; this run uses '
                f'{provider.generated_by!r}. The file keeps its own label.'
            )

        selected = select_from_release(options['corpus_root'], source, options['manifest'],
                                       count=None)
        self.stdout.write(f'{len(selected)} {source} sentences selected from the corpus.')

        run = Run(self, fixture, path)
        try:
            for target in targets:
                self.translate_language(provider, fixture, run, selected, source, target,
                                        options['batch_size'], options['limit'])
        finally:
            # Also on Ctrl-C and on a configuration error mid-run: every batch
            # that came back is kept.
            run.save()

        if run.failures:
            for target, first, count, reason in run.failures:
                self.stderr.write(f'  {target}: {count} sentences from {first!r}: {reason}')
            raise CommandError(
                f'{len(run.failures)} batch(es) failed and were not written. '
                'Run again to retry them.'
            )
        self.stdout.write(self.style.SUCCESS(f'Translations are complete in {path}.'))

    def translate_language(self, provider, fixture, run, selected, source, target,
                           batch_size, limit):
        pending = [candidate for candidate in selected
                   if fixture.translation(candidate['sentence'], target) is None]
        done = len(selected) - len(pending)
        if limit is not None:
            pending = pending[:limit]
        self.stdout.write(
            f'{source}->{target}: {done} already translated, {len(pending)} to translate.'
        )
        written = 0
        for start in range(0, len(pending), batch_size):
            batch = pending[start:start + batch_size]
            texts = [candidate['sentence'] for candidate in batch]
            try:
                translations = provider.translate(texts, source, target)
            except ProviderError as error:
                run.failures.append((target, texts[0], len(texts), str(error)))
                self.stderr.write(f'{source}->{target}: batch failed: {error}')
                continue
            except ProviderConfigurationError as error:
                raise CommandError(str(error)) from error
            for candidate, text in zip(batch, translations):
                fixture.set(candidate['sentence'], candidate['sentence_id'], target, text)
            run.changed = True
            written += len(batch)
            self.stdout.write(f'{source}->{target}: {written} of {len(pending)} translated.')
            run.save_if_due()


class Run:
    """When the fixture is next written, and what failed along the way."""

    def __init__(self, command, fixture, path):
        self.command = command
        self.fixture = fixture
        self.path = path
        self.changed = False
        self.failures = []
        self.saved_at = time.monotonic()

    def save_if_due(self):
        if time.monotonic() - self.saved_at >= SAVE_EVERY_SECONDS:
            self.save()

    def save(self):
        if not self.changed:
            return
        self.fixture.save(self.path, settings.SUPPORTED_INTERFACE_LANGUAGES)
        self.changed = False
        self.saved_at = time.monotonic()
