import logging


def parse_string_to_log(log_type: str) -> int:
    match log_type:
        case "critical":
            return logging.CRITICAL
        case "debug":
            return logging.DEBUG
        case "warning":
            return logging.WARNING
        case "info":
            return logging.INFO
        case "error":
            return logging.ERROR
        case _:
            raise ValueError(f"`{log_type}` is not supported")
