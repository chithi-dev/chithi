"""Middleware package -- one module per concern.

- ``exempt`` -- the ``middleware_exempt`` decorator + the :class:`ExemptMiddleware` base (skip-check hook).
- ``my``     -- :class:`MyMiddleware`, invokes exempt-flagged views directly, bypassing all other middleware.
- ``jwt``    -- :class:`JwtAuthenticationMiddleware`, Bearer-JWT auth.

All names are re-exported here so ``from core.middlewares import JwtAuthenticationMiddleware``
and friends work directly.
"""

from core.middlewares.exempt import ExemptMiddleware, middleware_exempt
from core.middlewares.jwt import JwtAuthenticationMiddleware
from core.middlewares.my import MyMiddleware

__all__ = [
    "ExemptMiddleware",
    "JwtAuthenticationMiddleware",
    "MyMiddleware",
    "middleware_exempt",
]
