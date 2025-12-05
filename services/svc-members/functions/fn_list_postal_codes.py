"""
List Postal Codes Cloud Function

Returns all postal codes (póstnúmer) for dropdown selection in registration forms.
Data is stored in Firestore collection 'lookup_postal_codes'.

Usage:
    listPostalCodes({})
    Returns: { results: [...], error: null }
"""

import logging
from typing import Any

from firebase_functions import https_fn, options
from firebase_admin import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
)
def list_postal_codes(req: https_fn.CallableRequest) -> dict[str, Any]:
    """
    List all postal codes for dropdown selection.

    Args:
        req.data: Optional parameters (currently none used)

    Returns:
        dict with 'results' array matching Django format:
        [
            {
                "id": 1,
                "code": "101",
                "region": {"id": 1, "name": "Höfuðborgarsvæðið"}
            },
            ...
        ]
        and 'error' string (null if success)

    Note:
        Results are sorted by code for consistent display.
        Format matches Django /kort/pnr/ endpoint.
    """
    try:
        logger.info("Fetching postal codes from Firestore")

        db = firestore.client()
        collection_ref = db.collection('lookup_postal_codes')

        # Fetch all postal codes
        docs = collection_ref.order_by('code').stream()

        # Format for frontend (matching Django response format)
        results = []
        for doc in docs:
            data = doc.to_dict()
            # Reconstruct region object to match Django format
            region = None
            if data.get('region_id'):
                region = {
                    'id': data.get('region_id'),
                    'name': data.get('region_name'),
                }
            results.append({
                'id': data.get('id'),
                'code': data.get('code'),
                'region': region,
            })

        logger.info(f"Returning {len(results)} postal codes")
        return results

    except Exception as e:
        logger.error(f"Failed to fetch postal codes: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch postal codes: {str(e)}"
        )
