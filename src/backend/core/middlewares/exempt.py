"""Exempt-aware middleware.

The :class:`ExemptMiddleware` base class skips its own logic for views marked
with the :func:`~core.middlewares.exempt_middleware.middleware_exempt` decorator.
"""

from collections.abc import Awaitable, Callable

from django.http import HttpRequest, HttpResponse


def _is_exempt(request: HttpRequest) -> bool:
    """True when the resolved view is flagged ``middleware_exempt``."""
    view = getattr(request, "resolver_match", None)
    view_func = getattr(view, "func", None) if view is not None else None
    return view_func is not None and getattr(view_func, "middleware_exempt", False)


class ExemptMiddleware:
    """Base middleware that skips its logic for views marked ``middleware_exempt``.

    Subclasses implement ``_handle(request)`` with their own per-request work.
    ``__call__`` already performs the exempt check, so ``_handle`` runs only for
    views that have **not** been decorated with ``middleware_exempt``.
    """

    def __init__(self, get_response: Callable[[HttpRequest], Awaitable[HttpResponse] | HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if _is_exempt(request):
            return self.get_response(request)

        self._handle(request)
        return self.get_response(request)

    def _handle(self, request: HttpRequest) -> None:
        """Per-request logic. Override in a subclass; runs only for non-exempt views."""
