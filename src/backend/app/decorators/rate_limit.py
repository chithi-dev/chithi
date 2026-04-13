from collections.abc import Callable

from app.parser.time import parse_rate_string


def rate_limit[F](*rates: str) -> Callable[[F], F]:
    """Marks the endpoint with rate limit metadata."""
    parsed_rates = [parse_rate_string(r) for r in rates]

    def decorator(func: F) -> F:
        setattr(func, "_rate_limits", parsed_rates)
        return func

    return decorator
