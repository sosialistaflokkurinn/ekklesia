"""
SMS Cloud Functions for Ekklesia Admin

Functions for SMS management:
- Template management (CRUD)
- Send single transactional SMS
- Send bulk campaign SMS
- SMS statistics

SMS provider: Twilio

All functions require admin or superuser role.
"""

from typing import Dict, Any, List
from firebase_admin import firestore
from firebase_functions import https_fn
from util_logging import log_json
from shared.rate_limit import check_uid_rate_limit
from datetime import datetime
import os
import re

# Cloud SQL member queries
from db_members import get_member_by_kennitala, get_members_for_email

# Security: Maximum limits
MAX_TEMPLATE_SIZE = 1600  # 10 SMS segments max (160 chars each)
MAX_VARIABLE_COUNT = 20  # Max variables in template
MAX_RECIPIENTS_PER_BATCH = 1000  # Max recipients per campaign batch
MAX_SMS_PER_CAMPAIGN = 5000  # Cost control: max SMS per campaign

# Lazy-load Twilio client to avoid import issues when credentials not available
_twilio_client = None

# Twilio Messaging Service SID (used for Alpha Sender ID "Sosialistar")
TWILIO_MESSAGING_SERVICE_SID = os.environ.get('twilio-messaging-service-sid', '')


def get_twilio_client():
    """Get Twilio client (lazy initialization)."""
    global _twilio_client
    if _twilio_client is None:
        try:
            from twilio.rest import Client
            account_sid = os.environ.get('twilio-account-sid')
            auth_token = os.environ.get('twilio-auth-token')

            if account_sid and auth_token:
                _twilio_client = Client(account_sid, auth_token)
                log_json("info", "Twilio client initialized")
            else:
                log_json("warning", "Twilio credentials not configured")
        except ImportError:
            log_json("warning", "twilio package not installed")
    return _twilio_client


def format_phone_number(phone: str, country: str = "IS") -> str:
    """
    Format phone number for international sending.

    Args:
        phone: Phone number (digits only, e.g., "7758493")
        country: ISO country code (default "IS" for Iceland)

    Returns:
        E.164 formatted number (e.g., "+3547758493")
    """
    # Remove any non-digit characters
    digits = re.sub(r'\D', '', phone)

    # Country code mapping
    country_codes = {
        "IS": "+354",
        "DK": "+45",
        "NO": "+47",
        "SE": "+46",
        "FI": "+358",
        "US": "+1",
        "GB": "+44",
    }

    country_code = country_codes.get(country.upper(), "+354")

    # If already has country code, return as-is
    if digits.startswith("354") and len(digits) > 7:
        return f"+{digits}"

    return f"{country_code}{digits}"


def send_sms_via_twilio(to_phone: str, message: str, tags: list = None) -> dict:
    """
    Send SMS via Twilio using Messaging Service (Alpha Sender ID "Sosialistar").

    Args:
        to_phone: Recipient phone number (E.164 format)
        message: SMS message body
        tags: Optional list of category tags (for tracking)

    Returns:
        Dict with success status and message_sid
    """
    client = get_twilio_client()
    if not client:
        raise Exception("Twilio client not available")

    if not TWILIO_MESSAGING_SERVICE_SID:
        raise Exception("twilio-messaging-service-sid not configured")

    # Build status callback URL for delivery reports (optional)
    # status_callback = os.environ.get('SMS_STATUS_CALLBACK_URL')

    message_result = client.messages.create(
        body=message,
        messaging_service_sid=TWILIO_MESSAGING_SERVICE_SID,
        to=to_phone,
        # status_callback=status_callback if status_callback else None
    )

    if message_result.sid:
        return {
            "success": True,
            "message_sid": message_result.sid,
            "provider": "twilio",
            "status": message_result.status,
            "segments": len(message) // 160 + 1  # Approximate segment count
        }
    else:
        raise Exception("Twilio error: No message SID returned")


def get_filtered_members_with_phone(recipient_filter: Dict[str, Any], max_results: int = MAX_RECIPIENTS_PER_BATCH) -> List[Dict]:
    """
    Get members with phone numbers filtered by recipient_filter criteria.

    Args:
        recipient_filter: Dict with optional keys:
            - status: "active" to filter active members only
            - districts: List of district/cell names
            - municipalities: List of city/municipality names
        max_results: Maximum number of members to return (security limit)

    Returns:
        List of member dicts that have valid phone numbers.
    """
    status = recipient_filter.get("status")
    municipalities = recipient_filter.get("municipalities", [])
    cells = recipient_filter.get("districts", [])

    members = get_members_for_email(
        status=status,
        municipalities=municipalities if municipalities else None,
        cells=cells if cells else None,
        max_results=max_results
    )

    # Filter to only members with phone numbers
    return [m for m in members if m.get("profile", {}).get("phone")]


def require_admin(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Verify that the caller has admin or superuser role.

    Args:
        req: The callable request object with auth context.

    Returns:
        The decoded token with custom claims.

    Raises:
        https_fn.HttpsError: If not authenticated or not admin/superuser.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )

    claims = req.auth.token or {}
    roles = claims.get("roles", [])
    single_role = claims.get("role")

    is_admin = (
        "admin" in roles or
        "superuser" in roles or
        single_role in ["admin", "superuser"]
    )

    if not is_admin:
        log_json("warning", "Unauthorized admin access attempt",
                 uid=req.auth.uid,
                 roles=roles,
                 attempted_action="sms_function")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Admin or superuser role required"
        )

    return claims


def validate_phone(phone: str) -> bool:
    """
    Validate phone number format.
    Security: Prevents sending to malformed or potentially dangerous numbers.
    """
    if not phone or len(phone) < 7 or len(phone) > 20:
        return False
    # Allow digits, spaces, dashes, plus sign
    pattern = r'^[\d\s\-\+]+$'
    return bool(re.match(pattern, phone))


# ==============================================================================
# TEMPLATE MANAGEMENT
# ==============================================================================

def list_sms_templates_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    List all SMS templates.

    Optional filters:
        - type: 'transactional' | 'broadcast'
        - language: 'is' | 'en'

    Returns:
        List of templates with id, name, type, language.
    """
    require_admin(req)

    data = req.data or {}
    template_type = data.get("type")
    language = data.get("language")

    db = firestore.client()
    query = db.collection("sms_templates")

    if template_type:
        query = query.where("type", "==", template_type)
    if language:
        query = query.where("language", "==", language)

    query = query.order_by("name")

    templates = []
    for doc in query.stream():
        template = doc.to_dict()
        templates.append({
            "id": doc.id,
            "name": template.get("name"),
            "type": template.get("type"),
            "language": template.get("language"),
            "body": template.get("body"),
            "variables": template.get("variables", []),
            "char_count": len(template.get("body", "")),
            "updated_at": template.get("updated_at").isoformat() if template.get("updated_at") else None
        })

    log_json("info", "Listed SMS templates",
             count=len(templates),
             admin_uid=req.auth.uid)

    return {"templates": templates, "count": len(templates)}


def get_sms_template_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get a single SMS template by ID.

    Required data:
        - template_id: Template document ID

    Returns:
        Full template data.
    """
    require_admin(req)

    data = req.data or {}
    template_id = data.get("template_id")

    if not template_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="template_id is required"
        )

    db = firestore.client()
    doc = db.collection("sms_templates").document(template_id).get()

    if not doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"Template '{template_id}' not found"
        )

    template = doc.to_dict()

    return {
        "id": doc.id,
        "name": template.get("name"),
        "body": template.get("body"),
        "type": template.get("type"),
        "language": template.get("language"),
        "variables": template.get("variables", []),
        "char_count": len(template.get("body", "")),
        "created_at": template.get("created_at").isoformat() if template.get("created_at") else None,
        "updated_at": template.get("updated_at").isoformat() if template.get("updated_at") else None,
        "created_by": template.get("created_by")
    }


def save_sms_template_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Create or update an SMS template.

    Required data:
        - name: Template name
        - body: SMS message body (max 1600 chars)
        - type: 'transactional' | 'broadcast'

    Optional data:
        - template_id: If updating existing template
        - language: 'is' (default) | 'en'
        - variables: List of variable names used in template

    Returns:
        Saved template with ID.
    """
    require_admin(req)

    # Security: Rate limit template saves (20 per 10 minutes)
    if not check_uid_rate_limit(req.auth.uid, "save_sms_template", max_attempts=20, window_minutes=10):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 20 template saves per 10 minutes."
        )

    data = req.data or {}
    template_id = data.get("template_id")
    name = data.get("name")
    body = data.get("body")
    template_type = data.get("type")
    language = data.get("language", "is")
    variables = data.get("variables", [])

    # Validate required fields
    if not name:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="name is required"
        )
    if not body:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="body is required"
        )
    if template_type not in ["transactional", "broadcast"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="type must be 'transactional' or 'broadcast'"
        )

    # Security: Validate template size
    if len(body) > MAX_TEMPLATE_SIZE:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"Template too long. Maximum {MAX_TEMPLATE_SIZE} characters (about 10 SMS segments)"
        )

    # Auto-detect variables ({{ variable_name }})
    if not variables:
        found_vars = re.findall(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}', body)
        variables = list(set(found_vars))

    db = firestore.client()
    now = datetime.utcnow()

    template_data = {
        "name": name,
        "body": body,
        "type": template_type,
        "language": language,
        "variables": variables,
        "updated_at": now
    }

    if template_id:
        # Update existing
        doc_ref = db.collection("sms_templates").document(template_id)
        if not doc_ref.get().exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Template '{template_id}' not found"
            )
        doc_ref.update(template_data)
        log_json("info", "Updated SMS template",
                 template_id=template_id,
                 name=name,
                 admin_uid=req.auth.uid)
    else:
        # Create new
        template_data["created_at"] = now
        template_data["created_by"] = req.auth.uid
        doc_ref = db.collection("sms_templates").add(template_data)
        template_id = doc_ref[1].id
        log_json("info", "Created SMS template",
                 template_id=template_id,
                 name=name,
                 admin_uid=req.auth.uid)

    return {
        "success": True,
        "template_id": template_id,
        "char_count": len(body),
        "segment_count": len(body) // 160 + 1,
        "variables": variables
    }


def delete_sms_template_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Delete an SMS template.

    Required data:
        - template_id: Template document ID

    Returns:
        Success status.
    """
    require_admin(req)

    # Security: Rate limit template deletes (10 per 10 minutes)
    if not check_uid_rate_limit(req.auth.uid, "delete_sms_template", max_attempts=10, window_minutes=10):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 10 template deletes per 10 minutes."
        )

    data = req.data or {}
    template_id = data.get("template_id")

    if not template_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="template_id is required"
        )

    db = firestore.client()
    doc_ref = db.collection("sms_templates").document(template_id)

    doc = doc_ref.get()
    if not doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"Template '{template_id}' not found"
        )

    # Check if template is used in any campaigns
    campaigns = db.collection("sms_campaigns").where("template_id", "==", template_id).limit(1).stream()
    if list(campaigns):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Cannot delete template - it is used by one or more campaigns"
        )

    doc_ref.delete()

    log_json("info", "Deleted SMS template",
             template_id=template_id,
             admin_uid=req.auth.uid)

    return {"success": True, "deleted_id": template_id}


# ==============================================================================
# SEND SMS
# ==============================================================================

def render_template(body: str, variables: Dict[str, Any]) -> str:
    """
    Render template with variables using simple {{ var }} syntax.
    Supports nested variables like {{ member.name }}.

    Security: Only allows alphanumeric variable names with dots for nesting.
    Prevents SSTI by not evaluating Python expressions.
    """
    # Security: Whitelist of allowed top-level variable names
    ALLOWED_VARS = {'member', 'cell', 'organization', 'date'}

    def replace_var(match):
        var_path = match.group(1).strip()

        # Security: Validate variable name format
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$', var_path):
            return ''  # Invalid format, return empty

        parts = var_path.split('.')

        # Security: Check if top-level variable is allowed
        if parts[0] not in ALLOWED_VARS:
            return ''  # Unknown variable, return empty

        value = variables
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part, '')
            else:
                return ''  # Not a dict, return empty
        return str(value) if value else ''

    return re.sub(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}', replace_var, body)


def send_sms_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send a single SMS via Twilio.

    Required data (one of):
        - template_id: Template ID (template mode)
        - body: Direct message content (quick send mode)

    Required data:
        - recipient_phone: Phone number OR
        - recipient_kennitala: Member kennitala (will look up phone)

    Optional data:
        - variables: Dict of template variables
        - sms_type: 'transactional' (default) or 'broadcast'

    Returns:
        Send status with message SID.
    """
    require_admin(req)

    # Security: Rate limit SMS sending (10 per minute per admin)
    if not check_uid_rate_limit(req.auth.uid, "send_sms", max_attempts=10, window_minutes=1):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 10 SMS per minute."
        )

    data = req.data or {}
    template_id = data.get("template_id")
    recipient_phone = data.get("recipient_phone")
    recipient_kennitala = data.get("recipient_kennitala")
    variables = data.get("variables", {})
    sms_type = data.get("sms_type", "transactional")

    # Quick send mode: direct body
    direct_body = data.get("body")

    # Validate: either template_id OR body required
    if not template_id and not direct_body:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Either template_id or body is required"
        )

    if not recipient_phone and not recipient_kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="recipient_phone or recipient_kennitala is required"
        )

    # Security: Validate direct content size
    if direct_body and len(direct_body) > MAX_TEMPLATE_SIZE:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"SMS body too long. Maximum {MAX_TEMPLATE_SIZE} characters."
        )

    db = firestore.client()

    # Get content from template or use direct content
    if template_id:
        template_doc = db.collection("sms_templates").document(template_id).get()
        if not template_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Template '{template_id}' not found"
            )
        template = template_doc.to_dict()
        message_body = template.get("body", "")
    else:
        message_body = direct_body

    # Get recipient phone from member if kennitala provided
    member_data = {}
    if recipient_kennitala and not recipient_phone:
        member_data = get_member_by_kennitala(recipient_kennitala)
        if not member_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Member with kennitala not found"
            )
        recipient_phone = member_data.get("profile", {}).get("phone")
        if not recipient_phone:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Member does not have a phone number"
            )

    # Check SMS marketing consent for broadcast SMS
    if member_data and sms_type == "broadcast":
        preferences = member_data.get("preferences", {})
        sms_marketing = preferences.get("sms_marketing", True)  # Default to True
        if not sms_marketing:
            log_json("info", "Skipping SMS - member has opted out",
                     kennitala=recipient_kennitala,
                     sms_type=sms_type)
            return {
                "success": False,
                "skipped": True,
                "reason": "Félaginn hefur afþakkað SMS",
                "recipient": recipient_phone[:3] + "***"
            }

    # Security: Validate phone format
    if not validate_phone(recipient_phone):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid phone number format"
        )

    # Format phone number for E.164
    formatted_phone = format_phone_number(recipient_phone)

    # Build variables with member data
    if member_data:
        variables["member"] = {
            "name": member_data.get("profile", {}).get("name", ""),
            "first_name": member_data.get("profile", {}).get("name", "").split()[0] if member_data.get("profile", {}).get("name") else "",
            "kennitala": recipient_kennitala
        }
        if member_data.get("membership", {}).get("cell"):
            variables["cell"] = {
                "name": member_data.get("membership", {}).get("cell", "")
            }

    # Render template
    rendered_body = render_template(message_body, variables)

    try:
        result = send_sms_via_twilio(
            to_phone=formatted_phone,
            message=rendered_body
        )

        message_sid = result.get("message_sid")

        # Log to sms_logs collection
        log_data = {
            "template_id": template_id,
            "quick_send": template_id is None,
            "recipient_phone": formatted_phone[:7] + "***",  # Partially mask
            "recipient_kennitala": recipient_kennitala,
            "status": "sent",
            "message_sid": message_sid,
            "provider": "twilio",
            "sent_at": datetime.utcnow(),
            "segment_count": result.get("segments", 1),
            "metadata": {
                "type": sms_type,
                "char_count": len(rendered_body),
                "sent_by": req.auth.uid
            }
        }
        db.collection("sms_logs").add(log_data)

        log_json("info", "SMS sent via Twilio",
                 message_sid=message_sid,
                 template_id=template_id or "quick_send",
                 recipient=formatted_phone[:7] + "***",
                 sms_type=sms_type,
                 admin_uid=req.auth.uid)

        return {
            "success": True,
            "message_sid": message_sid,
            "recipient": formatted_phone[:7] + "***",
            "segment_count": result.get("segments", 1)
        }

    except Exception as e:
        log_json("error", "Failed to send SMS",
                 error=str(e),
                 template_id=template_id,
                 admin_uid=req.auth.uid)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to send SMS: {str(e)}"
        )


# ==============================================================================
# CAMPAIGNS
# ==============================================================================

def list_sms_campaigns_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    List SMS campaigns.

    Optional filters:
        - status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
        - limit: Max results (default 50)

    Returns:
        List of campaigns with stats.
    """
    require_admin(req)

    data = req.data or {}
    status = data.get("status")
    limit = min(data.get("limit", 50), 100)

    db = firestore.client()
    query = db.collection("sms_campaigns")

    if status:
        query = query.where("status", "==", status)

    query = query.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)

    campaigns = []
    for doc in query.stream():
        campaign = doc.to_dict()
        campaigns.append({
            "id": doc.id,
            "name": campaign.get("name"),
            "template_id": campaign.get("template_id"),
            "status": campaign.get("status"),
            "recipient_count": campaign.get("recipient_count", 0),
            "sent_count": campaign.get("sent_count", 0),
            "estimated_cost": campaign.get("estimated_cost"),
            "scheduled_at": campaign.get("scheduled_at").isoformat() if campaign.get("scheduled_at") else None,
            "completed_at": campaign.get("completed_at").isoformat() if campaign.get("completed_at") else None,
            "created_at": campaign.get("created_at").isoformat() if campaign.get("created_at") else None
        })

    return {"campaigns": campaigns, "count": len(campaigns)}


def preview_sms_recipient_count_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Preview how many recipients with phones match a filter.

    Optional data:
        - recipient_filter: { status, districts[], municipalities[] }

    Returns:
        Recipient count.
    """
    require_admin(req)

    data = req.data or {}
    recipient_filter = data.get("recipient_filter", {"status": "active"})

    # Get count of members with phone numbers
    members = get_filtered_members_with_phone(recipient_filter)

    return {
        "count": len(members),
        "filter": recipient_filter
    }


def create_sms_campaign_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Create a new SMS campaign (draft).

    Required data:
        - name: Campaign name
        - template_id: Template to use

    Optional data:
        - recipient_filter: { status, districts[], municipalities[] }
        - scheduled_at: ISO datetime for scheduled send

    Returns:
        Created campaign with ID and cost estimate.
    """
    require_admin(req)

    # Security: Rate limit campaign creation (10 per 10 minutes)
    if not check_uid_rate_limit(req.auth.uid, "create_sms_campaign", max_attempts=10, window_minutes=10):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 10 campaign creations per 10 minutes."
        )

    data = req.data or {}
    name = data.get("name")
    template_id = data.get("template_id")
    recipient_filter = data.get("recipient_filter", {"status": "active"})
    scheduled_at = data.get("scheduled_at")

    if not name:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="name is required"
        )
    if not template_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="template_id is required"
        )

    db = firestore.client()

    # Verify template exists
    template_doc = db.collection("sms_templates").document(template_id).get()
    if not template_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"Template '{template_id}' not found"
        )

    template = template_doc.to_dict()
    segment_count = len(template.get("body", "")) // 160 + 1

    # Count recipients with phone numbers
    members = get_filtered_members_with_phone(recipient_filter)
    recipient_count = len(members)

    # Cost control: Check max recipients
    if recipient_count > MAX_SMS_PER_CAMPAIGN:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=f"Too many recipients ({recipient_count}). Maximum {MAX_SMS_PER_CAMPAIGN} per campaign."
        )

    # Estimate cost (approx $0.08 per SMS segment to Iceland)
    estimated_cost = recipient_count * segment_count * 0.08

    now = datetime.utcnow()
    campaign_data = {
        "name": name,
        "template_id": template_id,
        "status": "draft",
        "recipient_filter": recipient_filter,
        "recipient_count": recipient_count,
        "segment_count": segment_count,
        "estimated_cost": round(estimated_cost, 2),
        "sent_count": 0,
        "failed_count": 0,
        "scheduled_at": datetime.fromisoformat(scheduled_at) if scheduled_at else None,
        "created_at": now,
        "created_by": req.auth.uid,
        "updated_at": now
    }

    _, doc_ref = db.collection("sms_campaigns").add(campaign_data)

    log_json("info", "Created SMS campaign",
             campaign_id=doc_ref.id,
             name=name,
             recipient_count=recipient_count,
             estimated_cost=estimated_cost,
             admin_uid=req.auth.uid)

    return {
        "success": True,
        "campaign_id": doc_ref.id,
        "name": name,
        "recipient_count": recipient_count,
        "segment_count": segment_count,
        "estimated_cost": round(estimated_cost, 2),
        "status": "draft"
    }


def send_sms_campaign_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send an SMS campaign to all recipients.

    Required data:
        - campaign_id: Campaign to send

    Returns:
        Send progress with counts.
    """
    require_admin(req)

    # Security: Rate limit campaign sends (1 per 10 minutes per admin)
    if not check_uid_rate_limit(req.auth.uid, "send_sms_campaign", max_attempts=1, window_minutes=10):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 1 SMS campaign per 10 minutes."
        )

    data = req.data or {}
    campaign_id = data.get("campaign_id")
    batch_size = min(data.get("batch_size", 50), 100)

    if not campaign_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="campaign_id is required"
        )

    db = firestore.client()

    # Get campaign
    campaign_ref = db.collection("sms_campaigns").document(campaign_id)
    campaign_doc = campaign_ref.get()

    if not campaign_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"Campaign '{campaign_id}' not found"
        )

    campaign = campaign_doc.to_dict()

    if campaign.get("status") not in ["draft", "scheduled"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=f"Campaign status is '{campaign.get('status')}', must be 'draft' or 'scheduled'"
        )

    # Update status to sending
    campaign_ref.update({
        "status": "sending",
        "started_at": datetime.utcnow()
    })

    # Get template
    template_doc = db.collection("sms_templates").document(campaign.get("template_id")).get()
    if not template_doc.exists:
        campaign_ref.update({"status": "draft"})  # Revert
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Campaign template not found"
        )

    template = template_doc.to_dict()

    # Get recipients with phones
    recipient_filter = campaign.get("recipient_filter", {})
    members = get_filtered_members_with_phone(recipient_filter)

    sent_count = 0
    failed_count = 0
    skipped_count = 0
    total_cost = 0.0

    try:
        sms_processed = 0

        for member in members:
            phone = member.get("profile", {}).get("phone")
            kennitala = member.get("kennitala")

            if not phone:
                failed_count += 1
                continue

            # Check SMS marketing consent
            preferences = member.get("preferences", {})
            if not preferences.get("sms_marketing", True):
                skipped_count += 1
                continue

            # Format phone for E.164
            formatted_phone = format_phone_number(phone)

            # Build variables
            variables = {
                "member": {
                    "name": member.get("profile", {}).get("name", ""),
                    "first_name": member.get("profile", {}).get("name", "").split()[0] if member.get("profile", {}).get("name") else "",
                    "kennitala": kennitala
                }
            }
            if member.get("membership", {}).get("cell"):
                variables["cell"] = {"name": member.get("membership", {}).get("cell", "")}

            # Render template
            rendered_body = render_template(template.get("body", ""), variables)

            # Send SMS
            try:
                result = send_sms_via_twilio(
                    to_phone=formatted_phone,
                    message=rendered_body
                )

                # Log individual SMS
                log_data = {
                    "campaign_id": campaign_id,
                    "template_id": campaign.get("template_id"),
                    "recipient_phone": formatted_phone[:7] + "***",
                    "recipient_kennitala": kennitala,
                    "status": "sent",
                    "message_sid": result.get("message_sid"),
                    "provider": "twilio",
                    "sent_at": datetime.utcnow(),
                    "segment_count": result.get("segments", 1)
                }
                db.collection("sms_logs").add(log_data)

                sent_count += 1
                total_cost += result.get("segments", 1) * 0.08

            except Exception as e:
                log_json("warning", "Failed to send campaign SMS",
                         error=str(e),
                         recipient=formatted_phone[:7] + "***")
                failed_count += 1

            sms_processed += 1

            # Update progress periodically
            if sms_processed % batch_size == 0:
                campaign_ref.update({
                    "sent_count": sent_count,
                    "failed_count": failed_count
                })

        # Update final status
        campaign_ref.update({
            "status": "sent",
            "sent_count": sent_count,
            "failed_count": failed_count,
            "actual_cost": round(total_cost, 2),
            "completed_at": datetime.utcnow()
        })

        log_json("info", "SMS campaign sent",
                 campaign_id=campaign_id,
                 sent_count=sent_count,
                 failed_count=failed_count,
                 skipped_count=skipped_count,
                 total_cost=round(total_cost, 2),
                 admin_uid=req.auth.uid)

        return {
            "success": True,
            "campaign_id": campaign_id,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "skipped_count": skipped_count,
            "total_cost": round(total_cost, 2),
            "status": "sent"
        }

    except Exception as e:
        campaign_ref.update({
            "status": "draft",
            "sent_count": sent_count,
            "failed_count": failed_count
        })
        log_json("error", "SMS campaign send failed",
                 campaign_id=campaign_id,
                 error=str(e),
                 admin_uid=req.auth.uid)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Campaign send failed: {str(e)}"
        )


# ==============================================================================
# STATISTICS
# ==============================================================================

def get_sms_stats_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get SMS sending statistics.

    Optional data:
        - campaign_id: Stats for specific campaign
        - days: Number of days to include (default 30)

    Returns:
        SMS stats summary with cost.
    """
    require_admin(req)

    data = req.data or {}
    campaign_id = data.get("campaign_id")
    days = min(data.get("days", 30), 90)

    db = firestore.client()

    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)

    if campaign_id:
        logs = db.collection("sms_logs").where("campaign_id", "==", campaign_id).stream()
    else:
        logs = db.collection("sms_logs").where("sent_at", ">=", cutoff).stream()

    stats = {
        "total": 0,
        "sent": 0,
        "delivered": 0,
        "failed": 0,
        "total_segments": 0,
        "estimated_cost": 0.0
    }

    for log_doc in logs:
        log_data = log_doc.to_dict()
        status = log_data.get("status", "sent")
        segments = log_data.get("segment_count", 1)

        stats["total"] += 1
        stats["total_segments"] += segments
        stats["estimated_cost"] += segments * 0.08

        if status in ["sent", "delivered"]:
            stats["sent"] += 1
        elif status == "delivered":
            stats["delivered"] += 1
        elif status == "failed":
            stats["failed"] += 1

    stats["estimated_cost"] = round(stats["estimated_cost"], 2)

    return {
        "stats": stats,
        "period_days": days,
        "campaign_id": campaign_id
    }


def list_sms_logs_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    List SMS send logs.

    Optional filters:
        - campaign_id: Filter by campaign
        - status: Filter by status
        - limit: Max results (default 100)

    Returns:
        List of SMS logs.
    """
    require_admin(req)

    data = req.data or {}
    campaign_id = data.get("campaign_id")
    status = data.get("status")
    limit = min(data.get("limit", 100), 500)

    db = firestore.client()
    query = db.collection("sms_logs")

    if campaign_id:
        query = query.where("campaign_id", "==", campaign_id)
    if status:
        query = query.where("status", "==", status)

    query = query.order_by("sent_at", direction=firestore.Query.DESCENDING).limit(limit)

    logs = []
    for doc in query.stream():
        log_data = doc.to_dict()
        logs.append({
            "id": doc.id,
            "template_id": log_data.get("template_id"),
            "campaign_id": log_data.get("campaign_id"),
            "recipient_phone": log_data.get("recipient_phone"),  # Already masked
            "status": log_data.get("status"),
            "segment_count": log_data.get("segment_count", 1),
            "sent_at": log_data.get("sent_at").isoformat() if log_data.get("sent_at") else None,
            "delivered_at": log_data.get("delivered_at").isoformat() if log_data.get("delivered_at") else None
        })

    return {"logs": logs, "count": len(logs)}
