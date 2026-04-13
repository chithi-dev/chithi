import time
from collections.abc import Callable
from ipaddress import (
    AddressValueError,
    IPv4Address,
    IPv6Address,
    ip_address,
)
from typing import Any, Sequence, TypeAlias

from fastapi import HTTPException
from starlette.requests import HTTPConnection

from app.deps import RedisDep
from app.lua import rate_limit
from app.settings import settings

RateLimit: TypeAlias = tuple[int, int]
RateLimits: TypeAlias = Sequence[RateLimit]

# ---------------------------------------------------------------------------
# Trusted proxy detection
#
# A peer is considered a trusted reverse proxy if its IP falls into any
# range that the ipaddress module classifies as reserved for internal use:
#
#   IPv4 loopback   127.0.0.0/8        (same-host deploys, dev)
#   IPv4 private    10/8, 172.16/12, 192.168/16  (LAN, k8s, docker)
#   IPv4 link-local 169.254.0.0/16     (APIPA / cloud metadata links)
#   IPv6 loopback   ::1/128
#   IPv6 unique-local fc00::/7         (IPv6 equivalent of RFC-1918)
#   IPv6 link-local fe80::/10
#
# ---------------------------------------------------------------------------


def _parse_ip(raw: str) -> IPv4Address | IPv6Address | None:
    """Return a parsed IP address or *None* if *raw* is not a valid address."""
    try:
        return ip_address(raw.strip())
    except AddressValueError, ValueError:
        return None


def _is_trusted_proxy(raw: str) -> bool:
    addr = _parse_ip(raw)
    if addr is None:
        return False
    return (
        addr.is_loopback
        or addr.is_private
        or addr.is_link_local
        or any(addr in net for net in settings.EXTRA_TRUSTED_PROXY_IP)
    )


def _extract_client_ip(request: HTTPConnection) -> str:
    """Return the best-effort real client IP for *request*.

    Strategy
    --------
    1. Determine the direct peer IP (``request.client.host``).
    2. If the peer is **not** a trusted proxy the connection is direct —
       return the peer IP immediately.  No headers are consulted, so a
       malicious ``X-Forwarded-For`` header cannot poison the rate-limit key.
    3. If the peer **is** a trusted proxy we are behind a reverse proxy.
       We then consult headers in order of specificity:

       a. ``X-Forwarded-For``  — may be a comma-separated chain
          ``client, proxy1, proxy2``.  We walk from the right (most recently
          appended) and return the first IP that is *not* a trusted proxy.
          This correctly handles stacked proxies and Cloudflare prepending the
          visitor IP while nginx appends its own.
       b. ``X-Real-IP``  — fallback set by nginx ``proxy_set_header X-Real-IP``.

    4. If none of the above yield a usable address we fall back to the peer
       IP or the sentinel ``"unknown"``.
    """
    peer_ip: str | None = request.client.host if request.client else None

    # Direct connection (no reverse proxy)
    if peer_ip and not _is_trusted_proxy(peer_ip):
        return peer_ip

    headers = request.headers

    # X-Forwarded-For
    if xff := headers.get("x-forwarded-for", ""):
        # Walk right-to-left; skip addresses belonging to trusted proxies.
        candidates = [p.strip() for p in xff.split(",") if p.strip()]
        for raw in reversed(candidates):
            if _parse_ip(raw) is not None and not _is_trusted_proxy(raw):
                return raw
        # Every address in XFF is a trusted proxy (unusual but possible in
        # all-internal deployments).  Return the left-most (original client).
        if candidates:
            return candidates[0]

    # X-Real-IP
    if (x_real := headers.get("x-real-ip", "").strip()) and _parse_ip(
        x_real
    ) is not None:
        return x_real

    return peer_ip or "unknown"


# FastAPI / Starlette dependency
async def rate_limiter_guard(request: HTTPConnection, redis_client: RedisDep) -> None:
    """Enforce rate limits attached to an endpoint via ``_rate_limits``.

    ``_rate_limits`` must be a sequence of ``(limit, window_seconds)`` tuples,
    typically attached by a decorator
    """
    if request.scope.get("type") == "websocket":
        return

    endpoint: Callable[..., Any] | None = request.scope.get("endpoint")
    if endpoint is None:
        return

    limits: RateLimits | None = getattr(endpoint, "_rate_limits", None)
    if not limits:
        return

    client_ip = _extract_client_ip(request)
    endpoint_name: str = getattr(endpoint, "__name__", "unknown")
    now: float = time.time()

    for limit, window in limits:
        key = f"rl:{client_ip}:{endpoint_name}:{window}"

        is_limited = bool(
            redis_client.eval(
                rate_limit.code, 1, key, str(now), str(window), str(limit)
            )
        )

        if is_limited:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {limit} requests per {window}s.",
            )
