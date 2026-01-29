"""
svc-members Health Check Endpoint

Simple HTTP health ping for liveness/readiness monitoring.
Used by checkSystemHealth and external monitors.
No authentication required.
"""

import json
import time
import uuid

from firebase_functions import https_fn
from shared.cors import get_allowed_origin, cors_headers_for_origin


def svc_members_health_handler(req: https_fn.Request) -> https_fn.Response:
    """
    Lightweight health check for svc-members runtime.

    Returns JSON with service status, runtime info, and timestamp.
    Supports CORS preflight (OPTIONS) and GET only.
    """
    correlation_id = (
        req.headers.get('X-Correlation-ID')
        or req.headers.get('X-Request-ID')
        or str(uuid.uuid4())
    )
    origin = get_allowed_origin(req.headers.get('Origin'))
    headers = {
        **cors_headers_for_origin(origin),
        'X-Correlation-ID': correlation_id,
    }

    if req.method == 'OPTIONS':
        return https_fn.Response("", status=204, headers=headers)

    if req.method != 'GET':
        return https_fn.Response(
            json.dumps({
                "error": "METHOD_NOT_ALLOWED",
                "message": "Use GET",
                "correlationId": correlation_id,
            }),
            status=405,
            mimetype="application/json",
            headers=headers,
        )

    body = {
        "status": "healthy",
        "service": "svc-members",
        "runtime": "firebase-functions-python",
        "region": "europe-west2",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    return https_fn.Response(
        json.dumps(body),
        status=200,
        mimetype="application/json",
        headers=headers,
    )
