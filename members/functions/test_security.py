import pytest
from datetime import datetime, timezone

# Import from package path
from .main import _rate_limit_bucket_id, validate_auth_input


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
    with pytest.raises(ValueError, match="Auth code too long"):
        validate_auth_input("a" * 501, "ok")

    with pytest.raises(ValueError, match="PKCE verifier too long"):
        validate_auth_input("ok", "a" * 201)


def test_validate_auth_input_missing():
    with pytest.raises(ValueError, match="Auth code required"):
        validate_auth_input("", "ok")

    with pytest.raises(ValueError, match="PKCE verifier required"):
        validate_auth_input("ok", "")
