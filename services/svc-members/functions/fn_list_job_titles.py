"""
List Job Titles Cloud Function

Returns all job titles (starfsheiti) for dropdown selection in registration forms.
Data is read from Cloud SQL (membership_title table).

Usage:
    listJobTitles({})
    Returns: [{"id": 1, "name": "Aðstoðarmaður"}, ...]

Caching:
    Uses in-memory cache with 1 hour TTL.
"""

import logging
import time
from typing import Optional, List

from firebase_functions import https_fn, options

from db_lookups import get_job_titles

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
def list_job_titles(req: https_fn.CallableRequest) -> List[dict]:
    """List all job titles for dropdown selection."""
    global _cache, _cache_time

    try:
        # Return cached data if valid
        if _cache and (time.time() - _cache_time) < CACHE_TTL_SECONDS:
            logger.info(f"Returning {len(_cache)} job titles from cache")
            return _cache

        logger.info("Fetching job titles from Cloud SQL")
        results = get_job_titles()

        # Update cache
        _cache = results
        _cache_time = time.time()

        logger.info(f"Returning {len(results)} job titles")
        return results

    except Exception as e:
        logger.error(f"Failed to fetch job titles: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch job titles: {str(e)}"
        )
