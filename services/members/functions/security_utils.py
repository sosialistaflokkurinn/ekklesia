"""Pure helper functions for security-related logic (no external dependencies)."""

import re
from datetime import datetime


def validate_auth_input(kenni_auth_code: str, pkce_code_verifier: str) -> bool:
    """
    Validate authentication input parameters (length, presence, and character set).

    OAuth authorization codes and PKCE verifiers should only contain
    base64url-safe characters: A-Z, a-z, 0-9, hyphen, underscore, and period.

    Raises ValueError on invalid input; returns True otherwise.
    """
    if not kenni_auth_code:
        raise ValueError("Auth code required")
    if not pkce_code_verifier:
        raise ValueError("PKCE verifier required")

    # Length validation
    if len(kenni_auth_code) > 500:
        raise ValueError("Auth code too long (max 500 characters)")
    if len(pkce_code_verifier) > 200:
        raise ValueError("PKCE verifier too long (max 200 characters)")

    # Character set validation (base64url-safe characters)
    # OAuth codes and PKCE verifiers should only contain: A-Z, a-z, 0-9, -, _, .
    valid_pattern = re.compile(r'^[A-Za-z0-9\-_.]+$')

    if not valid_pattern.match(kenni_auth_code):
        raise ValueError("Auth code contains invalid characters (only A-Z, a-z, 0-9, -, _, . allowed)")

    if not valid_pattern.match(pkce_code_verifier):
        raise ValueError("PKCE verifier contains invalid characters (only A-Z, a-z, 0-9, -, _, . allowed)")

    return True


def _rate_limit_bucket_id(ip_address: str, now: datetime, window_minutes: int) -> str:
    """Create a stable document id for the (ip, window) bucket.

    Documents naturally age out: each doc id encodes the time bucket and window size.
    As time advances into a new bucket, the previous bucket is never read again, so
    old docs become orphaned without needing an explicit cleanup job.
    """
    window_seconds = window_minutes * 60
    bucket = int(now.timestamp()) // window_seconds
    return f"{ip_address}:{bucket}:{window_minutes}m"
