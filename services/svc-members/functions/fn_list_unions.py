"""
List Unions Cloud Function

Returns all unions (stéttarfélög) for dropdown selection in registration forms.
Data is stored in Firestore collection 'lookup_unions'.

Usage:
    listUnions({})
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
def list_unions(req: https_fn.CallableRequest) -> dict[str, Any]:
    """
    List all unions for dropdown selection.

    Args:
        req.data: Optional parameters (currently none used)

    Returns:
        dict with 'results' array matching Django format:
        [
            {"id": 1, "name": "VR", "abbreviation": "VR", "logo": null},
            ...
        ]
        and 'error' string (null if success)

    Note:
        Results are sorted by name for consistent display.
        Format matches Django /kort/stettarfelog/ endpoint.
    """
    try:
        logger.info("Fetching unions from Firestore")

        db = firestore.client()
        collection_ref = db.collection('lookup_unions')

        # Fetch all unions
        docs = collection_ref.order_by('name').stream()

        # Format for frontend (matching Django response format)
        results = []
        for doc in docs:
            data = doc.to_dict()
            results.append({
                'id': data.get('id'),
                'name': data.get('name'),
                'abbreviation': data.get('abbreviation'),
                'logo': data.get('logo'),
            })

        logger.info(f"Returning {len(results)} unions")
        return results

    except Exception as e:
        logger.error(f"Failed to fetch unions: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch unions: {str(e)}"
        )
