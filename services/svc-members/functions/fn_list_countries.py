"""
List Countries Cloud Function

Returns all countries (lönd) for dropdown selection in registration forms.
Data is read from Cloud SQL (map_country table).

Usage:
    listCountries({})
    Returns: [{"id": 1, "code": "IS", "name": "Ísland"}, ...]

Caching:
    Uses in-memory cache with 1 hour TTL.
"""

import logging
import time
from typing import Any, Optional, List

from firebase_functions import https_fn, options

from db_lookups import get_countries

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
def list_countries(req: https_fn.CallableRequest) -> List[dict]:
    """List all countries for dropdown selection."""
    global _cache, _cache_time

    try:
        # Return cached data if valid
        if _cache and (time.time() - _cache_time) < CACHE_TTL_SECONDS:
            logger.info(f"Returning {len(_cache)} countries from cache")
            return _cache

        logger.info("Fetching countries from Cloud SQL")
        results = get_countries()

        # Update cache
        _cache = results
        _cache_time = time.time()

        logger.info(f"Returning {len(results)} countries")
        return results

    except Exception as e:
        logger.error(f"Failed to fetch countries: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch countries: {str(e)}"
        )
