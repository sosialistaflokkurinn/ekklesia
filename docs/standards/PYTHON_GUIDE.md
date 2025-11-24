# Python Style Guide for Ekklesia

**Last Updated**: 2025-11-04
**Status**: ✅ Active - Official Python Standards
**Purpose**: Comprehensive Python coding standards for Cloud Functions and admin scripts

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Type Hints](#type-hints)
3. [Docstrings](#docstrings)
4. [Cloud Functions Patterns](#cloud-functions-patterns)
5. [Firebase & Firestore](#firebase--firestore)
6. [Error Handling](#error-handling)
7. [Logging](#logging)
8. [Security](#security)
9. [Testing](#testing)
10. [Code Quality](#code-quality)

---

## Philosophy

Python code in Ekklesia follows **modern [Python 3.11+](https://docs.python.org/3.11/)** conventions with emphasis on:

1. **Type Safety** - [Type hints](https://docs.python.org/3/library/typing.html) for all public functions
2. **Clarity** - Self-documenting code with comprehensive [docstrings](https://peps.python.org/pep-0257/)
3. **Reliability** - Defensive programming with proper error handling
4. **Performance** - [Async patterns](https://docs.python.org/3/library/asyncio.html) for Firebase operations
5. **Security** - Input validation and rate limiting
6. **Observability** - Structured [logging](https://docs.python.org/3/library/logging.html) for production debugging

### Where Python is Used

- **Cloud Functions** ([`services/members/functions/`](../../services/members/functions/)) - Production backend
  - OAuth authentication (`handlekenniauth`)
  - Membership sync (`syncmembers`)
  - Audit logging (`auditmemberchanges`)

- **Admin Scripts** ([`scripts/admin/`](../../scripts/admin/)) - Development tools
  - Documentation audit (`audit-documentation.py`)
  - i18n validation (`validate-i18n-usage.py`)
  - Link validation (`validate-links.py`)

---

## Type Hints

### Basic Types

Use type hints for **all function signatures**:

```python
# ✅ Good: Clear type hints
def normalize_kennitala(kennitala: str) -> Optional[str]:
    """Normalize kennitala format to DDMMYY-XXXX."""
    if not kennitala:
        return None

    kennitala = kennitala.strip()
    if '-' in kennitala:
        return kennitala

    if len(kennitala) == 10 and kennitala.isdigit():
        return f"{kennitala[:6]}-{kennitala[6:]}"

    return kennitala

# ❌ Bad: No type hints
def normalize_kennitala(kennitala):
    if not kennitala:
        return None
    # ...
```

### Common Type Patterns

```python
from typing import Optional, Dict, List, Any, Tuple, Union
from datetime import datetime

# Optional values (can be None)
def get_user_name(user_id: str) -> Optional[str]:
    """Returns username or None if not found."""
    pass

# Dictionary with specific key/value types
def parse_member_data(data: Dict[str, Any]) -> Dict[str, str]:
    """Parse member data from Firestore."""
    pass

# List of specific type
def get_member_ids() -> List[str]:
    """Returns list of member kennitala strings."""
    pass

# Multiple possible types (Union)
def format_phone(phone: Union[str, int]) -> str:
    """Format phone number from string or int."""
    pass

# Tuple with specific types
def parse_name(full_name: str) -> Tuple[str, str]:
    """Returns (first_name, last_name)."""
    pass

# Function that doesn't return (only side effects)
def log_event(event: str, **kwargs: Any) -> None:
    """Log structured event to Cloud Logging."""
    pass
```

**References**: [typing module](https://docs.python.org/3/library/typing.html), [PEP 484](https://peps.python.org/pep-0484/)

### Firebase-Specific Types

```python
from firebase_functions import https_fn, firestore_fn
from google.cloud import firestore

# HTTP Cloud Function
@https_fn.on_request()
def my_endpoint(req: https_fn.Request) -> https_fn.Response:
    """Handle HTTP request."""
    pass

# Firestore trigger
@firestore_fn.on_document_written(document="members/{kennitala}")
def on_member_change(
    event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]
) -> None:
    """Handle Firestore document changes."""
    pass

# Firestore client
db: firestore.Client = firestore.client()

# Document reference
ref: firestore.DocumentReference = db.collection('members').document('123456-7890')

# Transaction function
@firestore.transactional
def increment_counter(transaction: firestore.Transaction, ref: firestore.DocumentReference) -> int:
    """Increment counter atomically."""
    snapshot = ref.get(transaction=transaction)
    count = snapshot.get('count') or 0
    new_count = count + 1
    transaction.update(ref, {'count': new_count})
    return new_count
```

**References**: [Firebase Functions](https://firebase.google.com/docs/functions), [Firestore Python Client](https://cloud.google.com/python/docs/reference/firestore/latest)

---

## Docstrings

Use **Google-style docstrings** for all public functions.

### Basic Format

```python
def function_name(param1: str, param2: int) -> bool:
    """One-line summary of what the function does.

    Longer description if needed. Explain edge cases, assumptions,
    or important implementation details.

    Args:
        param1: Description of first parameter
        param2: Description of second parameter

    Returns:
        Description of return value

    Raises:
        ValueError: When input is invalid
        KeyError: When required field is missing

    Example:
        >>> function_name("test", 42)
        True
    """
    pass
```

### Real-World Example

```python
def check_rate_limit(
    ip_address: Optional[str],
    max_attempts: int = 5,
    window_minutes: int = 10
) -> bool:
    """
    Transactional IP-based rate limit: 5 attempts / 10 minutes (configurable).

    Uses a Firestore transaction to check-and-increment a counter in a time-bucketed
    document, minimizing lost updates under concurrency.

    Args:
        ip_address: Client IP address to rate limit. If None, allows request.
        max_attempts: Maximum attempts allowed in the time window. Default: 5
        window_minutes: Time window in minutes for rate limiting. Default: 10

    Returns:
        True if request is allowed; False if rate limit exceeded.

    Raises:
        FirestoreError: If database transaction fails

    Example:
        >>> check_rate_limit("192.168.1.1", max_attempts=3, window_minutes=5)
        True  # First attempt
        >>> check_rate_limit("192.168.1.1", max_attempts=3, window_minutes=5)
        True  # Second attempt
        >>> check_rate_limit("192.168.1.1", max_attempts=3, window_minutes=5)
        True  # Third attempt
        >>> check_rate_limit("192.168.1.1", max_attempts=3, window_minutes=5)
        False  # Exceeded limit
    """
    if not ip_address:
        log_json("warn", "Missing IP address for rate limiting; allowing request")
        return True

    # Implementation...
```

### Module Docstrings

```python
"""
Cloud Functions for Ekklesia Members Service

Handles manual OAuth flow with Kenni.is including PKCE token exchange.

Functions:
    handlekenniauth: OAuth callback handler
    syncmembers: Django → Firestore sync
    auditmemberchanges: Firestore trigger for audit logging

Environment Variables:
    KENNI_CLIENT_ID: OAuth client ID from Kenni.is
    KENNI_CLIENT_SECRET: OAuth client secret
    CORS_ALLOWED_ORIGINS: Comma-separated list of allowed origins

Author: Ekklesia Development Team
Epic: #43 (Member Management System)
"""

import os
import json
# ...
```

---

## Cloud Functions Patterns

### HTTP Functions (@https_fn.on_request)

**Basic Structure**:

```python
from firebase_functions import https_fn, options
from typing import Optional

# Set global options (applies to all functions)
options.set_global_options(region="europe-west2")

@https_fn.on_request()
def my_endpoint(req: https_fn.Request) -> https_fn.Response:
    """
    Handle HTTP request with CORS, auth, and error handling.

    Args:
        req: HTTP request object with method, headers, body

    Returns:
        HTTP response with status, headers, and body
    """
    # 1. Handle CORS preflight
    if req.method == 'OPTIONS':
        return https_fn.Response(
            status=204,
            headers=_cors_headers_for_origin(req.headers.get('Origin'))
        )

    # 2. Parse request
    try:
        data = req.get_json()
    except ValueError:
        return https_fn.Response(
            response=json.dumps({'error': 'Invalid JSON'}),
            status=400,
            headers=_cors_headers_for_origin(req.headers.get('Origin'))
        )

    # 3. Validate input
    if not data.get('field'):
        return https_fn.Response(
            response=json.dumps({'error': 'Missing required field'}),
            status=400,
            headers=_cors_headers_for_origin(req.headers.get('Origin'))
        )

    # 4. Process request
    try:
        result = process_data(data)
        return https_fn.Response(
            response=json.dumps(result),
            status=200,
            headers={
                **_cors_headers_for_origin(req.headers.get('Origin')),
                'Content-Type': 'application/json'
            }
        )
    except Exception as e:
        log_json('ERROR', 'Request processing failed', error=str(e))
        return https_fn.Response(
            response=json.dumps({'error': 'Internal server error'}),
            status=500,
            headers=_cors_headers_for_origin(req.headers.get('Origin'))
        )
```

**CORS Helper**:

```python
def _cors_headers_for_origin(origin: str) -> dict:
    """Generate CORS headers for allowed origin."""
    return {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
    }
```

### Firestore Triggers (@firestore_fn.on_document_written)

**Basic Structure**:

```python
from firebase_functions import firestore_fn, options
from firebase_admin import firestore

@firestore_fn.on_document_written(
    document="members/{kennitala}",
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
    timeout_sec=60
)
def auditmemberchanges(
    event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]
) -> None:
    """
    Firestore trigger that creates an audit log entry for any member change.

    Triggered on: create, update, delete operations on members/{kennitala}
    Creates: Document in members_audit_log collection

    Args:
        event: Firestore event with before/after snapshots
    """
    # 1. Extract path parameters
    kennitala = event.params["kennitala"]
    change = event.data

    # 2. Get before/after snapshots
    before_exists = change.before.exists if change.before else False
    after_exists = change.after.exists if change.after else False
    before_data = change.before.to_dict() if before_exists else None
    after_data = change.after.to_dict() if after_exists else None

    # 3. Determine action type
    if not before_exists and after_exists:
        action = 'create'
    elif before_exists and not after_exists:
        action = 'delete'
    else:
        action = 'update'

    # 4. Create audit log (don't block on errors)
    try:
        db = firestore.client()
        db.collection('audit_log').add({
            'action': action,
            'kennitala': kennitala,
            'before': before_data,
            'after': after_data,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        # Log error but don't raise - we don't want to block the original operation
        log_json('ERROR', 'Audit log failed', error=str(e))
```

**Important**: Firestore triggers should **never raise exceptions** that would block the original write operation.

---

## Firebase & Firestore

### Initialization

```python
import firebase_admin
from firebase_admin import initialize_app, auth, firestore

# Initialize once (idempotent check)
if not firebase_admin._apps:
    initialize_app()

# Get Firestore client
db = firestore.client()
```

### Document Operations

**Read**:

```python
# Get single document
ref = db.collection('members').document('123456-7890')
doc = ref.get()

if doc.exists:
    data = doc.to_dict()
    name = data.get('name')
else:
    # Document doesn't exist
    pass

# Query collection
members_ref = db.collection('members')
query = members_ref.where('status', '==', 'active').limit(10)
docs = query.stream()

for doc in docs:
    print(f"{doc.id} => {doc.to_dict()}")
```

**Write**:

```python
# Set (overwrite)
ref = db.collection('members').document('123456-7890')
ref.set({
    'name': 'Jón Jónsson',
    'email': 'jon@example.is',
    'createdAt': firestore.SERVER_TIMESTAMP
})

# Update (merge)
ref.update({
    'email': 'newemail@example.is',
    'updatedAt': firestore.SERVER_TIMESTAMP
})

# Add (auto-generated ID)
doc_ref = db.collection('audit_log').add({
    'action': 'login',
    'timestamp': firestore.SERVER_TIMESTAMP
})
print(f"Created document: {doc_ref[1].id}")
```

### Transactions (Critical for Concurrency)

**Use transactions for:**
- Read-modify-write operations
- Rate limiting counters
- Preventing race conditions

```python
from google.cloud import firestore as gcf

db = firestore.client()
ref = db.collection('rate_limits').document('192.168.1.1')

@gcf.transactional
def increment_counter(transaction: gcf.Transaction, ref: gcf.DocumentReference) -> bool:
    """Atomically increment counter with limit check."""
    snapshot = ref.get(transaction=transaction)

    if snapshot.exists:
        count = int(snapshot.get('count') or 0)
        if count >= 5:
            return False  # Rate limit exceeded

        transaction.update(ref, {
            'count': count + 1,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
    else:
        transaction.set(ref, {
            'count': 1,
            'createdAt': firestore.SERVER_TIMESTAMP
        })

    return True

# Execute transaction
allowed = increment_counter(db.transaction(), ref)
```

**Key Rules**:
1. **Decorate with `@gcf.transactional`** (use `google.cloud.firestore`, not `firebase_admin.firestore`)
2. **Pass transaction explicitly** to all reads/writes
3. **Don't modify external state** inside transaction (may retry)
4. **Keep transactions fast** (<10 seconds timeout)

### Batch Operations

For **multiple writes without read-modify-write**:

```python
batch = db.batch()

# Add multiple operations
ref1 = db.collection('members').document('111111-1111')
batch.set(ref1, {'name': 'User 1'})

ref2 = db.collection('members').document('222222-2222')
batch.update(ref2, {'status': 'active'})

ref3 = db.collection('members').document('333333-3333')
batch.delete(ref3)

# Commit all at once (atomic)
batch.commit()
```

**Batch vs Transaction**:
- **Batch**: Multiple writes, no reads, atomic
- **Transaction**: Read-modify-write, conditional, atomic

### Server Timestamps

**Always use `SERVER_TIMESTAMP` for consistency**:

```python
from firebase_admin import firestore

# ✅ Good: Server timestamp (accurate, timezone-safe)
db.collection('members').document('123').set({
    'createdAt': firestore.SERVER_TIMESTAMP,
    'updatedAt': firestore.SERVER_TIMESTAMP
})

# ❌ Bad: Client timestamp (clock skew, timezone issues)
from datetime import datetime
db.collection('members').document('123').set({
    'createdAt': datetime.now()  # Don't do this!
})
```

---

## Error Handling

### Defensive Programming

**Always validate inputs**:

```python
def normalize_phone(phone: str) -> Optional[str]:
    """Normalize Icelandic phone number to XXX-XXXX format.

    Returns None if input is invalid.
    """
    # Guard against None/empty
    if not phone:
        return None

    # Sanitize input
    phone = phone.strip()
    digits = ''.join(c for c in phone if c.isdigit())

    # Remove country code
    if digits.startswith('354') and len(digits) == 10:
        digits = digits[3:]

    # Validate length
    if len(digits) != 7:
        log_json("warn", "Invalid phone format",
                 original=phone, digits=digits, length=len(digits))
        return None  # Graceful degradation

    # Format
    return f"{digits[:3]}-{digits[3:]}"
```

### Exception Handling

```python
# ✅ Good: Specific exceptions, proper cleanup
def fetch_member_from_django(kennitala: str) -> Optional[Dict]:
    """Fetch member data from Django API."""
    try:
        response = requests.get(
            f"{DJANGO_API_URL}/members/{kennitala}",
            headers={'Authorization': f'Token {DJANGO_TOKEN}'},
            timeout=10  # Always set timeout!
        )
        response.raise_for_status()  # Raises HTTPError for 4xx/5xx
        return response.json()

    except requests.Timeout:
        log_json('ERROR', 'Django API timeout', kennitala=kennitala)
        return None

    except requests.HTTPError as e:
        if e.response.status_code == 404:
            log_json('INFO', 'Member not found in Django', kennitala=kennitala)
        else:
            log_json('ERROR', 'Django API error',
                     kennitala=kennitala,
                     status=e.response.status_code,
                     error=str(e))
        return None

    except Exception as e:
        log_json('ERROR', 'Unexpected error fetching member',
                 kennitala=kennitala, error=str(e))
        return None

# ❌ Bad: Bare except, no logging
def fetch_member_from_django(kennitala):
    try:
        response = requests.get(f"{DJANGO_API_URL}/members/{kennitala}")
        return response.json()
    except:  # Too broad!
        return None  # What went wrong?
```

### Cloud Functions Error Handling

**HTTP Functions**:

```python
@https_fn.on_request()
def my_endpoint(req: https_fn.Request) -> https_fn.Response:
    """Handle request with proper error responses."""
    try:
        # Validate input
        data = req.get_json()
        if not data.get('kennitala'):
            return https_fn.Response(
                response=json.dumps({'error': 'Missing kennitala'}),
                status=400,
                headers=_cors_headers()
            )

        # Process
        result = process_data(data)

        return https_fn.Response(
            response=json.dumps(result),
            status=200,
            headers=_cors_headers()
        )

    except ValueError as e:
        # Client error (400)
        return https_fn.Response(
            response=json.dumps({'error': str(e)}),
            status=400,
            headers=_cors_headers()
        )

    except Exception as e:
        # Server error (500)
        log_json('ERROR', 'Unexpected error', error=str(e), traceback=traceback.format_exc())
        return https_fn.Response(
            response=json.dumps({'error': 'Internal server error'}),
            status=500,
            headers=_cors_headers()
        )
```

**Firestore Triggers**:

```python
@firestore_fn.on_document_written(document="members/{id}")
def on_member_change(event) -> None:
    """Handle member changes (never raise exceptions!)."""
    try:
        # Process change
        kennitala = event.params["id"]
        create_audit_log(kennitala, event.data)

    except Exception as e:
        # Log error but DON'T raise - we don't want to block the write
        log_json('ERROR', 'Audit log failed',
                 kennitala=kennitala,
                 error=str(e),
                 traceback=traceback.format_exc())
        # Swallow exception
        pass
```

---

## Logging

### Structured Logging

Use **structured JSON logging** for Cloud Logging:

```python
from utils_logging import log_json

# Basic log
log_json('INFO', 'User logged in', user_id='123456-7890')

# With context
log_json('ERROR', 'Failed to update member',
         event='member_update_failed',
         kennitala='123456-7890',
         field='email',
         error='Invalid email format',
         attempt=2)

# With sanitization (removes PII)
from utils_logging import sanitize_fields
log_json('INFO', 'Member data processed',
         **sanitize_fields({
             'kennitala': '123456-7890',
             'email': 'test@example.is',
             'password': 'secret123'
         }))
# Output: kennitala=REDACTED, email=REDACTED, password=REDACTED
```

### Log Levels

```python
log_json('DEBUG', 'Detailed debug info', ...)     # Development only
log_json('INFO', 'Normal operation', ...)          # Production events
log_json('WARNING', 'Unexpected but handled', ...) # Recoverable issues
log_json('ERROR', 'Operation failed', ...)         # Errors that need attention
log_json('CRITICAL', 'System failure', ...)        # Urgent issues
```

### What to Log

**✅ DO log**:
- Authentication events (login, logout, failed attempts)
- Data mutations (create, update, delete)
- External API calls (status, duration)
- Errors with context (stacktrace, input values)
- Rate limit violations
- Security events (invalid tokens, unauthorized access)

**❌ DON'T log**:
- Passwords or secrets
- Full kennitala (mask: `123456-****`)
- Full email addresses in production
- Credit card numbers or financial data
- Large payloads (>1KB)

```python
# ✅ Good: Masked PII
log_json('INFO', 'Member updated',
         member_id=kennitala[:6] + '-****',
         fields=['name', 'phone'],
         admin_id=admin_id)

# ❌ Bad: Full PII
log_json('INFO', 'Member updated',
         kennitala='123456-7890',  # Don't log full kennitala!
         email='jon@example.is',   # Don't log email!
         phone='555-1234')         # Don't log phone!
```

---

## Security

### Input Validation

**Always validate user input**:

```python
def validate_auth_input(kenni_auth_code: str, pkce_code_verifier: str) -> bool:
    """
    Validate authentication input parameters.

    Prevents DoS attacks via oversized payloads.

    Raises:
        ValueError: If input validation fails
    """
    # Check presence
    if not kenni_auth_code:
        raise ValueError("Auth code required")
    if not pkce_code_verifier:
        raise ValueError("PKCE verifier required")

    # Validate lengths (OAuth 2.0 reasonable limits)
    if len(kenni_auth_code) > 500:
        raise ValueError("Auth code too long (max 500 characters)")
    if len(pkce_code_verifier) > 200:
        raise ValueError("PKCE verifier too long (max 200 characters)")

    # Validate format (alphanumeric + allowed chars)
    import re
    if not re.match(r'^[A-Za-z0-9\-_\.~]+$', pkce_code_verifier):
        raise ValueError("Invalid PKCE verifier format")

    return True
```

### Rate Limiting

**Transactional rate limiting with Firestore**:

```python
from datetime import datetime, timedelta, timezone
from google.cloud import firestore as gcf

def check_rate_limit(
    ip_address: Optional[str],
    max_attempts: int = 5,
    window_minutes: int = 10
) -> bool:
    """
    IP-based rate limit using Firestore transactions.

    Returns True if allowed; False if rate limit exceeded.
    """
    if not ip_address:
        return True  # Can't rate limit without IP

    db = firestore.client()
    now = datetime.now(timezone.utc)

    # Create time-bucketed document ID
    bucket = int(now.timestamp()) // (window_minutes * 60)
    doc_id = f"{ip_address}:{bucket}:{window_minutes}m"
    ref = db.collection('rate_limits').document(doc_id)

    @gcf.transactional
    def _attempt(transaction) -> bool:
        snapshot = ref.get(transaction=transaction)

        if snapshot.exists:
            count = int(snapshot.get('count') or 0)
            if count >= max_attempts:
                return False  # Rate limit exceeded

            transaction.update(ref, {
                'count': count + 1,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
        else:
            transaction.set(ref, {
                'count': 1,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'expiresAt': now + timedelta(minutes=window_minutes)
            })

        return True

    allowed = _attempt(db.transaction())

    if not allowed:
        log_json("warn", "Rate limit exceeded",
                 ip=ip_address,
                 window_minutes=window_minutes,
                 max_attempts=max_attempts)

    return allowed
```

### Environment Variables

**Never hardcode secrets**:

```python
import os

# ✅ Good: Environment variables
KENNI_CLIENT_ID = os.getenv('KENNI_CLIENT_ID')
KENNI_CLIENT_SECRET = os.getenv('KENNI_CLIENT_SECRET')
DJANGO_API_TOKEN = os.getenv('DJANGO_API_TOKEN')

if not KENNI_CLIENT_ID:
    raise ValueError("KENNI_CLIENT_ID environment variable not set")

# ❌ Bad: Hardcoded secrets
KENNI_CLIENT_ID = "abc123"  # Never do this!
KENNI_CLIENT_SECRET = "secret_key_here"  # Never!
```

### CORS Configuration

**Validate origins against allowlist**:

```python
DEFAULT_ALLOWED_ORIGINS = [
    'https://ekklesia-prod-10-2025.web.app',
    'https://ekklesia-prod-10-2025.firebaseapp.com',
    'http://localhost:3000'
]

def _get_allowed_origin(req_origin: Optional[str]) -> str:
    """Get allowed origin for CORS headers."""
    allowed = _parse_allowed_origins()  # From env var

    # Validate origin
    if req_origin and req_origin in allowed:
        return req_origin

    # Default to first allowed origin
    return allowed[0]

def _cors_headers_for_origin(origin: str) -> dict:
    """Generate CORS headers."""
    return {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
    }
```

---

## Testing

### Unit Tests

Use **pytest** for unit tests:

```python
# test_kennitala.py
import pytest
from main import normalize_kennitala, validate_kennitala

def test_normalize_kennitala_with_hyphen():
    """Should return unchanged if already normalized."""
    assert normalize_kennitala('123456-7890') == '123456-7890'

def test_normalize_kennitala_without_hyphen():
    """Should add hyphen if missing."""
    assert normalize_kennitala('0103009999') == '010300-9999'  # Jan 3, 2000

def test_normalize_kennitala_empty():
    """Should return None for empty input."""
    assert normalize_kennitala('') is None
    assert normalize_kennitala(None) is None

def test_validate_kennitala_valid():
    """Should validate correct format."""
    assert validate_kennitala('010300-9999') is True  # Jan 3, 2000
    assert validate_kennitala('0103009999') is True

def test_validate_kennitala_invalid():
    """Should reject invalid format."""
    assert validate_kennitala('123') is False
    assert validate_kennitala('abc456-7890') is False
    assert validate_kennitala('') is False

@pytest.mark.parametrize("input,expected", [
    ('010300-9999', '010300-9999'),  # Jan 3, 2000
    ('0103009999', '010300-9999'),
    ('', None),
    (None, None),
])
def test_normalize_kennitala_parametrized(input, expected):
    """Test multiple inputs."""
    assert normalize_kennitala(input) == expected
```

### Mocking Firestore

```python
from unittest.mock import Mock, patch
import pytest

@patch('main.firestore.client')
def test_get_member_exists(mock_firestore):
    """Test fetching existing member."""
    # Setup mock
    mock_db = Mock()
    mock_firestore.return_value = mock_db

    mock_doc = Mock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {'name': 'Jón', 'email': 'jon@test.is'}

    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    # Test
    from main import get_member
    member = get_member('123456-7890')

    # Assert
    assert member is not None
    assert member['name'] == 'Jón'
    mock_db.collection.assert_called_with('members')

@patch('main.firestore.client')
def test_get_member_not_found(mock_firestore):
    """Test fetching non-existent member."""
    mock_db = Mock()
    mock_firestore.return_value = mock_db

    mock_doc = Mock()
    mock_doc.exists = False

    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    # Test
    from main import get_member
    member = get_member('999999-9999')

    # Assert
    assert member is None
```

### Integration Tests

For Cloud Functions, use **Firebase Local Emulator Suite**:

```bash
# Start emulators
firebase emulators:start

# Run tests against emulators
FIRESTORE_EMULATOR_HOST=localhost:8080 pytest tests/
```

```python
# test_integration.py
import os
import pytest
from firebase_admin import initialize_app, firestore

@pytest.fixture(scope="module")
def firebase_app():
    """Initialize Firebase app for testing."""
    os.environ['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080'
    app = initialize_app()
    yield app
    # Cleanup after tests

def test_create_member_integration(firebase_app):
    """Test creating member in Firestore."""
    db = firestore.client()

    # Create test member
    ref = db.collection('members').document('test-123456-7890')
    ref.set({
        'name': 'Test User',
        'email': 'test@example.is',
        'createdAt': firestore.SERVER_TIMESTAMP
    })

    # Verify
    doc = ref.get()
    assert doc.exists
    assert doc.get('name') == 'Test User'

    # Cleanup
    ref.delete()
```

---

## Code Quality

### Formatting with Black

Use **Black** for automatic formatting:

```bash
# Install
pip install black

# Format all Python files
black services/members/functions/
black scripts/admin/

# Check without modifying
black --check services/members/functions/
```

### Linting with Ruff

Use **Ruff** for fast linting:

```bash
# Install
pip install ruff

# Lint
ruff check services/members/functions/

# Fix automatically
ruff check --fix services/members/functions/
```

### Type Checking with mypy

Use **mypy** for static type checking:

```bash
# Install
pip install mypy

# Type check
mypy services/members/functions/
```

### Pre-commit Configuration

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 24.4.2
    hooks:
      - id: black
        language_version: python3.11

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.5.0
    hooks:
      - id: ruff
        args: [--fix]

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies: [types-requests]
```

---

## Summary

### Quick Checklist

Before committing Python code:

- [ ] **Type hints** on all function signatures
- [ ] **Docstrings** (Google style) for all public functions
- [ ] **Input validation** for user-provided data
- [ ] **Error handling** with specific exceptions
- [ ] **Structured logging** with `log_json()`
- [ ] **No hardcoded secrets** (use environment variables)
- [ ] **CORS headers** for HTTP functions
- [ ] **Transactions** for read-modify-write operations
- [ ] **Rate limiting** for public endpoints
- [ ] **Unit tests** for business logic
- [ ] **Formatted** with Black
- [ ] **Linted** with Ruff
- [ ] **Type-checked** with mypy

### References

- [Google Cloud Functions Python](https://firebase.google.com/docs/functions/get-started?gen=2nd#python)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firestore Python](https://firebase.google.com/docs/firestore/quickstart#python)
- [PEP 8 Style Guide](https://peps.python.org/pep-0008/)
- [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
- [Black Code Formatter](https://black.readthedocs.io/)
- [Ruff Linter](https://docs.astral.sh/ruff/)

---

**Last Updated**: 2025-11-04
**Maintainer**: Ekklesia Development Team
**Epic**: #103 (Documentation Organization & Code Quality)
