"""Machine-translation providers, used only by `translate_catalog`.

A provider takes a batch of sentences and returns their translations in the
same order, or raises `ProviderError` for the whole batch. It never returns a
partial or blank result: the command writes a batch only when every item in it
is usable.
"""
from django.conf import settings


class ProviderError(Exception):
    """This batch could not be translated; nothing in it is usable."""


class ProviderConfigurationError(Exception):
    """The provider cannot run at all — raised before any work starts."""


# English names, for the prompt: the model is told "Thai", not "th".
LANGUAGE_NAMES = {
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'th': 'Thai',
    'ru': 'Russian',
    'hu': 'Hungarian',
}

SYSTEM_PROMPT = """\
You translate sentences for a language-learning app. Each sentence comes from a \
crowd-sourced speech corpus, so it stands alone with no surrounding context: a \
learner hears it, types it, and reads your translation to understand what it means.

Translate each sentence faithfully and naturally. Keep the meaning, register and \
tone of the original; do not add explanations, transliterations, notes or \
alternatives. When a sentence is ambiguous out of context, pick the most likely \
everyday reading. Return exactly one translation per input sentence, in the same order."""


def language_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, code)


class Provider:
    name = ''
    model = ''
    # Whether this provider's output is placeholder text that must never reach
    # the committed fixture.
    placeholder = False

    @property
    def generated_by(self) -> str:
        return ' '.join(filter(None, [self.name, self.model]))

    def translate(self, sentences: list[str], source: str, target: str) -> list[str]:
        raise NotImplementedError


class OfflineProvider(Provider):
    """Deterministic placeholders, with no network: for tests, and for trying
    the command out without an API key."""

    name = 'offline'
    placeholder = True

    def translate(self, sentences, source, target):
        return [f'[{target}] {sentence}' for sentence in sentences]


def validated(result, sentences: list[str]) -> list[str]:
    """The provider's answer, if it is one usable translation per sentence."""
    if not isinstance(result, list) or len(result) != len(sentences):
        count = len(result) if isinstance(result, list) else type(result).__name__
        raise ProviderError(f'expected {len(sentences)} translations, got {count}')
    cleaned = []
    for index, item in enumerate(result):
        if not isinstance(item, str) or not item.strip():
            raise ProviderError(f'translation {index} is blank')
        item = item.strip()
        if len(item) > settings.TRANSLATION_MAX_LENGTH:
            raise ProviderError(f'translation {index} is longer than '
                                f'{settings.TRANSLATION_MAX_LENGTH} characters')
        cleaned.append(item)
    return cleaned


def get_provider(name: str, model: str = '', effort: str = '',
                 refusal_fallback: bool = True, base_url: str = '') -> Provider:
    if name == 'offline':
        return OfflineProvider()
    if name == 'anthropic':
        try:
            from .anthropic_provider import AnthropicProvider
        except ImportError as error:
            # The SDK is a dev dependency: a deployment never translates.
            raise ProviderConfigurationError(
                'The anthropic package is not installed. Run translate_catalog from the '
                'dev environment (`uv sync` installs it).'
            ) from error

        return AnthropicProvider(model, effort, refusal_fallback)
    if name == 'openai-compatible':
        from .openai_provider import OpenAICompatibleProvider

        return OpenAICompatibleProvider(model, base_url)
    raise ProviderConfigurationError(f'Unknown translation provider {name!r}.')
