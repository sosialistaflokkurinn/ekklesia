"""
List Unions Cloud Function

Returns all unions (stéttarfélög) for dropdown selection in registration forms.
Data is read from Cloud SQL (membership_union table).

Usage:
    listUnions({})
    Returns: [{"id": 1, "name": "VR", ...}, ...]

Caching:
    Uses in-memory cache with 1 hour TTL.
"""

import logging
import time
from typing import Any, Optional, List

from firebase_functions import https_fn, options

from db_lookups import get_unions

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
def list_unions(req: https_fn.CallableRequest) -> List[dict]:
    """List all unions for dropdown selection."""
    global _cache, _cache_time

    try:
        # Return cached data if valid
        if _cache and (time.time() - _cache_time) < CACHE_TTL_SECONDS:
            logger.info(f"Returning {len(_cache)} unions from cache")
            return _cache

        logger.info("Fetching unions from Cloud SQL")
        results = get_unions()

        # Update cache
        _cache = results
        _cache_time = time.time()

        logger.info(f"Returning {len(results)} unions")
        return results

    except Exception as e:
        logger.error(f"Failed to fetch unions: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch unions: {str(e)}"
        )
