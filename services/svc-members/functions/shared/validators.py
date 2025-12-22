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
    Validate Icelandic kennitala with Mod 11 checksum verification.

    Format: DDMMYY-RRCV or DDMMYYRRCV
    - DD: Day (01-31 for persons, 41-71 for companies)
    - MM: Month (01-12)
    - YY: Year (00-99)
    - RR: Random number (20-99 typically for persons)
    - C: Check digit (calculated using Mod 11)
    - V: Century (0 for 2000s, 9 for 1900s, 8 for 1800s)

    Args:
        kennitala: Kennitala string to validate

    Returns:
        True if valid format and checksum, False otherwise
    """
    if not kennitala:
        return False

    # Remove hyphen if present
    kt = kennitala.replace('-', '').strip()

    # Check format: exactly 10 digits
    if len(kt) != 10 or not kt.isdigit():
        return False

    # Extract components
    day = int(kt[0:2])
    month = int(kt[2:4])
    century_digit = int(kt[9])

    # Validate month (1-12)
    if month < 1 or month > 12:
        return False

    # Validate day (1-31 for persons, 41-71 for companies)
    is_company = day > 31
    actual_day = day - 40 if is_company else day
    if actual_day < 1 or actual_day > 31:
        return False

    # Validate century digit (0 for 2000s, 8 for 1800s, 9 for 1900s)
    if century_digit not in [0, 8, 9]:
        return False

    # Mod 11 checksum validation
    # Weights for positions 1-8
    weights = [3, 2, 7, 6, 5, 4, 3, 2]
    digits = [int(d) for d in kt[:8]]

    total = sum(d * w for d, w in zip(digits, weights))
    remainder = total % 11
    check_digit = 0 if remainder == 0 else 11 - remainder

    # Check digit 10 is invalid - no valid kennitala can have this
    if check_digit == 10:
        return False

    # Verify check digit matches position 9 (index 8)
    if check_digit != int(kt[8]):
        return False

    return True


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
