"""
Council Feedback Function

Allows authenticated members to send feedback/suggestions to tækniráð (technical council).
Creates a GitHub issue for tracking, then emails tækniráð members with a link to the issue.

Rate limit: 1 per hour per user.
"""

import os
import json
from html import escape
from typing import Dict, Any
from urllib.request import Request, urlopen
from urllib.error import URLError
from firebase_functions import https_fn
from util_logging import log_json
from db import execute_query
from shared.rate_limit import check_uid_rate_limit
from fn_admin_members import require_auth
from fn_email import send_email_with_fallback

GITHUB_REPO = "sosialistaflokkurinn/xj-site"
GEMINI_MODEL = "gemini-2.0-flash"


def get_council_member_emails(council_slug: str) -> list[str]:
    """Get email addresses of council members (non-alternate) from Cloud SQL."""
    rows = execute_query(
        """
        SELECT ci.email
        FROM membership_councilmembership cm
        JOIN membership_council co ON cm.council_id = co.id
        JOIN membership_comrade c ON cm.comrade_id = c.id
        JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE co.slug = %s
          AND cm.is_alternate = FALSE
          AND c.deleted_at IS NULL
          AND ci.email IS NOT NULL
          AND ci.email != ''
        """,
        params=(council_slug,)
    )
    return [row['email'] for row in rows] if rows else []


def format_issue_with_gemini(subject: str, message: str, sender_name: str) -> str | None:
    """Use Gemini to format the feedback into a well-structured GitHub issue body."""
    try:
        import google.auth
        import google.auth.transport.requests

        credentials, _ = google.auth.default()
        credentials.refresh(google.auth.transport.requests.Request())
        access_token = credentials.token

        prompt = f"""Þú ert kerfisstjóri Sósíalistaflokks Íslands. Meðlimur hefur sent ábendingu til tækniráðs.
Búðu til vel uppsett GitHub issue body á íslensku (markdown). Ekki breyta innihaldi skilaboðanna, en skipuleggðu þau vel.
Bættu við viðeigandi section headings ef þörf er á. Ekki bæta við neinu sem meðlimurinn sagði ekki.

Sendandi: {sender_name}
Efni: {subject}
Skilaboð:
{message}

Svaraðu AÐEINS með markdown body textanum fyrir GitHub issue. Engin kveðja eða útskýring."""

        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2000},
        }).encode("utf-8")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        req = Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return text.strip()
    except Exception as e:
        log_json("warning", "Gemini formatting failed, using plain text", error=str(e))
        return None


def create_github_issue(subject: str, message: str, sender_name: str) -> Dict[str, Any] | None:
    """Create a GitHub issue for the feedback. Uses Gemini to format the body."""
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        log_json("warning", "GITHUB_TOKEN not configured, skipping issue creation")
        return None

    # Let Gemini format the issue body, fall back to plain text
    formatted_body = format_issue_with_gemini(subject, message, sender_name)
    if formatted_body:
        body = f"{formatted_body}\n\n---\n_Sjálfvirkt búið til úr ábendingaformi á sosialistaflokkurinn.is (formuð af Gemini)_"
    else:
        body = f"**Frá:** {sender_name}\n\n{message}\n\n---\n_Sjálfvirkt búið til úr ábendingaformi á sosialistaflokkurinn.is_"

    payload = json.dumps({
        "title": f"Ábending: {subject}",
        "body": body,
        "labels": ["ábending"],
    }).encode("utf-8")

    req = Request(
        f"https://api.github.com/repos/{GITHUB_REPO}/issues",
        data=payload,
        headers={
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            log_json("info", "GitHub issue created",
                     issue_number=data.get("number"),
                     issue_url=data.get("html_url"))
            return data
    except URLError as e:
        log_json("error", "Failed to create GitHub issue", error=str(e))
        return None


def send_council_feedback_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send feedback to tækniráð members.

    Creates a GitHub issue, then emails tækniráð members with a link.

    Required data:
        subject (str): Feedback subject (3-200 chars)
        message (str): Feedback message (10-5000 chars)

    Returns:
        {"success": True, "message": "Ábending send til tækniráðs"}

    Rate limit: 1 per hour per user.
    """
    # Auth
    kennitala = require_auth(req)

    # Rate limit: 1 per hour
    if not check_uid_rate_limit(req.auth.uid, "council_feedback", max_attempts=1, window_minutes=60):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Aðeins ein ábending á klukkustund"
        )

    # Validate input
    data = req.data or {}
    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()

    if not subject or len(subject) < 3 or len(subject) > 200:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Efnislína verður að vera 3-200 stafir"
        )

    if not message or len(message) < 10 or len(message) > 5000:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Skilaboð verða að vera 10-5000 stafir"
        )

    # Look up sender name (prefer display_name if set)
    sender = execute_query(
        "SELECT name, display_name FROM membership_comrade WHERE ssn = %s AND deleted_at IS NULL",
        params=(kennitala,),
        fetch_one=True
    )
    sender_name = (sender.get('display_name') or sender['name']) if sender else "Óþekkt"

    # Create GitHub issue
    issue = create_github_issue(subject, message, sender_name)
    issue_url = issue.get("html_url") if issue else None
    issue_number = issue.get("number") if issue else None

    # Get tækniráð member emails
    emails = get_council_member_emails("taeknirad")

    if not emails:
        log_json("warning", "No tækniráð members found for feedback delivery",
                 uid=req.auth.uid)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Engir meðlimir í tækniráði fundust"
        )

    # Build email (escape user-provided values for HTML)
    safe_name = escape(sender_name)
    safe_subject = escape(subject)
    safe_message = escape(message).replace("\n", "<br>")

    issue_link_html = f'<p><strong>GitHub issue:</strong> <a href="{escape(issue_url)}">#{issue_number}</a></p>' if issue_url else ""
    issue_link_text = f"GitHub issue: {issue_url}" if issue_url else ""

    html_content = f"""
<h2>Ábending frá meðlim</h2>
<p><strong>Frá:</strong> {safe_name}</p>
<p><strong>Efni:</strong> {safe_subject}</p>
{issue_link_html}
<hr>
<p>{safe_message}</p>
<hr>
<p style="color: #666; font-size: 12px;">
    Þessi ábending var send gegnum vef flokksins (sosialistaflokkurinn.is).
</p>
"""

    text_content = f"""Ábending frá meðlim

Frá: {sender_name}
Efni: {subject}
{issue_link_text}

{message}

---
Þessi ábending var send gegnum vef flokksins (sosialistaflokkurinn.is).
"""

    # Send to each council member
    sent_count = 0
    for email in emails:
        try:
            send_email_with_fallback(
                to_email=email,
                subject=f"Ábending: {subject}",
                html_content=html_content,
                text_content=text_content,
                tags=["transactional", "council-feedback"]
            )
            sent_count += 1
        except Exception as e:
            log_json("error", "Failed to send council feedback email",
                     recipient=email[:3] + "***",
                     error=str(e),
                     uid=req.auth.uid)

    if sent_count == 0:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Villa við að senda ábendingu"
        )

    log_json("info", "Council feedback sent",
             uid=req.auth.uid,
             recipient_count=sent_count,
             issue_number=issue_number,
             subject_length=len(subject))

    return {"success": True, "message": "Ábending send til tækniráðs"}
