from datetime import datetime, timezone

# Import from package path
try:
    # Prefer pure helpers (no external deps)
    from .security_utils import _rate_limit_bucket_id, validate_auth_input
except ImportError:
    # When executed directly, adjust path and import absolute
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from security_utils import _rate_limit_bucket_id, validate_auth_input


def test_rate_limit_bucket_id():
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


def test_validate_auth_input_valid():
    for code, ver in essential_valid:
        assert validate_auth_input(code, ver) is True


def test_validate_auth_input_too_long():
    try:
        validate_auth_input("a" * 501, "ok")
        raise AssertionError("Expected ValueError for long auth code")
    except ValueError as e:
        assert "Auth code too long" in str(e)

    try:
        validate_auth_input("ok", "a" * 201)
        raise AssertionError("Expected ValueError for long verifier")
    except ValueError as e:
        assert "PKCE verifier too long" in str(e)


def test_validate_auth_input_missing():
    try:
        validate_auth_input("", "ok")
        raise AssertionError("Expected ValueError for missing auth code")
    except ValueError as e:
        assert "Auth code required" in str(e)

    try:
        validate_auth_input("ok", "")
        raise AssertionError("Expected ValueError for missing verifier")
    except ValueError as e:
        assert "PKCE verifier required" in str(e)


if __name__ == "__main__":
    test_rate_limit_bucket_id()
    test_validate_auth_input_valid()
    test_validate_auth_input_too_long()
    test_validate_auth_input_missing()
    print("ALL TESTS PASSED")
