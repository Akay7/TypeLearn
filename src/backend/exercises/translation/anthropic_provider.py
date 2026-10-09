"""Machine translation through the Anthropic API.

One request per batch. The response is constrained to a JSON object holding an
array of strings, one per sentence, in order; `validated` then refuses the
whole batch if the count is off or any item is unusable. The SDK retries
connection errors, 429s and 5xx itself, so a failure that reaches here has
already been retried.
"""
import json
import os

import anthropic

from .providers import (
    SYSTEM_PROMPT,
    Provider,
    ProviderConfigurationError,
    ProviderError,
    language_name,
    validated,
)

DEFAULT_MODEL = 'claude-opus-5'

OUTPUT_FORMAT = {
    'type': 'json_schema',
    'schema': {
        'type': 'object',
        'properties': {
            'translations': {'type': 'array', 'items': {'type': 'string'}},
        },
        'required': ['translations'],
        'additionalProperties': False,
    },
}

# Enough for a batch of short sentences with room to spare; a request that
# still hits it fails its batch rather than returning a truncated array.
MAX_TOKENS = 16000

# Credential sources the SDK reads from the environment: the developer's own,
# exported in the shell that runs `translate_catalog`. Nothing in the repository
# or the chart ever holds one.
CREDENTIAL_VARIABLES = ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_PROFILE')


class AnthropicProvider(Provider):
    name = 'anthropic'

    def __init__(self, model: str = DEFAULT_MODEL, effort: str = '',
                 refusal_fallback: bool = True, client=None):
        """`effort` is the model's effort level (low … max); empty leaves the
        API's default, and lowering it is the first thing to try if a trial run
        costs more than it is worth. `refusal_fallback` re-runs a policy decline
        on Anthropic's recommended fallback model within the same call; turn it
        off only for a model that does not accept the parameter."""
        self.model = model or DEFAULT_MODEL
        self.effort = effort
        self.refusal_fallback = refusal_fallback
        if client is None:
            if not any(os.environ.get(variable) for variable in CREDENTIAL_VARIABLES):
                raise ProviderConfigurationError(
                    'ANTHROPIC_API_KEY is not set. Export it in the shell that runs '
                    'translate_catalog.'
                )
            client = anthropic.Anthropic()
        self.client = client

    def request(self, sentences, source, target):
        params = {
            'model': self.model,
            'max_tokens': MAX_TOKENS,
            'system': SYSTEM_PROMPT,
            'messages': [{
                'role': 'user',
                'content': (
                    f'Translate these {len(sentences)} {language_name(source)} sentences '
                    f'into {language_name(target)}:\n\n'
                    + json.dumps(sentences, ensure_ascii=False, indent=0)
                ),
            }],
            'output_config': {'format': OUTPUT_FORMAT},
        }
        if self.effort:
            params['output_config']['effort'] = self.effort
        if self.refusal_fallback:
            # A policy decline is re-run on the recommended fallback model
            # inside the same call; without it the batch would simply fail.
            params['betas'] = ['server-side-fallback-2026-07-01']
            params['fallbacks'] = 'default'
        return self.client.beta.messages.create(**params)

    def translate(self, sentences, source, target):
        try:
            response = self.request(sentences, source, target)
        except (anthropic.AuthenticationError, anthropic.PermissionDeniedError,
                anthropic.NotFoundError) as error:
            # Wrong key or wrong model: every batch would fail the same way, so
            # stop the run rather than record thousands of identical failures.
            raise ProviderConfigurationError(f'{type(error).__name__}: {error.message}') from error
        except anthropic.APIStatusError as error:
            raise ProviderError(f'API error {error.status_code}: {error.message}') from error
        except anthropic.APIConnectionError as error:
            raise ProviderError(f'connection failed: {error}') from error

        if response.stop_reason == 'refusal':
            category = response.stop_details.category if response.stop_details else None
            raise ProviderError(f'the model declined this batch (category: {category})')
        if response.stop_reason == 'max_tokens':
            raise ProviderError('the response was cut off at max_tokens')

        text = next((block.text for block in response.content if block.type == 'text'), None)
        try:
            translations = json.loads(text)['translations']
        except (TypeError, ValueError, KeyError) as error:
            raise ProviderError(f'the response was not the expected JSON: {error}') from error
        return validated(translations, sentences)
