"""
Utility for handling JSON Web Key Sets (JWKS) and JWT verification.
Provides caching for JWKS clients to improve performance.
"""
import time
import os
import requests
import jwt
from typing import Dict, Tuple, Optional, Any
from utils_logging import log_json

# Simple TTL cache for JWKS clients keyed by issuer URL
# Structure: { issuer_url: (PyJWKClient, expires_at, hits, misses) }
_cache: Dict[str, Tuple[jwt.PyJWKClient, float, int, int]] = {}


def _now() -> float:
    return time.time()


DEFAULT_TTL = int(os.getenv('JWKS_CACHE_TTL_SECONDS', '3600'))
if DEFAULT_TTL <= 0:
    # Fall back to sane default
    log_json("warn", "Invalid JWKS_CACHE_TTL_SECONDS; falling back to 3600", value=DEFAULT_TTL)
    DEFAULT_TTL = 3600


def get_jwks_client_cached_ttl(issuer_url: str, ttl_seconds: Optional[int] = None) -> jwt.PyJWKClient:
    """Get or create cached JWKS client with TTL-based expiration.

    Fetches the JWKS URI from the OIDC configuration endpoint and creates
    a PyJWKClient for JWT signature verification. Results are cached with
    a configurable TTL to reduce external API calls.

    Args:
        issuer_url: OAuth issuer URL (e.g., 'https://login.kenni.is')
        ttl_seconds: Cache TTL in seconds (defaults to JWKS_CACHE_TTL_SECONDS env var or 3600)

    Returns:
        Cached or newly created PyJWKClient instance

    Raises:
        requests.HTTPError: If OIDC configuration or JWKS endpoint unreachable
    """
    ttl = ttl_seconds if ttl_seconds is not None else DEFAULT_TTL
    global _cache
    info = _cache.get(issuer_url)
    headers = {'User-Agent': 'Mozilla/5.0'}

    if info is not None:
        client, expires_at, hits, misses = info
        if _now() < expires_at:
            # Cache hit
            _cache[issuer_url] = (client, expires_at, hits + 1, misses)
            return client
        else:
            # Expired; log and refresh
            try:
                log_json("info", "JWKS cache expired, refreshing", issuer=issuer_url)
            except Exception:
                pass

    # Cache miss or expired
    oidc_config_url = f"{issuer_url}/.well-known/openid-configuration"
    resp = requests.get(oidc_config_url, headers=headers)
    resp.raise_for_status()
    jwks_uri = resp.json()["jwks_uri"]

    client = jwt.PyJWKClient(jwks_uri, headers=headers)
    _cache[issuer_url] = (client, _now() + ttl, 0 if info is None else info[2], (0 if info is None else info[3]) + 1)
    return client


def get_jwks_cache_stats() -> Dict[str, Any]:
    """Get aggregated cache statistics for monitoring and debugging.

    Returns:
        Dict with cache metrics:
            - hits: Total cache hits across all cached issuers
            - misses: Total cache misses (expired or not cached)
            - size: Number of issuers currently cached
    """
    # Aggregate simple totals for debugging
    total_hits = sum(v[2] for v in _cache.values())
    total_misses = sum(v[3] for v in _cache.values())
    size = len(_cache)
    return {"hits": total_hits, "misses": total_misses, "size": size}
