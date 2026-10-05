"""Tests for :class:`ExemptMiddleware` and the ``middleware_exempt`` decorator.

Proves the contract:
1. A normal (non-exempt) view goes through the middleware chain (``get_response``).
2. A ``@middleware_exempt`` view is called **directly**, bypassing the entire
   rest of the chain -- ``get_response`` is never invoked.
3. Multiple exempt views each bypass the chain independently.
4. The decorator does not alter the view's name, signature, or return value.
5. The ``ExemptMiddleware`` must be the first entry in ``MIDDLEWARE`` (settings
   guard).
"""

from types import SimpleNamespace

from django.conf import settings


def _request_with_func(view_func):
    """A minimal request whose ``resolver_match.func`` is *view_func*."""
    return SimpleNamespace(resolver_match=SimpleNamespace(func=view_func))


def test_middleware_exempt_sets_flag_directly() -> None:
    from core.middlewares import middleware_exempt

    @middleware_exempt
    def _v():
        pass

    assert getattr(_v, "middleware_exempt", False) is True
    # A plain function is not flagged.
    assert not getattr(lambda: None, "middleware_exempt", False)


def test_decorator_does_not_wrap_or_alter_view() -> None:
    """The decorator marks the view in place; it is the same callable."""
    from core.middlewares import middleware_exempt

    @middleware_exempt
    def _add(a, b):
        return a + b

    # Same function object, name, and return behaviour preserved.
    assert _add.__name__ == "_add"
    assert _add(2, 3) == 5
    assert _add(10, 20) == 30


def test_normal_view_goes_through_chain() -> None:
    """A non-exempt view is delegated to get_response (the rest of the chain)."""
    from core.middlewares import ExemptMiddleware

    def _normal(request):
        return "view-response"

    calls: list[str] = []

    def get_response(request):
        calls.append("get_response")
        return "chain-response"

    mw = ExemptMiddleware(get_response)
    result = mw(_request_with_func(_normal))

    assert result == "chain-response"
    assert calls == ["get_response"]


def test_exempt_view_bypasses_entire_chain() -> None:
    """An exempt view is called directly; get_response is never invoked."""
    from core.middlewares import ExemptMiddleware, middleware_exempt

    @middleware_exempt
    def _exempt(request):
        return "exempt-view-response"

    calls: list[str] = []

    def get_response(request):
        calls.append("get_response")
        return "chain-response"

    mw = ExemptMiddleware(get_response)
    result = mw(_request_with_func(_exempt))

    # The view ran directly and the rest of the chain was skipped entirely.
    assert result == "exempt-view-response"
    assert calls == []


def test_multiple_exempt_views_independent() -> None:
    """Each exempt view bypasses the chain on its own; normal views don't."""
    from core.middlewares import ExemptMiddleware, middleware_exempt

    calls: list[str] = []

    def get_response(request):
        calls.append("get_response")
        return "chain-response"

    @middleware_exempt
    def _exempt_one(request):
        return "one"

    @middleware_exempt
    def _exempt_two(request):
        return "two"

    def _normal(request):
        return "three"

    mw = ExemptMiddleware(get_response)
    assert mw(_request_with_func(_exempt_one)) == "one"
    assert mw(_request_with_func(_exempt_two)) == "two"
    assert mw(_request_with_func(_normal)) == "chain-response"

    # Only the normal view went through the chain.
    assert calls == ["get_response"]


def test_exempt_view_receives_raw_request() -> None:
    """The exempt view is called with the same request object it resolved to."""
    from core.middlewares import ExemptMiddleware, middleware_exempt

    seen_requests: list[object] = []

    @middleware_exempt
    def _exempt(request):
        seen_requests.append(request)
        return "ok"

    mw = ExemptMiddleware(lambda r: "chain")
    request = _request_with_func(_exempt)
    mw(request)

    assert seen_requests == [request]


def test_request_without_resolver_match_is_not_exempt() -> None:
    """A request with no resolver_match (e.g. a 404) is treated as non-exempt."""
    from core.middlewares import ExemptMiddleware

    calls: list[str] = []

    def get_response(request):
        calls.append("get_response")
        return "chain-response"

    mw = ExemptMiddleware(get_response)
    assert mw(SimpleNamespace()) == "chain-response"
    assert calls == ["get_response"]


def test_exempt_middleware_must_be_first_in_middleware() -> None:
    """The settings guard ensures ExemptMiddleware is the first entry."""
    assert settings.MIDDLEWARE[0] == "core.middlewares.ExemptMiddleware"
