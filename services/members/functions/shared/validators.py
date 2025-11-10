"""
Validation and normalization utilities for Ekklesia Members Service

Handles kennitala and phone number validation and formatting.
"""

import re
from utils_logging import log_json


def normalize_kennitala(kennitala: str) -> str:
    """
    Normalize kennitala to 10 digits without hyphen (for use as Firestore document ID).

    Example: "010101-2980" -> "0101012980"

    Args:
        kennitala: Kennitala string (with or without hyphen)

    Returns:
        Normalized 10-digit kennitala, or original if invalid
    """
    if not kennitala:
        return None

    # Remove any whitespace and hyphens
    kennitala = kennitala.strip().replace('-', '')

    # Validate it's 10 digits
    if len(kennitala) == 10 and kennitala.isdigit():
        return kennitala

    return kennitala


def validate_kennitala(kennitala: str) -> bool:
    """
    Validate kennitala format (DDMMYY-XXXX or DDMMYYXXXX).

    Args:
        kennitala: Kennitala string to validate

    Returns:
        True if valid format, False otherwise
    """
    pattern = r'^\d{6}-?\d{4}$'
    return bool(re.match(pattern, kennitala))


def normalize_phone(phone: str) -> str:
    """
    Normalize Icelandic phone number to XXX-XXXX format.

    Handles various input formats:
    - +3545551234 -> 555-1234
    - 003545551234 -> 555-1234
    - 5551234 -> 555-1234
    - 555 1234 -> 555-1234
    - 5551-234 -> 555-1234

    Args:
        phone: Phone number string in various formats

    Returns:
        Normalized phone number in XXX-XXXX format,
        or None if input is None/empty,
        or original string if format is invalid
    """
    if not phone:
        return None

    # Remove all whitespace, dashes, parentheses, and other separators
    phone = phone.strip()
    digits = ''.join(c for c in phone if c.isdigit())

    # Remove Iceland country code prefix if present
    # +354 or 00354 -> 10 digits total
    if digits.startswith('354') and len(digits) == 10:
        digits = digits[3:]  # Remove '354' prefix

    # Validate: should be exactly 7 digits for Icelandic phone
    if len(digits) != 7:
        log_json("warn", "Invalid phone number format", original=phone, digits=digits, length=len(digits))
        return phone  # Return original if invalid

    # Format as XXX-XXXX (3 digits - hyphen - 4 digits)
    return f"{digits[:3]}-{digits[3:]}"
