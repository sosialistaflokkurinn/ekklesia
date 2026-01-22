"""
List Postal Codes Cloud Function

Returns all postal codes (póstnúmer) for dropdown selection in registration forms.
Data is read from Cloud SQL (map_postalcode table).

Usage:
    listPostalCodes({})
    Returns: [{"id": 1, "code": "101", "region": {"id": 1, "name": "..."}}, ...]

Caching:
    Uses in-memory cache with 1 hour TTL.
"""

import logging
import time
from typing import Optional, List

from firebase_functions import https_fn, options

from db_lookups import get_postal_codes

logger = logging.getLogger(__name__)

# In-memory cache
_cache: Optional[List[dict]] = None
_cache_time: float = 0
CACHE_TTL_SECONDS = 3600  # 1 hour


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
    secrets=["django-socialism-db-password"],
)
def list_postal_codes(req: https_fn.CallableRequest) -> List[dict]:
    """List all postal codes for dropdown selection."""
    global _cache, _cache_time

    try:
        # Return cached data if valid
        if _cache and (time.time() - _cache_time) < CACHE_TTL_SECONDS:
            logger.info(f"Returning {len(_cache)} postal codes from cache")
            return _cache

        logger.info("Fetching postal codes from Cloud SQL")
        results = get_postal_codes()

        # Update cache
        _cache = results
        _cache_time = time.time()

        logger.info(f"Returning {len(results)} postal codes")
        return results

    except Exception as e:
        logger.error(f"Failed to fetch postal codes: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch postal codes: {str(e)}"
        )
