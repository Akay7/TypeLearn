"""The machine translations, committed as a YAML fixture:
`exercises/fixtures/translations/<source>.yaml`.

This file, not the database, is where a machine translation is kept. It is
written once, on a developer's machine, by `translate_catalog`, reviewed and
committed like any other source file, and shipped in the image; every
database — a worktree's, CI's, a deployment's — gets its copy through
`load_translations`. No provider key is needed anywhere but on the machine
that runs the translation.

    format: 1
    source: th
    generated_by: anthropic claude-opus-5
    sentences:
    - sentence: ฉันชอบกินข้าวผัด
      sentence_id: 7f3c2a…
      en: I like eating fried rice.
      ru: Я люблю есть жареный рис.

One entry per source sentence, keyed by its text: that is unique in the catalog
and is exactly what was translated, while database ids differ between every
database the file is loaded into. `sentence_id` is the corpus's own id, kept for
traceability and as a fallback match. Every other key is a target language; a
language that is missing has not been translated yet. A bad translation is
corrected by editing its line.
"""
import logging
import os
import tempfile
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

FORMAT = 1
DEFAULT_DIR = Path(__file__).resolve().parent.parent / 'fixtures' / 'translations'
# Keys of an entry that are not target languages.
SENTENCE = 'sentence'
SENTENCE_ID = 'sentence_id'

HEADER = """\
# Machine translations of the catalog's sentences, loaded by `load_translations`.
# Written by `translate_catalog`; correct a translation by editing its line.
# See exercises/translation/fixture.py for the format.
"""

# The C implementations when libyaml is there: a full catalog is tens of
# thousands of entries, which the pure-Python ones take several seconds over.
Loader = getattr(yaml, 'CSafeLoader', yaml.SafeLoader)
Dumper = getattr(yaml, 'CSafeDumper', yaml.SafeDumper)


class FixtureError(Exception):
    """The file cannot be read as a translation fixture."""


def fixture_path(root: Path, source: str) -> Path:
    return Path(root) / f'{source}.yaml'


class TranslationFixture:
    """One source language's translations, in the order they were added."""

    def __init__(self, source: str, generated_by: str = '', entries=None):
        self.source = source
        self.generated_by = generated_by
        self.entries = {}
        for entry in entries or []:
            self.entries[entry[SENTENCE]] = entry

    @classmethod
    def load(cls, path: Path, source: str) -> 'TranslationFixture':
        """The file at `path`, or an empty fixture if there is none yet.

        A file that is there but is not a fixture is an error, not an empty
        one: it is committed, so something is wrong with the commit.
        """
        path = Path(path)
        if not path.exists():
            return cls(source)
        try:
            with path.open(encoding='utf-8') as handle:
                data = yaml.load(handle, Loader=Loader)
        except yaml.YAMLError as error:
            raise FixtureError(f'{path} is not valid YAML: {error}') from error
        if not isinstance(data, dict) or data.get('format') != FORMAT:
            raise FixtureError(f'{path} is not a format {FORMAT} translation fixture.')
        if data.get('source') != source:
            raise FixtureError(
                f'{path} holds {data.get("source")!r} sentences, expected {source!r}.'
            )
        entries = []
        for number, entry in enumerate(data.get('sentences') or [], start=1):
            if not isinstance(entry, dict) or not isinstance(entry.get(SENTENCE), str) \
                    or not entry[SENTENCE].strip():
                logger.warning('%s: entry %d has no sentence; skipped.', path, number)
                continue
            entries.append({
                key: str(value) for key, value in entry.items() if value is not None
            })
        return cls(source, str(data.get('generated_by') or ''), entries)

    def translation(self, sentence: str, language: str):
        entry = self.entries.get(sentence)
        return entry.get(language) if entry else None

    def set(self, sentence: str, sentence_id: str, language: str, text: str):
        entry = self.entries.setdefault(sentence, {SENTENCE: sentence})
        if sentence_id and not entry.get(SENTENCE_ID):
            entry[SENTENCE_ID] = sentence_id
        entry[language] = text

    def records(self, language: str):
        """`(sentence, sentence_id, text)` for every entry translated into
        `language`."""
        return [
            (entry[SENTENCE], entry.get(SENTENCE_ID, ''), entry[language])
            for entry in self.entries.values()
            if isinstance(entry.get(language), str) and entry[language].strip()
        ]

    def languages(self):
        """Every target language any entry has, in first-seen order."""
        seen = {}
        for entry in self.entries.values():
            for key in entry:
                if key not in (SENTENCE, SENTENCE_ID):
                    seen.setdefault(key)
        return list(seen)

    def save(self, path: Path, language_order=()):
        """Replace the file in one step, so an interrupted save leaves the old
        one whole. Keys are written in a fixed order — sentence, id, then the
        languages in `language_order` — so a re-save of the same content is
        byte-identical and a diff shows only what changed."""
        path = Path(path)
        rank = {language: index for index, language in enumerate(language_order)}

        def ordered(entry):
            languages = sorted(
                (key for key in entry if key not in (SENTENCE, SENTENCE_ID)),
                key=lambda key: (rank.get(key, len(rank)), key),
            )
            keys = [SENTENCE] + ([SENTENCE_ID] if entry.get(SENTENCE_ID) else []) + languages
            return {key: entry[key] for key in keys}

        document = {
            'format': FORMAT,
            'source': self.source,
            'generated_by': self.generated_by,
            'sentences': [ordered(entry) for entry in self.entries.values()],
        }
        body = yaml.dump(document, Dumper=Dumper, allow_unicode=True, sort_keys=False,
                         default_flow_style=False, width=1_000_000)
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix=f'.{path.name}.')
        try:
            with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
                handle.write(HEADER + body)
            # mkstemp makes the file private; this one is committed source.
            os.chmod(temporary, 0o644)
            os.replace(temporary, path)
        except BaseException:
            Path(temporary).unlink(missing_ok=True)
            raise
