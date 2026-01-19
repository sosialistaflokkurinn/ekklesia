"""
CORS utilities for Ekklesia Members Service

Handles Cross-Origin Resource Sharing configuration and headers.
Updated: 2025-12-21 - Added felagar.sosialistaflokkurinn.is
"""

import os
from typing import Optional


# Default allowed origins for CORS
DEFAULT_ALLOWED_ORIGINS = [
    'https://ekklesia-prod-10-2025.web.app',
    'https://ekklesia-prod-10-2025.firebaseapp.com',
    'https://felagar.sosialistaflokkurinn.is',
    'https://sosialistaflokkurinn.is',
    'https://xj-next-521240388393.europe-west1.run.app',
    'http://localhost:3000'
]


def parse_allowed_origins() -> list[str]:
    """
    Parse allowed origins from environment variable or use defaults.

    Environment variable CORS_ALLOWED_ORIGINS can be:
    - Empty: Use DEFAULT_ALLOWED_ORIGINS
    - '*': Allow all origins
    - Comma or semicolon separated list: Use specified origins

    Returns:
        List of allowed origin strings
    """
    allowlist_env = os.getenv('CORS_ALLOWED_ORIGINS', '').strip()
    if not allowlist_env:
        return DEFAULT_ALLOWED_ORIGINS
    if allowlist_env == '*':
        return ['*']
    normalized = allowlist_env.replace(';', ',')
    allowed = [origin.strip() for origin in normalized.split(',') if origin.strip()]
    return allowed if allowed else DEFAULT_ALLOWED_ORIGINS


def get_allowed_origin(req_origin: Optional[str]) -> str:
    """
    Get the appropriate allowed origin for CORS headers.

    Args:
        req_origin: Origin from request headers

    Returns:
        Allowed origin to use in response headers
    """
    allowed = parse_allowed_origins()
    if '*' in allowed:
        return '*'
    if req_origin and req_origin in allowed:
        return req_origin
    # Default to first allowed origin for preflight when origin is absent or not allowed
    return allowed[0]


def cors_headers_for_origin(origin: str) -> dict:
    """
    Generate CORS headers for the given origin.

    Args:
        origin: Allowed origin

    Returns:
        Dictionary of CORS headers
    """
    return {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck, X-Request-ID, X-Correlation-ID',
        'Access-Control-Expose-Headers': 'X-Correlation-ID',
        'Access-Control-Max-Age': '3600',
    }
