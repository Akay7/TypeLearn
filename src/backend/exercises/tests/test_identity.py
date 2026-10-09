import uuid

import pytest
from django.test import RequestFactory

from exercises.translation.identity import address_hash, client_address, valid_client_id


def request_with(remote='10.0.0.9', forwarded=None):
    headers = {'REMOTE_ADDR': remote}
    if forwarded is not None:
        headers['HTTP_X_FORWARDED_FOR'] = forwarded
    return RequestFactory().post('/graphql/', **headers)


def test_valid_client_id_accepts_only_uuids():
    assert valid_client_id(str(uuid.uuid4()))
    assert not valid_client_id('')
    assert not valid_client_id('not-a-uuid')
    assert not valid_client_id('x' * 64)


def test_no_trusted_proxy_ignores_the_header(settings):
    settings.TRUSTED_PROXY_COUNT = 0

    assert client_address(request_with(forwarded='1.2.3.4')) == '10.0.0.9'


def test_one_trusted_proxy_takes_the_last_hop(settings):
    settings.TRUSTED_PROXY_COUNT = 1

    assert client_address(request_with(forwarded='203.0.113.7')) == '203.0.113.7'


def test_spoofed_extra_hops_are_ignored(settings):
    # The client wrote the first two entries itself; the Gateway appended the last.
    settings.TRUSTED_PROXY_COUNT = 1

    request = request_with(forwarded='6.6.6.6, 7.7.7.7, 203.0.113.7')

    assert client_address(request) == '203.0.113.7'


def test_missing_header_falls_back_to_the_connection(settings):
    settings.TRUSTED_PROXY_COUNT = 1

    assert client_address(request_with()) == '10.0.0.9'


@pytest.mark.parametrize('trusted', [0, 1])
def test_address_hash_is_stable_and_not_the_address(settings, trusted):
    settings.TRUSTED_PROXY_COUNT = trusted
    request = request_with(remote='203.0.113.7', forwarded='203.0.113.7')

    digest = address_hash(request)

    assert digest == address_hash(request)
    assert '203.0.113.7' not in digest
    assert len(digest) == 64
