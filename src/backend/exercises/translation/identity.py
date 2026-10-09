"""Who an anonymous write came from, as far as the API can tell.

Nothing here authenticates anyone. The client id is whatever the browser sent,
and the address is whatever the proxies in front of Django say it was; both
exist only so the rate limits have something to count and a rating something
to be unique on.
"""
import hashlib
import hmac
import uuid

from django.conf import settings


def valid_client_id(value: str) -> bool:
    """A browser id is a UUID the frontend generated. Anything else is refused
    rather than stored, so the column never holds free text."""
    try:
        return str(uuid.UUID(value)) == value.lower()
    except (ValueError, AttributeError, TypeError):
        return False


def client_address(request) -> str:
    """The address the request came from.

    With no trusted proxies that is the connection's own address. With N, it is
    the Nth entry from the right of X-Forwarded-For: each trusted proxy appends
    the address it received from, so everything left of those N entries was
    written by the client and can say anything.
    """
    trusted = settings.TRUSTED_PROXY_COUNT
    if trusted > 0:
        hops = [hop.strip() for hop in request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')]
        hops = [hop for hop in hops if hop]
        if len(hops) >= trusted:
            return hops[-trusted]
    return request.META.get('REMOTE_ADDR', '')


def address_hash(request) -> str:
    """The client address as an HMAC keyed by SECRET_KEY: stable enough to
    count requests by, and never the address itself."""
    address = client_address(request)
    return hmac.new(settings.SECRET_KEY.encode(), address.encode(), hashlib.sha256).hexdigest()
