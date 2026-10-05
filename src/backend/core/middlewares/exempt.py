"""Exempt-aware middleware.

:class:`ExemptMiddleware` must be registered **first** in ``MIDDLEWARE`` (the
settings guard enforces this). Because it sits at the very top of the chain, it
runs before every other middleware, which is exactly what it needs: for a view
flagged with :func:`~core.decorators.exempt_middleware.middleware_exempt` it
calls the view **directly**, bypassing the entire rest of the chain. Non-exempt
views fall through to ``self.get_response(request)`` and run normally.

The middleware is ``async_capable``: when the surrounding handler is async
(ASGI), the exempt view is awaited natively if it is a coroutine function, or
wrapped in ``sync_to_async`` if it is synchronous.
"""

import inspect
from collections.abc import Awaitable, Callable

from asgiref.sync import sync_to_async
from django.http import HttpRequest, HttpResponse


def _is_exempt(request: HttpRequest) -> bool:
    """True when the resolved view is flagged ``middleware_exempt``."""
    view = getattr(request, "resolver_match", None)
    view_func = getattr(view, "func", None) if view is not None else None
    return view_func is not None and bool(getattr(view_func, "middleware_exempt", False))


def _resolve_view_and_args(request: HttpRequest) -> tuple[Callable, tuple, dict]:
    """Return ``(callback, callback_args, callback_kwargs)`` from the request.

    Reuses the ``resolver_match`` that Django's core handler already populated,
    so the exempt path calls the view with the exact same arguments Django
    would pass to it.
    """
    resolver_match = request.resolver_match
    return resolver_match.func, resolver_match.args, resolver_match.kwargs


async def _call_view_async(
    callback: Callable, callback_args: tuple, callback_kwargs: dict, request: HttpRequest
) -> HttpResponse:
    """Call the view, handling sync and async callables.

    Mirrors the relevant part of ``BaseHandler._get_response_async``: sync views
    are run in a thread, async views are awaited directly.
    """
    if inspect.iscoroutinefunction(callback):
        return await callback(request, *callback_args, **callback_kwargs)

    return await sync_to_async(
        callback, thread_sensitive=True
    )(request, *callback_args, **callback_kwargs)


def _call_view_sync(
    callback: Callable, callback_args: tuple, callback_kwargs: dict, request: HttpRequest
) -> HttpResponse:
    """Call a sync view directly (sync handler context)."""
    return callback(request, *callback_args, **callback_kwargs)


class ExemptMiddleware:
    """Skip the **entire** middleware chain for views marked ``middleware_exempt``.

    Register it as the **first** entry in ``MIDDLEWARE``. When it sees a request
    whose resolved view carries the ``middleware_exempt`` flag, it calls that
    view directly and returns the result -- no other middleware runs at all. For
    every other view it delegates to ``self.get_response(request)`` and the
    normal chain proceeds.

    ``async_capable``: works under both WSGI (sync) and ASGI (async) handlers.
    """

    sync_capable = True
    async_capable = True

    def __init__(
        self, get_response: Callable[[HttpRequest], Awaitable[HttpResponse] | HttpResponse]
    ):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse | Awaitable[HttpResponse]:
        if not _is_exempt(request):
            return self.get_response(request)

        callback, callback_args, callback_kwargs = _resolve_view_and_args(request)

        # Async handler: get_response is a coroutine function, so we must
        # return an awaitable.
        if inspect.iscoroutinefunction(self.get_response):
            return self._exempt_async(callback, callback_args, callback_kwargs, request)

        return _call_view_sync(callback, callback_args, callback_kwargs, request)

    async def _exempt_async(
        self,
        callback: Callable,
        callback_args: tuple,
        callback_kwargs: dict,
        request: HttpRequest,
    ) -> HttpResponse:
        return await _call_view_async(callback, callback_args, callback_kwargs, request)
