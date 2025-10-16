import time
import requests
import jwt
from typing import Dict, Tuple

# Simple TTL cache for JWKS clients keyed by issuer URL
# Structure: { issuer_url: (PyJWKClient, expires_at, hits, misses) }
_cache: Dict[str, Tuple[jwt.PyJWKClient, float, int, int]] = {}


def _now() -> float:
    return time.time()


def get_jwks_client_cached_ttl(issuer_url: str, ttl_seconds: int = 3600) -> jwt.PyJWKClient:
    global _cache
    info = _cache.get(issuer_url)
    headers = {'User-Agent': 'Mozilla/5.0'}

    if info is not None:
        client, expires_at, hits, misses = info
        if _now() < expires_at:
            # Cache hit
            _cache[issuer_url] = (client, expires_at, hits + 1, misses)
            return client

    # Cache miss or expired
    oidc_config_url = f"{issuer_url}/.well-known/openid-configuration"
    resp = requests.get(oidc_config_url, headers=headers)
    resp.raise_for_status()
    jwks_uri = resp.json()["jwks_uri"]

    client = jwt.PyJWKClient(jwks_uri, headers=headers)
    _cache[issuer_url] = (client, _now() + ttl_seconds, 0 if info is None else info[2], (0 if info is None else info[3]) + 1)
    return client


def get_jwks_cache_stats():
    # Aggregate simple totals for debugging
    total_hits = sum(v[2] for v in _cache.values())
    total_misses = sum(v[3] for v in _cache.values())
    size = len(_cache)
    return {"hits": total_hits, "misses": total_misses, "size": size}
