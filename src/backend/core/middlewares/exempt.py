"""Exempt-aware middleware.

:class:`ExemptMiddleware` must be registered **first** in ``MIDDLEWARE`` (the
settings guard enforces this). Because it sits at the very top of the chain, it
runs before every other middleware, which is exactly what it needs: for a view
flagged with :func:`~core.decorators.exempt_middleware.middleware_exempt` it
calls the view **directly**, bypassing the entire rest of the chain. Non-exempt
views fall through to ``self.get_response(request)`` and run normally.
"""

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse


def _view_func(request: HttpRequest) -> Callable | None:
    """The resolved view callable, or ``None`` when there is no resolver_match."""
    view = getattr(request, "resolver_match", None)
    return getattr(view, "func", None) if view is not None else None


def _is_exempt(request: HttpRequest) -> bool:
    """True when the resolved view is flagged ``middleware_exempt``."""
    view_func = _view_func(request)
    return view_func is not None and bool(getattr(view_func, "middleware_exempt", False))


def _call_view(view_func: Callable, request: HttpRequest) -> HttpResponse:
    """Invoke the view directly, bypassing the middleware chain.

    Some views are wrapped (``csrf_exempt``, ``functools.partial``); unwrap the
    real callable when possible so the view still receives the raw request.
    """
    if view_func.__class__ is not type(view_func):
        # Wrapped callable: resolve to the underlying function when exposed.
        view_func = getattr(view_func, "func", view_func)

    return view_func(request)


class ExemptMiddleware:
    """Skip the **entire** middleware chain for views marked ``middleware_exempt``.

    Register it as the **first** entry in ``MIDDLEWARE``. When it sees a request
    whose resolved view carries the ``middleware_exempt`` flag, it calls that
    view directly and returns the result -- no other middleware runs at all. For
    every other view it delegates to ``self.get_response(request)`` and the
    normal chain proceeds.
    """

    sync_capable = True
    async_capable = False

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if _is_exempt(request):
            return _call_view(_view_func(request), request)

        return self.get_response(request)
