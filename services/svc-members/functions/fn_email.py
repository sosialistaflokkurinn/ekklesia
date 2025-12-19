"""
Email Cloud Functions for Ekklesia Admin (#323)

Functions for email management via Amazon SES:
- Template management (CRUD)
- Send single transactional email
- Send bulk campaign emails
- Email statistics

All functions require admin or superuser role.
"""

from typing import Dict, Any, Optional, List
from firebase_admin import firestore
from firebase_functions import https_fn
from util_logging import log_json
from datetime import datetime
import os
import re
import html2text

# Lazy-load SES client to avoid import issues when credentials not available
_ses_client = None

# Default sender email (can be overridden by env var)
DEFAULT_SENDER = os.environ.get('SES_SENDER_EMAIL', 'felagakerfi@sosialistaflokkurinn.is')


def get_ses_client():
    """Get Amazon SES client (lazy initialization)."""
    global _ses_client
    if _ses_client is None:
        try:
            import boto3
            aws_access_key = os.environ.get('aws-ses-access-key')
            aws_secret_key = os.environ.get('aws-ses-secret-key')
            aws_region = os.environ.get('aws-ses-region', 'eu-west-1')

            if aws_access_key and aws_secret_key:
                _ses_client = boto3.client(
                    'ses',
                    region_name=aws_region,
                    aws_access_key_id=aws_access_key,
                    aws_secret_access_key=aws_secret_key
                )
            else:
                log_json("warning", "AWS SES credentials not configured")
        except ImportError:
            log_json("warning", "boto3 package not installed")
    return _ses_client


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
                 attempted_action="email_function")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Admin or superuser role required"
        )

    return claims


def slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[áàâä]', 'a', text)
    text = re.sub(r'[éèêë]', 'e', text)
    text = re.sub(r'[íìîï]', 'i', text)
    text = re.sub(r'[óòôö]', 'o', text)
    text = re.sub(r'[úùûü]', 'u', text)
    text = re.sub(r'[ýÿ]', 'y', text)
    text = re.sub(r'[ð]', 'd', text)
    text = re.sub(r'[þ]', 'th', text)
    text = re.sub(r'[æ]', 'ae', text)
    text = re.sub(r'[ø]', 'o', text)
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text


def html_to_text(html_content: str) -> str:
    """Convert HTML to plain text."""
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = True
    return h.handle(html_content)


# ==============================================================================
# TEMPLATE MANAGEMENT
# ==============================================================================

def list_email_templates_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    List all email templates.

    Optional filters:
        - type: 'transactional' | 'broadcast'
        - language: 'is' | 'en'

    Returns:
        List of templates with id, name, alias, type, language.
    """
    require_admin(req)

    data = req.data or {}
    template_type = data.get("type")
    language = data.get("language")

    db = firestore.client()
    query = db.collection("email_templates")

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
            "alias": template.get("alias"),
            "subject": template.get("subject"),
            "type": template.get("type"),
            "language": template.get("language"),
            "variables": template.get("variables", []),
            "updated_at": template.get("updated_at").isoformat() if template.get("updated_at") else None
        })

    log_json("info", "Listed email templates",
             count=len(templates),
             admin_uid=req.auth.uid)

    return {"templates": templates, "count": len(templates)}


def get_email_template_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get a single email template by ID or alias.

    Required data:
        - template_id: Template document ID or alias

    Returns:
        Full template data including HTML body.
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

    # Try by document ID first
    doc = db.collection("email_templates").document(template_id).get()

    if not doc.exists:
        # Try by alias
        results = db.collection("email_templates").where("alias", "==", template_id).limit(1).stream()
        docs = list(results)
        if docs:
            doc = docs[0]
        else:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Template '{template_id}' not found"
            )

    template = doc.to_dict()

    return {
        "id": doc.id,
        "name": template.get("name"),
        "alias": template.get("alias"),
        "subject": template.get("subject"),
        "body_html": template.get("body_html"),
        "body_text": template.get("body_text"),
        "type": template.get("type"),
        "language": template.get("language"),
        "variables": template.get("variables", []),
        "created_at": template.get("created_at").isoformat() if template.get("created_at") else None,
        "updated_at": template.get("updated_at").isoformat() if template.get("updated_at") else None,
        "created_by": template.get("created_by")
    }


def save_email_template_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Create or update an email template.

    Required data:
        - name: Template name
        - subject: Email subject line
        - body_html: HTML body content
        - type: 'transactional' | 'broadcast'

    Optional data:
        - template_id: If updating existing template
        - alias: URL-safe identifier (auto-generated if not provided)
        - language: 'is' (default) | 'en'
        - variables: List of variable names used in template

    Returns:
        Saved template with ID.
    """
    claims = require_admin(req)

    data = req.data or {}
    template_id = data.get("template_id")
    name = data.get("name")
    subject = data.get("subject")
    body_html = data.get("body_html")
    template_type = data.get("type")
    alias = data.get("alias")
    language = data.get("language", "is")
    variables = data.get("variables", [])

    # Validate required fields
    if not name:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="name is required"
        )
    if not subject:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="subject is required"
        )
    if not body_html:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="body_html is required"
        )
    if template_type not in ["transactional", "broadcast"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="type must be 'transactional' or 'broadcast'"
        )

    # Auto-generate alias if not provided
    if not alias:
        alias = slugify(name)

    # Generate plain text version
    body_text = html_to_text(body_html)

    # Auto-detect variables ({{ variable_name }})
    if not variables:
        found_vars = re.findall(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}', body_html)
        variables = list(set(found_vars))

    db = firestore.client()
    now = datetime.utcnow()

    template_data = {
        "name": name,
        "alias": alias,
        "subject": subject,
        "body_html": body_html,
        "body_text": body_text,
        "type": template_type,
        "language": language,
        "variables": variables,
        "updated_at": now
    }

    if template_id:
        # Update existing
        doc_ref = db.collection("email_templates").document(template_id)
        if not doc_ref.get().exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Template '{template_id}' not found"
            )
        doc_ref.update(template_data)
        log_json("info", "Updated email template",
                 template_id=template_id,
                 name=name,
                 admin_uid=req.auth.uid)
    else:
        # Create new
        template_data["created_at"] = now
        template_data["created_by"] = req.auth.uid
        doc_ref = db.collection("email_templates").add(template_data)
        template_id = doc_ref[1].id
        log_json("info", "Created email template",
                 template_id=template_id,
                 name=name,
                 admin_uid=req.auth.uid)

    return {
        "success": True,
        "template_id": template_id,
        "alias": alias,
        "variables": variables
    }


def delete_email_template_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Delete an email template.

    Required data:
        - template_id: Template document ID

    Returns:
        Success status.
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
    doc_ref = db.collection("email_templates").document(template_id)

    doc = doc_ref.get()
    if not doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"Template '{template_id}' not found"
        )

    # Check if template is used in any campaigns
    campaigns = db.collection("email_campaigns").where("template_id", "==", template_id).limit(1).stream()
    if list(campaigns):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Cannot delete template - it is used by one or more campaigns"
        )

    doc_ref.delete()

    log_json("info", "Deleted email template",
             template_id=template_id,
             admin_uid=req.auth.uid)

    return {"success": True, "deleted_id": template_id}


# ==============================================================================
# SEND EMAIL
# ==============================================================================

def render_template(body: str, variables: Dict[str, Any]) -> str:
    """
    Render template with variables using simple {{ var }} syntax.
    Supports nested variables like {{ member.name }}.
    """
    def replace_var(match):
        var_path = match.group(1).strip()
        parts = var_path.split('.')
        value = variables
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part, '')
            else:
                return match.group(0)  # Keep original if not found
        return str(value) if value else ''

    return re.sub(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}', replace_var, body)


def send_email_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send a single transactional email via Amazon SES.

    Required data:
        - template_id: Template ID or alias
        - recipient_email: Email address OR
        - recipient_kennitala: Member kennitala (will look up email)

    Optional data:
        - variables: Dict of template variables
        - email_type: 'transactional' (default) or 'broadcast'

    Returns:
        Send status with SES message ID.
    """
    require_admin(req)

    data = req.data or {}
    template_id = data.get("template_id")
    recipient_email = data.get("recipient_email")
    recipient_kennitala = data.get("recipient_kennitala")
    variables = data.get("variables", {})
    email_type = data.get("email_type", "transactional")

    # Validate required fields
    if not template_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="template_id is required"
        )

    if not recipient_email and not recipient_kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="recipient_email or recipient_kennitala is required"
        )

    db = firestore.client()

    # Get template
    template_result = get_email_template_handler(req)
    template_subject = template_result.get("subject")
    template_body_html = template_result.get("body_html")
    template_body_text = template_result.get("body_text")

    # Get recipient email from member if kennitala provided
    member_data = {}
    if recipient_kennitala and not recipient_email:
        members = db.collection("members").where("kennitala", "==", recipient_kennitala).limit(1).stream()
        member_list = list(members)
        if not member_list:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Member with kennitala not found"
            )
        member_doc = member_list[0]
        member_data = member_doc.to_dict()
        recipient_email = member_data.get("profile", {}).get("email")
        if not recipient_email:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Member does not have an email address"
            )

    # Build variables with member data
    if member_data:
        variables["member"] = {
            "name": member_data.get("profile", {}).get("name", ""),
            "first_name": member_data.get("profile", {}).get("name", "").split()[0] if member_data.get("profile", {}).get("name") else "",
            "email": recipient_email,
            "kennitala": recipient_kennitala
        }
        if member_data.get("membership", {}).get("cell"):
            variables["cell"] = {
                "name": member_data.get("membership", {}).get("cell", "")
            }

    # Render template
    rendered_subject = render_template(template_subject, variables)
    rendered_html = render_template(template_body_html, variables)
    rendered_text = render_template(template_body_text, variables)

    # Get SES client
    ses = get_ses_client()
    if not ses:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAVAILABLE,
            message="Email service not configured"
        )

    try:
        # Send via Amazon SES
        response = ses.send_email(
            Source=DEFAULT_SENDER,
            Destination={
                'ToAddresses': [recipient_email]
            },
            Message={
                'Subject': {
                    'Data': rendered_subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Text': {
                        'Data': rendered_text,
                        'Charset': 'UTF-8'
                    },
                    'Html': {
                        'Data': rendered_html,
                        'Charset': 'UTF-8'
                    }
                }
            },
            Tags=[
                {'Name': 'Type', 'Value': email_type},
                {'Name': 'TemplateId', 'Value': template_result.get("id", "unknown")}
            ]
        )

        message_id = response.get("MessageId")

        # Log to email_logs collection
        log_data = {
            "template_id": template_result.get("id"),
            "recipient_email": recipient_email,
            "recipient_kennitala": recipient_kennitala,
            "status": "sent",
            "ses_message_id": message_id,
            "sent_at": datetime.utcnow(),
            "metadata": {
                "type": email_type,
                "subject": rendered_subject,
                "sent_by": req.auth.uid
            }
        }
        db.collection("email_logs").add(log_data)

        log_json("info", "Email sent via SES",
                 message_id=message_id,
                 template_id=template_result.get("id"),
                 recipient=recipient_email[:3] + "***",
                 email_type=email_type,
                 admin_uid=req.auth.uid)

        return {
            "success": True,
            "message_id": message_id,
            "recipient": recipient_email
        }

    except Exception as e:
        log_json("error", "Failed to send email via SES",
                 error=str(e),
                 template_id=template_id,
                 admin_uid=req.auth.uid)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to send email: {str(e)}"
        )


# ==============================================================================
# CAMPAIGNS
# ==============================================================================

def list_email_campaigns_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    List email campaigns.

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
    query = db.collection("email_campaigns")

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
            "open_count": campaign.get("open_count", 0),
            "scheduled_at": campaign.get("scheduled_at").isoformat() if campaign.get("scheduled_at") else None,
            "completed_at": campaign.get("completed_at").isoformat() if campaign.get("completed_at") else None,
            "created_at": campaign.get("created_at").isoformat() if campaign.get("created_at") else None
        })

    return {"campaigns": campaigns, "count": len(campaigns)}


def create_email_campaign_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Create a new email campaign (draft).

    Required data:
        - name: Campaign name
        - template_id: Template to use

    Optional data:
        - recipient_filter: { status, districts[], municipalities[] }
        - scheduled_at: ISO datetime for scheduled send

    Returns:
        Created campaign with ID.
    """
    require_admin(req)

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
    template_doc = db.collection("email_templates").document(template_id).get()
    if not template_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"Template '{template_id}' not found"
        )

    # Count recipients based on filter
    members_query = db.collection("members")
    if recipient_filter.get("status") == "active":
        members_query = members_query.where("membership.status", "==", "active")
    # TODO: Add district/municipality filters

    recipient_count = len(list(members_query.stream()))

    now = datetime.utcnow()
    campaign_data = {
        "name": name,
        "template_id": template_id,
        "status": "draft",
        "recipient_filter": recipient_filter,
        "recipient_count": recipient_count,
        "sent_count": 0,
        "failed_count": 0,
        "open_count": 0,
        "click_count": 0,
        "scheduled_at": datetime.fromisoformat(scheduled_at) if scheduled_at else None,
        "created_at": now,
        "created_by": req.auth.uid,
        "updated_at": now
    }

    _, doc_ref = db.collection("email_campaigns").add(campaign_data)

    log_json("info", "Created email campaign",
             campaign_id=doc_ref.id,
             name=name,
             recipient_count=recipient_count,
             admin_uid=req.auth.uid)

    return {
        "success": True,
        "campaign_id": doc_ref.id,
        "name": name,
        "recipient_count": recipient_count,
        "status": "draft"
    }


def send_campaign_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send an email campaign to all recipients.

    Required data:
        - campaign_id: Campaign to send

    Note: This is a long-running operation. For large campaigns,
    consider using Cloud Tasks for better reliability.

    Returns:
        Send progress with counts.
    """
    require_admin(req)

    data = req.data or {}
    campaign_id = data.get("campaign_id")
    batch_size = min(data.get("batch_size", 100), 500)

    if not campaign_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="campaign_id is required"
        )

    db = firestore.client()

    # Get campaign
    campaign_ref = db.collection("email_campaigns").document(campaign_id)
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
    template_doc = db.collection("email_templates").document(campaign.get("template_id")).get()
    if not template_doc.exists:
        campaign_ref.update({"status": "draft"})  # Revert
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Campaign template not found"
        )

    template = template_doc.to_dict()

    # Get SES client
    ses = get_ses_client()
    if not ses:
        campaign_ref.update({"status": "draft"})  # Revert
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAVAILABLE,
            message="Email service not configured"
        )

    # Get recipients
    recipient_filter = campaign.get("recipient_filter", {})
    members_query = db.collection("members")

    if recipient_filter.get("status") == "active":
        members_query = members_query.where("membership.status", "==", "active")

    sent_count = 0
    failed_count = 0

    try:
        emails_processed = 0

        for member_doc in members_query.stream():
            member = member_doc.to_dict()
            email = member.get("profile", {}).get("email")

            if not email:
                failed_count += 1
                continue

            # Build variables
            variables = {
                "member": {
                    "name": member.get("profile", {}).get("name", ""),
                    "first_name": member.get("profile", {}).get("name", "").split()[0] if member.get("profile", {}).get("name") else "",
                    "email": email
                }
            }
            if member.get("membership", {}).get("cell"):
                variables["cell"] = {"name": member.get("membership", {}).get("cell", "")}

            # Render template
            rendered_subject = render_template(template.get("subject", ""), variables)
            rendered_html = render_template(template.get("body_html", ""), variables)
            rendered_text = render_template(template.get("body_text", ""), variables)

            # Send via SES (individual sends for better tracking)
            try:
                response = ses.send_email(
                    Source=DEFAULT_SENDER,
                    Destination={
                        'ToAddresses': [email]
                    },
                    Message={
                        'Subject': {
                            'Data': rendered_subject,
                            'Charset': 'UTF-8'
                        },
                        'Body': {
                            'Text': {
                                'Data': rendered_text,
                                'Charset': 'UTF-8'
                            },
                            'Html': {
                                'Data': rendered_html,
                                'Charset': 'UTF-8'
                            }
                        }
                    },
                    Tags=[
                        {'Name': 'Type', 'Value': 'broadcast'},
                        {'Name': 'CampaignId', 'Value': campaign_id}
                    ]
                )

                # Log individual email
                log_data = {
                    "campaign_id": campaign_id,
                    "template_id": campaign.get("template_id"),
                    "recipient_email": email,
                    "recipient_kennitala": member.get("kennitala"),
                    "status": "sent",
                    "ses_message_id": response.get("MessageId"),
                    "sent_at": datetime.utcnow()
                }
                db.collection("email_logs").add(log_data)

                sent_count += 1

            except Exception as e:
                log_json("warning", "Failed to send campaign email",
                         error=str(e),
                         recipient=email[:3] + "***")
                failed_count += 1

            emails_processed += 1

            # Update progress periodically
            if emails_processed % batch_size == 0:
                campaign_ref.update({
                    "sent_count": sent_count,
                    "failed_count": failed_count
                })

        # Update final status
        campaign_ref.update({
            "status": "sent",
            "sent_count": sent_count,
            "failed_count": failed_count,
            "completed_at": datetime.utcnow()
        })

        log_json("info", "Campaign sent",
                 campaign_id=campaign_id,
                 sent_count=sent_count,
                 failed_count=failed_count,
                 admin_uid=req.auth.uid)

        return {
            "success": True,
            "campaign_id": campaign_id,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "status": "sent"
        }

    except Exception as e:
        campaign_ref.update({
            "status": "draft",
            "sent_count": sent_count,
            "failed_count": failed_count
        })
        log_json("error", "Campaign send failed",
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

def get_email_stats_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get email sending statistics.

    Optional data:
        - campaign_id: Stats for specific campaign
        - days: Number of days to include (default 30)

    Returns:
        Email stats summary.
    """
    require_admin(req)

    data = req.data or {}
    campaign_id = data.get("campaign_id")
    days = min(data.get("days", 30), 90)

    db = firestore.client()

    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)

    if campaign_id:
        # Stats for specific campaign
        logs = db.collection("email_logs").where("campaign_id", "==", campaign_id).stream()
    else:
        # Recent stats
        logs = db.collection("email_logs").where("sent_at", ">=", cutoff).stream()

    stats = {
        "total": 0,
        "sent": 0,
        "delivered": 0,
        "opened": 0,
        "bounced": 0,
        "complained": 0
    }

    for log_doc in logs:
        log_data = log_doc.to_dict()
        status = log_data.get("status", "sent")
        stats["total"] += 1

        if status in stats:
            stats[status] += 1

    # Calculate rates
    if stats["total"] > 0:
        stats["delivery_rate"] = round(stats["delivered"] / stats["total"] * 100, 1)
        stats["open_rate"] = round(stats["opened"] / stats["delivered"] * 100, 1) if stats["delivered"] > 0 else 0
        stats["bounce_rate"] = round(stats["bounced"] / stats["total"] * 100, 1)
    else:
        stats["delivery_rate"] = 0
        stats["open_rate"] = 0
        stats["bounce_rate"] = 0

    return {
        "stats": stats,
        "period_days": days,
        "campaign_id": campaign_id
    }


def list_email_logs_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    List email send logs.

    Optional filters:
        - campaign_id: Filter by campaign
        - status: Filter by status
        - limit: Max results (default 100)

    Returns:
        List of email logs.
    """
    require_admin(req)

    data = req.data or {}
    campaign_id = data.get("campaign_id")
    status = data.get("status")
    limit = min(data.get("limit", 100), 500)

    db = firestore.client()
    query = db.collection("email_logs")

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
            "recipient_email": log_data.get("recipient_email", "")[:3] + "***" if log_data.get("recipient_email") else None,
            "status": log_data.get("status"),
            "sent_at": log_data.get("sent_at").isoformat() if log_data.get("sent_at") else None,
            "delivered_at": log_data.get("delivered_at").isoformat() if log_data.get("delivered_at") else None,
            "opened_at": log_data.get("opened_at").isoformat() if log_data.get("opened_at") else None
        })

    return {"logs": logs, "count": len(logs)}
