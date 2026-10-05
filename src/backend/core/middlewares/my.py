"""``MyMiddleware`` -- the project's custom request middleware.

Extends :class:`ExemptMiddleware`, so before running any of its logic it
checks whether the resolved view was flagged with :func:`middleware_exempt`.
Exempt views skip the logic entirely; every other view goes through it.
"""

from core.middlewares.exempt import ExemptMiddleware


class MyMiddleware(ExemptMiddleware):
    """Project middleware with the exempt skip wired in.

    Override ``_handle`` (or extend it) to add per-request work. It runs only
    for views that were **not** decorated with :func:`middleware_exempt`.
    """

    def _handle(self, request) -> None:
        # Custom per-request logic goes here. Exempt views never reach it.
        pass
