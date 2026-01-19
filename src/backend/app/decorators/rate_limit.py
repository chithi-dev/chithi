from app.parser.time import parse_rate_string


def rate_limit(*rates: str):
    """Marks the endpoint with rate limit metadata."""
    parsed_rates = [parse_rate_string(r) for r in rates]

    def decorator(func):
        # Attach the limits directly to the function object
        func._rate_limits = parsed_rates
        return func

    return decorator
