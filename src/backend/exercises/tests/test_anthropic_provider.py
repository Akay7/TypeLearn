"""The Anthropic provider against a stubbed client: no request leaves the test."""
import json
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from exercises.translation.anthropic_provider import DEFAULT_MODEL, AnthropicProvider
from exercises.translation.providers import ProviderConfigurationError, ProviderError


def response(payload=None, *, text=None, stop_reason='end_turn', category=None):
    if text is None:
        text = json.dumps(payload)
    return SimpleNamespace(
        stop_reason=stop_reason,
        stop_details=SimpleNamespace(category=category) if category else None,
        content=[SimpleNamespace(type='thinking', thinking=''),
                 SimpleNamespace(type='text', text=text)],
    )


class StubClient:
    def __init__(self, result):
        self.result = result
        self.calls = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **params):
        self.calls.append(params)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def provider(result, **options):
    client = StubClient(result)
    return AnthropicProvider('claude-opus-5', client=client, **options), client


def api_error(cls, status):
    request = httpx2.Request('POST', 'https://api.anthropic.com/v1/messages')
    return cls('nope', response=httpx2.Response(status, request=request), body=None)


def test_a_good_batch():
    subject, client = provider(response({'translations': [' Hello ', 'Goodbye']}))

    assert subject.translate(['สวัสดี', 'ลาก่อน'], 'th', 'en') == ['Hello', 'Goodbye']

    params = client.calls[0]
    assert params['model'] == 'claude-opus-5'
    assert params['output_config']['format']['type'] == 'json_schema'
    assert 'effort' not in params['output_config']
    assert params['fallbacks'] == 'default'
    assert params['betas'] == ['server-side-fallback-2026-07-01']
    assert 'Thai' in params['messages'][0]['content']
    assert 'English' in params['messages'][0]['content']
    assert 'สวัสดี' in params['messages'][0]['content']


def test_effort_and_fallback_are_options():
    subject, client = provider(response({'translations': ['Hello']}),
                               effort='low', refusal_fallback=False)

    subject.translate(['สวัสดี'], 'th', 'en')

    assert client.calls[0]['output_config']['effort'] == 'low'
    assert 'fallbacks' not in client.calls[0]


@pytest.mark.parametrize('result', [
    response({'translations': ['only one']}),
    response({'translations': ['Hello', '   ']}),
    response(text='not json'),
    response({'wrong': []}),
    response({'translations': ['a', 'b']}, stop_reason='max_tokens'),
    response(stop_reason='refusal', category='other', text=''),
])
def test_unusable_responses_fail_the_batch(result):
    subject, _ = provider(result)

    with pytest.raises(ProviderError):
        subject.translate(['สวัสดี', 'ลาก่อน'], 'th', 'en')


def test_a_server_error_fails_only_the_batch():
    subject, _ = provider(api_error(anthropic.InternalServerError, 500))

    with pytest.raises(ProviderError):
        subject.translate(['สวัสดี'], 'th', 'en')


@pytest.mark.parametrize(('cls', 'status'), [
    (anthropic.AuthenticationError, 401),
    (anthropic.NotFoundError, 404),
])
def test_a_bad_key_or_model_stops_the_run(cls, status):
    subject, _ = provider(api_error(cls, status))

    with pytest.raises(ProviderConfigurationError):
        subject.translate(['สวัสดี'], 'th', 'en')


def test_missing_key_fails_before_any_work(monkeypatch):
    for variable in ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_PROFILE'):
        monkeypatch.delenv(variable, raising=False)

    with pytest.raises(ProviderConfigurationError, match='ANTHROPIC_API_KEY'):
        AnthropicProvider('claude-opus-5')


def test_the_default_model_and_label():
    subject = AnthropicProvider('', client=StubClient(None))

    assert subject.model == DEFAULT_MODEL
    assert subject.generated_by == f'anthropic {DEFAULT_MODEL}'
