"""
List Job Titles Cloud Function

Returns all job titles (starfsheiti) for dropdown selection in registration forms.
Data is stored in Firestore collection 'lookup_job_titles'.

Usage:
    listJobTitles({})
    Returns: { results: [...], error: null }

Caching:
    Uses in-memory cache with 1 hour TTL.
    Cache persists across invocations on the same container instance.
"""

import logging
import time
from typing import Any, Optional, List

from firebase_functions import https_fn, options
from firebase_admin import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory cache (persists across invocations on same container)
_job_titles_cache: Optional[List[dict]] = None
_job_titles_cache_time: float = 0
CACHE_TTL_SECONDS = 3600  # 1 hour


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
)
def list_job_titles(req: https_fn.CallableRequest) -> dict[str, Any]:
    """
    List all job titles for dropdown selection.

    Args:
        req.data: Optional parameters (currently none used)

    Returns:
        dict with 'results' array matching Django format:
        [
            {"id": 1, "name": "Aðstoðarmaður"},
            ...
        ]
        and 'error' string (null if success)

    Note:
        Results are sorted by name for consistent display.
        Format matches Django /kort/starfsheiti/ endpoint.
        Uses in-memory cache with 1 hour TTL.
    """
    global _job_titles_cache, _job_titles_cache_time

    try:
        # Return cached data if valid
        if _job_titles_cache and (time.time() - _job_titles_cache_time) < CACHE_TTL_SECONDS:
            logger.info(f"Returning {len(_job_titles_cache)} job titles from cache")
            return _job_titles_cache

        logger.info("Fetching job titles from Firestore")

        db = firestore.client()
        collection_ref = db.collection('lookup_job_titles')

        # Fetch all job titles
        docs = collection_ref.order_by('name').stream()

        # Format for frontend (matching Django response format)
        results = []
        for doc in docs:
            data = doc.to_dict()
            results.append({
                'id': data.get('id'),
                'name': data.get('name'),
            })

        # Update cache
        _job_titles_cache = results
        _job_titles_cache_time = time.time()

        logger.info(f"Returning {len(results)} job titles (cached)")
        return results

    except Exception as e:
        logger.error(f"Failed to fetch job titles: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch job titles: {str(e)}"
        )
