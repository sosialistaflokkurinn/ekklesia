"""
Authentication helpers for Cloud Functions.
"""

from typing import Dict, Any
from firebase_admin import auth
from firebase_functions import https_fn
from util_logging import log_json

def verify_firebase_token(req: https_fn.Request) -> Dict[str, Any]:
    """
    Verify Firebase ID token from Authorization header.
    
    Args:
        req: The HTTP request object.
        
    Returns:
        Decoded token dict if valid.
        
    Raises:
        https_fn.HttpsError: If token is missing or invalid.
    """
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Missing or invalid Authorization header"
        )
    
    token = auth_header.split('Bearer ')[1]
    
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        log_json("error", "Token verification failed", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Invalid token"
        )
