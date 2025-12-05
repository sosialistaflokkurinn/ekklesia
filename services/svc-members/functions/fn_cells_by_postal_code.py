"""
Cells by Postal Code Cloud Function

Returns cells (sellur) that intersect with a given postal code.
Data is pre-computed and stored in Firestore collection 'postal_code_cells'.

Usage:
    getCellsByPostalCode({postal_code_id: 1})
    Returns: [{"id": 1, "name": "Sella Miðbæjar"}, ...]
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
    """
    try:
        data = req.data or {}
        postal_code_id = data.get('postal_code_id')

        if postal_code_id is None:
            logger.warning("No postal_code_id provided")
            return []

        logger.info(f"Fetching cells for postal code {postal_code_id}")

        db = firestore.client()
        doc_ref = db.collection('postal_code_cells').document(str(postal_code_id))
        doc = doc_ref.get()

        if not doc.exists:
            logger.info(f"No cells found for postal code {postal_code_id}")
            return []

        data = doc.to_dict()
        cells = data.get('cells', [])

        logger.info(f"Returning {len(cells)} cells for postal code {postal_code_id}")
        return cells

    except Exception as e:
        logger.error(f"Failed to fetch cells: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch cells: {str(e)}"
        )
