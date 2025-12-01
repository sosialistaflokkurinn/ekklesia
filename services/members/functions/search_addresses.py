"""
Address Search Cloud Function

Provides autocomplete functionality for Icelandic addresses using the iceaddr library.
Returns matching addresses as user types for real-time suggestions.

Usage:
    searchAddresses({ query: "Njáls" })
    Returns: { results: [...], error: null }
"""

import logging
from typing import Any

from firebase_functions import https_fn, options
from iceaddr import iceaddr_lookup

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
)
def search_addresses(req: https_fn.CallableRequest) -> dict[str, Any]:
    """
    Search for Icelandic addresses by partial street name.

    Args:
        req.data.query: Search string (min 2 characters)
        req.data.limit: Max results to return (default 10, max 20)

    Returns:
        dict with 'results' array and 'error' string (null if success)

    Example:
        Input: { "query": "Njáls" }
        Output: {
            "results": [
                {
                    "street": "Njálsgata",
                    "number": 1,
                    "letter": "",
                    "postal_code": 101,
                    "city": "Reykjavík",
                    "latitude": 64.143...,
                    "longitude": -21.928...,
                    "hnitnum": 10023362,
                    "display": "Njálsgata 1, 101 Reykjavík"
                },
                ...
            ],
            "error": null
        }
    """
    # Extract parameters
    data = req.data or {}
    query = data.get("query", "").strip()
    limit = min(data.get("limit", 10), 20)  # Cap at 20 results

    # Validate query
    if len(query) < 2:
        logger.info(f"Query too short: '{query}'")
        return {"results": [], "error": None}

    try:
        logger.info(f"Searching addresses for: '{query}'")

        # Use iceaddr to search
        # iceaddr_lookup returns list of dicts with address info
        results = iceaddr_lookup(query)

        # Limit results
        limited = results[:limit]

        logger.info(f"Found {len(results)} results, returning {len(limited)}")

        # Format for frontend
        formatted = []
        for r in limited:
            street = r.get("heiti_nf", "")
            number = r.get("husnr", "")
            letter = r.get("bokst", "") or ""
            postal_code = r.get("postnr", "")
            city = r.get("stadur_nf", "")

            # Build display string
            number_str = str(number) if number else ""
            display = f"{street} {number_str}{letter}".strip()
            if postal_code or city:
                display += f", {postal_code} {city}".strip()

            formatted.append({
                "street": street,
                "number": number,
                "letter": letter,
                "postal_code": postal_code,
                "city": city,
                "latitude": r.get("lat_wgs84"),
                "longitude": r.get("long_wgs84"),
                "hnitnum": r.get("hnitnum"),
                "display": display
            })

        return {"results": formatted, "error": None}

    except Exception as e:
        logger.error(f"Address search failed: {e}")
        return {"results": [], "error": str(e)}
