"""
Validation and normalization utilities for Ekklesia Members Service

Handles kennitala and phone number validation and formatting.
"""

import re
from util_logging import log_json


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


def format_kennitala(kennitala: str) -> str:
    """
    Format Icelandic kennitala for UI display (DDMMYY-XXXX).

    This is the inverse of normalize_kennitala() - use for display only.

    Args:
        kennitala: 10-digit kennitala (e.g., "0103882369")

    Returns:
        Formatted kennitala with hyphen (e.g., "010388-2369"),
        or original string if format is invalid

    Example:
        # Database storage (normalized):
        normalized = normalize_kennitala("010388-2369")  # "0103882369"

        # UI display (formatted):
        displayed = format_kennitala(normalized)  # "010388-2369"
    """
    if not kennitala:
        return kennitala

    # Remove any existing hyphens/whitespace
    digits = ''.join(c for c in kennitala if c.isdigit())

    # Validate: should be exactly 10 digits
    if len(digits) != 10:
        return kennitala  # Return original if invalid

    # Format as DDMMYY-XXXX
    return f"{digits[:6]}-{digits[6:]}"


def normalize_phone(phone: str) -> str:
    """
    Normalize Icelandic phone number to 7 digits without hyphen (for database storage).

    Design pattern (same as kennitala):
    - UI Display: "690-3635" (formatted for readability)
    - Database: "6903635" (normalized for storage)

    Handles various input formats:
    - +3545551234 -> 5551234
    - 003545551234 -> 5551234
    - 555-1234 -> 5551234
    - 555 1234 -> 5551234
    - 5551-234 -> 5551234

    Args:
        phone: Phone number string in various formats

    Returns:
        Normalized 7-digit phone number (no hyphen),
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

    # Return normalized 7 digits (no hyphen for database storage)
    return digits


def format_phone(phone: str) -> str:
    """
    Format Icelandic phone number for UI display (XXX-XXXX).

    This is the inverse of normalize_phone() - use for display only.

    Args:
        phone: 7-digit phone number (e.g., "6903635")

    Returns:
        Formatted phone number with hyphen (e.g., "690-3635"),
        or original string if format is invalid

    Example:
        # Database storage (normalized):
        normalized = normalize_phone("690-3635")  # "6903635"

        # UI display (formatted):
        displayed = format_phone(normalized)  # "690-3635"
    """
    if not phone:
        return phone

    # Remove any existing hyphens/whitespace
    digits = ''.join(c for c in phone if c.isdigit())

    # Validate: should be exactly 7 digits
    if len(digits) != 7:
        return phone  # Return original if invalid

    # Format as XXX-XXXX
    return f"{digits[:3]}-{digits[3:]}"
