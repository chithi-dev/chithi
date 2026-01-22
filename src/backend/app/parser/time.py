import re


def parse_rate_string(rate_string: str) -> tuple[int, int]:
    pattern = r"(\d+)req/(sec|min|hour|day)"
    match = re.match(pattern, rate_string.lower())
    if not match:
        raise ValueError(f"Invalid rate: {rate_string}")

    seconds_map = {"sec": 1, "min": 60, "hour": 3600, "day": 86400}
    return int(match.group(1)), seconds_map[match.group(2)]
