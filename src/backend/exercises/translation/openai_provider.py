"""Machine translation through any OpenAI-compatible server, such as a local
Lemonade, llama.cpp or Ollama.

One request per batch, to `{base_url}/chat/completions`. The model is asked for
a JSON object holding an array of strings, one per sentence, in order; `validated`
then refuses the whole batch if the count is off or any item is unusable. Local
models are less reliable than a hosted one, so use a small `--batch-size` and
read a `--limit` trial run before committing the result. It needs no key and
no extra package.
"""
import json
import re
import urllib.error
import urllib.request

from .providers import (
    SYSTEM_PROMPT,
    Provider,
    ProviderConfigurationError,
    ProviderError,
    language_name,
    validated,
)

DEFAULT_BASE_URL = 'http://localhost:8000/api/v1'
# A local model can be slow on a batch; this is per request.
TIMEOUT_SECONDS = 300

JSON_INSTRUCTION = (
    'Reply with only a JSON object of the form {"translations": ["...", "..."]}, '
    'holding exactly one string per input sentence, in the same order.'
)


def parse_translations(text):
    """The `translations` array from a reply, tolerating a Markdown code fence
    around it, which small models like to add."""
    fenced = re.search(r'```(?:json)?\s*(.*?)```', text, re.DOTALL)
    return json.loads(fenced.group(1) if fenced else text)['translations']


class OpenAICompatibleProvider(Provider):
    name = 'openai-compatible'

    def __init__(self, model: str = '', base_url: str = ''):
        if not model:
            raise ProviderConfigurationError(
                'The openai-compatible provider needs --model, the name the server lists '
                'for the model it should use.'
            )
        self.model = model
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip('/')

    def request(self, sentences, source, target):
        body = {
            'model': self.model,
            'temperature': 0,
            'messages': [
                {'role': 'system', 'content': f'{SYSTEM_PROMPT}\n\n{JSON_INSTRUCTION}'},
                {'role': 'user', 'content': (
                    f'Translate these {len(sentences)} {language_name(source)} sentences '
                    f'into {language_name(target)}:\n\n'
                    + json.dumps(sentences, ensure_ascii=False, indent=0)
                )},
            ],
        }
        request = urllib.request.Request(
            f'{self.base_url}/chat/completions',
            data=json.dumps(body).encode(),
            headers={'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.load(response)

    def translate(self, sentences, source, target):
        try:
            response = self.request(sentences, source, target)
        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 404):
                # Wrong URL or model name: every batch would fail the same way.
                raise ProviderConfigurationError(
                    f'{self.base_url} answered {error.code} for model {self.model!r}.'
                ) from error
            raise ProviderError(f'server error {error.code}') from error
        except urllib.error.URLError as error:
            raise ProviderConfigurationError(
                f'Cannot reach {self.base_url}: {error.reason}. Is the server running?'
            ) from error
        except (TimeoutError, ValueError) as error:
            raise ProviderError(f'no usable response: {error}') from error

        try:
            choice = response['choices'][0]
            if choice.get('finish_reason') == 'length':
                raise ProviderError('the response was cut off at the token limit')
            translations = parse_translations(choice['message']['content'])
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise ProviderError(f'the response was not the expected JSON: {error}') from error
        return validated(translations, sentences)
