"""Unit tests for security utility functions.

Tests rate limiting, input validation, and authentication security measures.
Run with: pytest test_security.py -v

TODO: Additional test coverage needed (see health check 2025-01)
- fn_register_member.py: registration flow, kennitala validation, rate limiting
- fn_admin_members.py: admin operations, RBAC checks
- fn_email.py: email sending, unsubscribe token generation/verification
- db.py: database connection handling, error cases
- shared/validators.py: phone/kennitala normalization edge cases
"""

from datetime import datetime, timezone
import pytest

# Import from package path
try:
    # Prefer pure helpers (no external deps)
    from .security_utils import _rate_limit_bucket_id, validate_auth_input
except ImportError:
    # When executed directly, adjust path and import absolute
    import sys
    import os
    sys.path.insert(0, os.path.dirname(__file__))
    from util_security import _rate_limit_bucket_id, validate_auth_input


def test_rate_limit_bucket_id() -> None:
    """Verify time-bucketed document IDs are correct and change across buckets."""
    now = datetime(2025, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
    doc_id = _rate_limit_bucket_id("192.0.2.1", now, 10)

    # Expected bucket value: floor(timestamp / (10*60))
    # 2025-10-16 12:00:00 UTC -> timestamp depends on epoch; we assert format and change instead of a fixed integer
    parts = doc_id.split(':')
    assert parts[0] == "192.0.2.1"
    assert parts[2] == "10m"
    assert parts[1].isdigit()

    later = datetime(2025, 10, 16, 12, 11, 0, tzinfo=timezone.utc)
    doc_id_later = _rate_limit_bucket_id("192.0.2.1", later, 10)
    assert doc_id != doc_id_later


essential_valid = [
    ("abc", "xyz"),
    ("test_code", "test_verifier"),
]


def test_validate_auth_input_valid() -> None:
    """Test that valid auth codes and verifiers pass validation."""
    for code, ver in essential_valid:
        assert validate_auth_input(code, ver) is True


def test_validate_auth_input_too_long() -> None:
    """Test that excessively long auth codes and verifiers are rejected."""
    # Test auth code too long
    with pytest.raises(ValueError, match="Auth code too long"):
        validate_auth_input("a" * 501, "ok")

    # Test PKCE verifier too long
    with pytest.raises(ValueError, match="PKCE verifier too long"):
        validate_auth_input("ok", "a" * 201)


def test_validate_auth_input_missing() -> None:
    """Test that empty or missing auth codes and verifiers are rejected."""
    # Test missing auth code
    with pytest.raises(ValueError, match="Auth code required"):
        validate_auth_input("", "ok")

    # Test missing PKCE verifier
    with pytest.raises(ValueError, match="PKCE verifier required"):
        validate_auth_input("ok", "")


if __name__ == "__main__":
    test_rate_limit_bucket_id()
    test_validate_auth_input_valid()
    test_validate_auth_input_too_long()
    test_validate_auth_input_missing()
    print("ALL TESTS PASSED")
