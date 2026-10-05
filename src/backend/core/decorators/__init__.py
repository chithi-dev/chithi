"""Reusable view decorators.

Currently contains:
- ``exempt_middleware`` -- the ``middleware_exempt`` decorator.
"""

from core.decorators.exempt_middleware import middleware_exempt

__all__ = ["middleware_exempt"]
