"""Custom exceptions for the Chithi SDK."""


class ChithiError(Exception):
    """Base exception for all Chithi SDK errors."""


class ValidationError(ChithiError):
    """Raised when input validation fails.

    Examples: empty file list, missing password, malformed bundle.
    """


class CryptoError(ChithiError):
    """Raised when encryption or decryption fails.

    Examples: wrong password, corrupted data, signature mismatch.
    """


class CompressionError(ChithiError):
    """Raised when compression or decompression fails.

    Examples: invalid archive format, corrupted 7z data.
    """
