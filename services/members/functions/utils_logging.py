import json
import os
from typing import Any, Dict

SENSITIVE_KEYS = {
    "authorization", "token", "id_token", "access_token", "refresh_token",
    "client_secret", "password", "kennitala", "ssn", "phone", "phonenumber"
}


def sanitize_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """Mask sensitive fields recursively."""
    def _sanitize(value):
        if isinstance(value, dict):
            return {k: ("***" if k.lower() in SENSITIVE_KEYS else _sanitize(v)) for k, v in value.items()}
        if isinstance(value, list):
            return [_sanitize(v) for v in value]
        return value

    return _sanitize(data)  # type: ignore


def log_json(level: str, message: str, **kwargs: Any) -> None:
    """Log structured JSON message to Cloud Logging.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        message: Human-readable log message
        **kwargs: Additional structured fields
    """
    payload = {
        "severity": level.upper(),
        "message": message,
        **sanitize_fields(kwargs),
    }
    # Print JSON string; Cloud Logging parses structured logs from stdout/stderr
    print(json.dumps(payload, ensure_ascii=False))
