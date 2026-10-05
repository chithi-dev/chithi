"""Tests for core.middlewares -- the ``middleware_exempt`` decorator and the
exempt-aware middleware (:class:`ExemptMiddleware` / :class:`MyMiddleware`).

Proves the four behaviours the decorator must guarantee:
1. A normal view goes through the middleware.
2. A ``@middleware_exempt`` view completely skips the middleware.
3. Multiple exempt views work independently.
4. The decorator does not alter the view's normal return behaviour.
"""

from types import SimpleNamespace


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

    # Same function object, name, signature and return behaviour preserved.
    assert _add.__name__ == "_add"
    assert _add(2, 3) == 5
    assert _add(10, 20) == 30


def test_normal_view_goes_through_middleware() -> None:
    """Requirement 1: a non-exempt view runs the middleware's logic."""
    from core.middlewares import MyMiddleware

    ran: list[str] = []

    class RecordingMW(MyMiddleware):
        def _handle(self, request):
            ran.append("handle")

    def _normal(request):
        return "ok"

    mw = RecordingMW(lambda r: "chain")
    assert mw(_request_with_func(_normal)) == "chain"
    assert ran == ["handle"]


def test_exempt_view_skips_middleware() -> None:
    """Requirement 2: an exempt view skips the middleware's logic entirely."""
    from core.middlewares import MyMiddleware, middleware_exempt

    ran: list[str] = []

    class RecordingMW(MyMiddleware):
        def _handle(self, request):
            ran.append("handle")

    @middleware_exempt
    def _exempt(request):
        return "ok"

    mw = RecordingMW(lambda r: "chain")
    # The chain still runs (get_response), but _handle never does.
    assert mw(_request_with_func(_exempt)) == "chain"
    assert ran == []


def test_multiple_exempt_views_independent() -> None:
    """Requirement 3: several exempt views each skip, normal views don't."""
    from core.middlewares import MyMiddleware, middleware_exempt

    ran: list[str] = []

    class RecordingMW(MyMiddleware):
        def _handle(self, request):
            ran.append("handle")

    @middleware_exempt
    def _exempt_one(request):
        return "ok"

    @middleware_exempt
    def _exempt_two(request):
        return "ok"

    def _normal(request):
        return "ok"

    mw = RecordingMW(lambda r: "chain")
    assert mw(_request_with_func(_exempt_one)) == "chain"
    assert mw(_request_with_func(_exempt_two)) == "chain"
    assert mw(_request_with_func(_normal)) == "chain"

    # Only the single normal view triggered the middleware logic.
    assert ran == ["handle"]


def test_exempt_middleware_base_skips_exempt_view() -> None:
    from core.middlewares import ExemptMiddleware, middleware_exempt

    ran: list[str] = []

    class MW(ExemptMiddleware):
        def _handle(self, request):
            ran.append("handle")

    @middleware_exempt
    def _exempt(request):
        return "ok"

    mw = MW(lambda r: "chain")
    assert mw(_request_with_func(_exempt)) == "chain"
    assert ran == []


def test_exempt_middleware_base_runs_handle_for_non_exempt() -> None:
    from core.middlewares import ExemptMiddleware

    ran: list[str] = []

    class MW(ExemptMiddleware):
        def _handle(self, request):
            ran.append("handle")

    def _normal(request):
        return "ok"

    mw = MW(lambda r: "chain")
    assert mw(_request_with_func(_normal)) == "chain"
    assert ran == ["handle"]


def test_request_without_resolver_match_is_not_exempt() -> None:
    """A request with no resolver_match (e.g. a 404) is treated as non-exempt."""
    from core.middlewares import MyMiddleware

    ran: list[str] = []

    class RecordingMW(MyMiddleware):
        def _handle(self, request):
            ran.append("handle")

    mw = RecordingMW(lambda r: "chain")
    assert mw(SimpleNamespace()) == "chain"
    assert ran == ["handle"]
