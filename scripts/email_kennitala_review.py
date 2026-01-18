#!/usr/bin/env python3
"""
Send email to members not found in Þjóðskrá about kennitala verification.

This script sends an explanatory email to members whose kennitala was not
found in the national registry (Þjóðskrá).

Usage:
    python email_kennitala_review.py --dry-run  # Preview without sending
    python email_kennitala_review.py            # Send emails
"""

import argparse
import json
import logging
import os
import time
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Email configuration
SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"
FROM_EMAIL = "xj@xj.is"  # Verified sender
FROM_NAME = "Sósíalistaflokkurinn"
REPLY_TO_EMAIL = "gudrodur@gmail.com"

# Email content
SUBJECT = "Kennitala þín fannst ekki í Þjóðskrá"

EMAIL_HTML = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
    h1 {{ color: #c8102e; font-size: 24px; }}
    .info-box {{ background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; font-family: monospace; }}
    .action {{ background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }}
    .footer {{ font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }}
  </style>
</head>
<body>
  <h1>Kæri/kæra {name},</h1>

  <p>Við höfum nýlega farið yfir félagaskrá okkar og borið hana saman við Þjóðskrá Íslands. Í þeirri yfirferð kom í ljós að <strong>kennitalan sem við höfum skráða fannst ekki í Þjóðskrá</strong>.</p>

  <p><strong>Upplýsingar sem við höfum skráðar:</strong></p>
  <div class="info-box">
    Nafn: {name}<br>
    Kennitala: <strong style="color: #c8102e;">{kennitala}</strong> <span style="color: #c8102e;">(röng)</span><br>
    Netfang: {email}
  </div>

  <div class="action">
    <strong>Vinsamlegast svaraðu þessum pósti</strong> og láttu okkur vita rétta kennitölu þína, svo við getum lagað skráninguna.
  </div>

  <p>Með félagslegum kveðjum,<br>
  <strong>Guðröður Atli Jónsson</strong><br>
  <em>fh. Tækniráðs SÍ</em></p>

  <p style="font-size: 12px; color: #666; margin-top: 20px;">
    Sósíalistaflokkur Íslands | <a href="https://sosialistaflokkurinn.is">sosialistaflokkurinn.is</a>
  </p>
</body>
</html>
"""

EMAIL_TEXT = """
Kæri/kæra {name},

Við höfum nýlega farið yfir félagaskrá okkar og borið hana saman við Þjóðskrá Íslands. Í þeirri yfirferð kom í ljós að kennitalan sem við höfum skráða fannst ekki í Þjóðskrá.

UPPLÝSINGAR SEM VIÐ HÖFUM SKRÁÐAR:
  Nafn: {name}
  Kennitala: {kennitala} (RÖNG)
  Netfang: {email}

Vinsamlegast svaraðu þessum pósti og láttu okkur vita rétta kennitölu þína, svo við getum lagað skráninguna.

Með félagslegum kveðjum,
Guðröður Atli Jónsson
fh. Tækniráðs SÍ

--
Sósíalistaflokkur Íslands | sosialistaflokkurinn.is
"""


def get_sendgrid_api_key() -> str:
    """Get SendGrid API key from Secret Manager."""
    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = "projects/ekklesia-prod-10-2025/secrets/sendgrid-api-key/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8").strip()
    except Exception as e:
        logger.error(f"Failed to get SendGrid API key: {e}")
        raise


def init_firebase() -> firestore.Client:
    """Initialize Firebase Admin SDK and return Firestore client."""
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {'projectId': 'ekklesia-prod-10-2025'})
    return firestore.client()


def get_recipients(db: firestore.Client) -> list:
    """Get list of recipients (members not found in Þjóðskrá with email)."""
    # Load the not found kennitölur
    results_file = os.path.join(
        os.path.dirname(__file__),
        'thjodskra-results.json'
    )

    with open(results_file, 'r') as f:
        data = json.load(f)

    not_found_kts = [r['kt'] for r in data['results'] if not r.get('found')]

    recipients = []
    for kt in not_found_kts:
        doc = db.collection('members').document(kt).get()
        if doc.exists:
            member_data = doc.to_dict()
            email = member_data.get('profile', {}).get('email', '')
            name = member_data.get('name', '')

            if email and '@' in email:
                recipients.append({
                    'kennitala': kt,
                    'email': email,
                    'name': name or 'Félagi'
                })

    return recipients


def send_email(api_key: str, recipient: dict) -> bool:
    """Send email to a single recipient."""
    # Format email content with recipient's info
    name = recipient['name'] or 'félagi'
    kennitala = recipient['kennitala']
    email = recipient['email']
    html_content = EMAIL_HTML.format(name=name, kennitala=kennitala, email=email)
    text_content = EMAIL_TEXT.format(name=name, kennitala=kennitala, email=email)

    payload = {
        "personalizations": [{
            "to": [{"email": recipient['email'], "name": recipient['name']}],
            "subject": SUBJECT
        }],
        "from": {"email": FROM_EMAIL, "name": FROM_NAME},
        "reply_to": {"email": REPLY_TO_EMAIL},
        "content": [
            {"type": "text/plain", "value": text_content},
            {"type": "text/html", "value": html_content}
        ],
        "tracking_settings": {
            "click_tracking": {"enable": True},
            "open_tracking": {"enable": True}
        }
    }

    try:
        response = requests.post(
            SENDGRID_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            timeout=30
        )

        if response.status_code in (200, 202):
            return True
        else:
            logger.error(f"SendGrid error: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        logger.error(f"Request error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Send kennitala review email to members not in Þjóðskrá'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview without sending'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=0,
        help='Limit number of emails to send (0 = all)'
    )
    parser.add_argument(
        '--test-email',
        type=str,
        help='Send test email to this address only'
    )
    parser.add_argument(
        '--test-name',
        type=str,
        default='Guðröður',
        help='Name to use in test email (default: Guðröður)'
    )
    parser.add_argument(
        '--test-kennitala',
        type=str,
        default='010190-2939',
        help='Kennitala to show in test email (default: 010190-2939)'
    )

    args = parser.parse_args()

    # Handle test email mode
    if args.test_email:
        logger.info(f"=== TEST EMAIL MODE ===")
        logger.info(f"Sending test email to: {args.test_email}")
        logger.info(f"Test name: {args.test_name}")
        logger.info(f"Test kennitala: {args.test_kennitala}")

        api_key = get_sendgrid_api_key()
        test_recipient = {
            'kennitala': args.test_kennitala,
            'email': args.test_email,
            'name': args.test_name
        }

        success = send_email(api_key, test_recipient)
        if success:
            logger.info(f"✅ Test email sent to {args.test_email}")
        else:
            logger.error(f"❌ Failed to send test email")
        return

    # Initialize
    logger.info("Initializing Firebase...")
    db = init_firebase()

    # Get recipients
    recipients = get_recipients(db)
    logger.info(f"Found {len(recipients)} recipients with email")

    if args.limit > 0:
        recipients = recipients[:args.limit]
        logger.info(f"Limited to {len(recipients)} recipients")

    if args.dry_run:
        logger.info("\n=== DRY RUN MODE ===")
        logger.info(f"Would send to {len(recipients)} recipients:")
        for i, r in enumerate(recipients[:10]):
            logger.info(f"  {i+1}. {r['name']} <{r['email']}> ({r['kennitala']})")
        if len(recipients) > 10:
            logger.info(f"  ... and {len(recipients) - 10} more")

        logger.info(f"\nSubject: {SUBJECT}")
        logger.info(f"From: {FROM_NAME} <{FROM_EMAIL}>")
        return

    # Get API key
    logger.info("Getting SendGrid API key...")
    api_key = get_sendgrid_api_key()

    # Send emails
    sent = 0
    errors = 0

    for i, recipient in enumerate(recipients):
        success = send_email(api_key, recipient)

        if success:
            sent += 1
            logger.info(f"✅ [{i+1}/{len(recipients)}] {recipient['email']}")
        else:
            errors += 1
            logger.error(f"❌ [{i+1}/{len(recipients)}] {recipient['email']}")

        # Rate limiting - SendGrid allows 100 emails/second
        time.sleep(0.1)

    # Summary
    logger.info("\n" + "=" * 50)
    logger.info("SUMMARY")
    logger.info("=" * 50)
    logger.info(f"  Sent: {sent}")
    logger.info(f"  Errors: {errors}")
    logger.info(f"  Total: {len(recipients)}")


if __name__ == '__main__':
    main()
