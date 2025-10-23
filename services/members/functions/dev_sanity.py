"""
Lightweight sanity checks for utility modules (no network calls).

Run locally: python3 -m members.functions.dev_sanity
"""

from utils_logging import log_json, sanitize_fields
from util_jwks import get_jwks_cache_stats


def main():
    # Test structured logging and sanitization
    log_json("info", "Sanity: structured log", requestId="test-123", token="secret123", nested={"access_token": "abc"})

    masked = sanitize_fields({"password": "hunter2", "ok": True})
    assert masked["password"] == "***"

    # Should not perform network; just stats from empty cache
    stats = get_jwks_cache_stats()
    assert "hits" in stats and "misses" in stats and "size" in stats
    log_json("debug", "Sanity: jwks cache stats", **stats)

    log_json("info", "Sanity checks passed")


if __name__ == "__main__":
    main()
