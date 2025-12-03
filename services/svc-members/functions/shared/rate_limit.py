"""
Rate limiting utilities for Ekklesia Members Service

Handles IP-based rate limiting with Firestore.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from firebase_admin import firestore
from google.cloud import firestore as gcf
from util_logging import log_json


def rate_limit_bucket_id(ip_address: str, now: datetime, window_minutes: int) -> str:
    """
    Create a stable document id for the (ip, window) bucket.

    Documents naturally age out: each doc id encodes the time bucket and window size.
    As time advances into a new bucket, the previous bucket is never read again, so
    old docs become orphaned without needing an explicit cleanup job.

    Args:
        ip_address: Client IP address
        now: Current datetime
        window_minutes: Time window in minutes

    Returns:
        Document ID for the rate limit bucket
    """
    window_seconds = window_minutes * 60
    bucket = int(now.timestamp()) // window_seconds
    return f"{ip_address}:{bucket}:{window_minutes}m"


def check_rate_limit(ip_address: Optional[str], max_attempts: int = 5, window_minutes: int = 10) -> bool:
    """
    Transactional IP-based rate limit: 5 attempts / 10 minutes (configurable).

    Uses a Firestore transaction to check-and-increment a counter in a time-bucketed document,
    minimizing lost updates under concurrency.

    Args:
        ip_address: Client IP address
        max_attempts: Maximum allowed attempts in time window
        window_minutes: Time window in minutes

    Returns:
        True if allowed; False if limited.
    """
    if not ip_address:
        # If we can't determine IP, err on the safe side but log it.
        log_json("warn", "Missing IP address for rate limiting; allowing request")
        return True

    db = firestore.client()
    now = datetime.now(timezone.utc)
    doc_id = rate_limit_bucket_id(ip_address, now, window_minutes)
    ref = db.collection('rate_limits').document(doc_id)
    expires_at = now + timedelta(minutes=window_minutes)

    @gcf.transactional
    def _attempt(transaction) -> bool:
        snapshot = ref.get(transaction=transaction)
        if snapshot.exists:
            data = snapshot.to_dict() or {}
            count = int(data.get('count', 0))
            if count >= max_attempts:
                return False
            transaction.update(ref, {
                'count': count + 1,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'expiresAt': expires_at,
                'ip': ip_address,
            })
            return True
        else:
            transaction.set(ref, {
                'count': 1,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'windowMinutes': window_minutes,
                'expiresAt': expires_at,
                'ip': ip_address,
            })
            return True

    allowed = _attempt(db.transaction())
    if not allowed:
        log_json("warn", "Rate limit exceeded", ip=ip_address, windowMinutes=window_minutes, maxAttempts=max_attempts)
    return allowed
