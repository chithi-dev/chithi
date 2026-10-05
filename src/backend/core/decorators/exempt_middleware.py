"""``middleware_exempt`` decorator.

Marks a view as exempt so exempt-aware middleware (e.g. :class:`ExemptMiddleware`)
can skip it. The flag is set directly on the view function -- no wrapper is
created, so the view's call signature, name, and return behaviour are all
preserved.

Usage::

    from core.decorators.exempt_middleware import middleware_exempt

    @middleware_exempt
    def my_view(request):
        ...
"""

from typing import Callable


def middleware_exempt(view_func: Callable) -> Callable:
    """Flag *view_func* as exempt.

    Sets ``middleware_exempt = True`` directly on the function. No wrapping,
    so the view keeps its original name, signature, and return value.
    """
    view_func.middleware_exempt = True  # type: ignore[attr-defined]
    return view_func
