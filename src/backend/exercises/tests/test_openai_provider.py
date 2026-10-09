"""The OpenAI-compatible provider with its HTTP call stubbed: no request leaves the test."""
import json
import urllib.error

import pytest

from exercises.translation.openai_provider import OpenAICompatibleProvider, parse_translations
from exercises.translation.providers import ProviderConfigurationError, ProviderError, get_provider


def reply(content, finish_reason='stop'):
    return {'choices': [{'message': {'content': content}, 'finish_reason': finish_reason}]}


@pytest.fixture
def provider(monkeypatch):
    provider = OpenAICompatibleProvider('some-model')
    provider.sent = []

    def request(sentences, source, target):
        provider.sent.append((sentences, source, target))
        return provider.answer

    monkeypatch.setattr(provider, 'request', request)
    return provider


def test_translates_a_batch(provider):
    provider.answer = reply(json.dumps({'translations': ['hello', 'bye']}))
    assert provider.translate(['a', 'b'], 'th', 'en') == ['hello', 'bye']


def test_accepts_a_reply_in_a_code_fence(provider):
    provider.answer = reply('```json\n{"translations": ["hello"]}\n```')
    assert provider.translate(['a'], 'th', 'en') == ['hello']
    assert parse_translations('{"translations": ["x"]}') == ['x']


@pytest.mark.parametrize('answer', [
    reply('not json'),
    reply(json.dumps({'translations': ['only one']})),
    reply(json.dumps({'translations': ['ok', ' ']})),
    reply('{"translations": ["a", "b"]}', finish_reason='length'),
    {'choices': []},
])
def test_an_unusable_reply_fails_the_batch(provider, answer):
    provider.answer = answer
    with pytest.raises(ProviderError):
        provider.translate(['a', 'b'], 'th', 'en')


def test_an_unreachable_server_stops_the_run(monkeypatch):
    provider = OpenAICompatibleProvider('m')

    def refuse(*args, **kwargs):
        raise urllib.error.URLError('connection refused')

    monkeypatch.setattr('urllib.request.urlopen', refuse)
    with pytest.raises(ProviderConfigurationError, match='Cannot reach'):
        provider.translate(['a'], 'th', 'en')


def test_needs_a_model():
    with pytest.raises(ProviderConfigurationError, match='--model'):
        get_provider('openai-compatible')


def test_base_url_defaults_to_lemonade_and_drops_a_trailing_slash():
    assert get_provider('openai-compatible', 'm').base_url == 'http://localhost:8000/api/v1'
    assert get_provider('openai-compatible', 'm', base_url='http://h:1/v1/').base_url == 'http://h:1/v1'
