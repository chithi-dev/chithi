import re

RATE_PATTERN = re.compile(r"(\d+)req/(sec|min|hour|day)", re.IGNORECASE)


def parse_rate_string(rate_string: str) -> tuple[int, int]:
    regex_match = RATE_PATTERN.match(rate_string)
    if not regex_match:
        raise ValueError(f"Invalid rate: {rate_string}")

    seconds_map = {
        "sec": 1,
        "min": 60,
        "hour": 3600,
        "day": 86400,
    }
    return int(regex_match.group(1)), seconds_map[regex_match.group(2).lower()]
