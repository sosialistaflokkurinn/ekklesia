"""
Cells by Postal Code Cloud Function

Returns cells (sellur) that intersect with a given postal code.
Data is pre-computed and stored in Firestore collection 'postal_code_cells'.

Usage:
    getCellsByPostalCode({postal_code_id: 1})
    Returns: [{"id": 1, "name": "Sella Miðbæjar"}, ...]

Caching:
    Uses in-memory cache with 1 hour TTL, keyed by postal_code_id.
    Cache persists across invocations on the same container instance.
"""

import logging
import time
from typing import Any, Dict, Tuple, List

from firebase_functions import https_fn, options
from firebase_admin import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory cache: {postal_code_id: (cells_list, cache_time)}
_cells_cache: Dict[int, Tuple[List[dict], float]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
)
def get_cells_by_postal_code(req: https_fn.CallableRequest) -> list[dict[str, Any]]:
    """
    Get cells that intersect with a postal code.

    Args:
        req.data: {postal_code_id: int} - The postal code ID to query

    Returns:
        List of cells matching Django format:
        [
            {"id": 1, "name": "Sella Miðbæjar"},
            ...
        ]

    Note:
        Cell-postal code mappings are pre-computed during migration.
        Format matches Django /kort/pnr-sellur/?postal_code_id= endpoint.
        Uses in-memory cache with 1 hour TTL per postal_code_id.
    """
    global _cells_cache

    try:
        data = req.data or {}
        postal_code_id = data.get('postal_code_id')

        if postal_code_id is None:
            logger.warning("No postal_code_id provided")
            return []

        # Check cache
        if postal_code_id in _cells_cache:
            cells, cache_time = _cells_cache[postal_code_id]
            if (time.time() - cache_time) < CACHE_TTL_SECONDS:
                logger.info(f"Returning {len(cells)} cells for postal code {postal_code_id} from cache")
                return cells

        logger.info(f"Fetching cells for postal code {postal_code_id}")

        db = firestore.client()
        doc_ref = db.collection('postal_code_cells').document(str(postal_code_id))
        doc = doc_ref.get()

        if not doc.exists:
            logger.info(f"No cells found for postal code {postal_code_id}")
            # Cache empty result too
            _cells_cache[postal_code_id] = ([], time.time())
            return []

        doc_data = doc.to_dict()
        cells = doc_data.get('cells', [])

        # Update cache
        _cells_cache[postal_code_id] = (cells, time.time())

        logger.info(f"Returning {len(cells)} cells for postal code {postal_code_id} (cached)")
        return cells

    except Exception as e:
        logger.error(f"Failed to fetch cells: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch cells: {str(e)}"
        )
