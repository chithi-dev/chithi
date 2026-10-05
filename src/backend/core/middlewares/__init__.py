"""Middleware package -- one module per concern.

- ``exempt``           -- the :class:`ExemptMiddleware` base (skip-check hook).
- ``my``               -- :class:`MyMiddleware`, the project's custom middleware.
- ``jwt``              -- :class:`JwtAuthenticationMiddleware`, Bearer-JWT auth.

The ``middleware_exempt`` decorator lives in :mod:`core.decorators.exempt_middleware`;
it is re-exported here for convenience so ``from core.middlewares import
middleware_exempt`` continues to work.
"""

from core.decorators.exempt_middleware import middleware_exempt  # noqa: F401 -- re-export
from core.middlewares.exempt import ExemptMiddleware
from core.middlewares.jwt import JwtAuthenticationMiddleware
from core.middlewares.my import MyMiddleware

__all__ = [
    "ExemptMiddleware",
    "JwtAuthenticationMiddleware",
    "MyMiddleware",
    "middleware_exempt",
]
