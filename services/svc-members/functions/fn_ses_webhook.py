"""
Amazon SES SNS Webhook Handler - Issue #323

HTTP endpoint for receiving SES delivery notifications via SNS.
Updates email_logs collection with delivery status.

SES Notification Types:
- Delivery: Email delivered to recipient's mail server
- Bounce: Email bounced (hard or soft)
- Complaint: Recipient marked as spam

Setup in AWS:
1. Create SNS topic in same region as SES
2. Subscribe this webhook URL to the SNS topic
3. In SES, set up "Configuration Set" with SNS destination
4. For initial subscription, handle SubscriptionConfirmation

Webhook URL:
https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/ses_webhook
"""

from firebase_admin import firestore
from firebase_functions import https_fn
from util_logging import log_json
from datetime import datetime
import json
import urllib.request


def get_firestore_client():
    """Get Firestore client."""
    return firestore.client()


def update_email_log(message_id: str, updates: dict) -> bool:
    """
    Update email log document by SES message ID.

    Args:
        message_id: SES MessageId
        updates: Fields to update

    Returns:
        True if document was found and updated, False otherwise
    """
    db = get_firestore_client()

    # Find email log by ses_message_id
    logs = db.collection('email_logs').where(
        'ses_message_id', '==', message_id
    ).limit(1).stream()

    log_list = list(logs)
    if not log_list:
        log_json('warning', 'Email log not found for message',
                 message_id=message_id)
        return False

    doc_ref = log_list[0].reference
    doc_ref.update(updates)

    return True


def update_campaign_stats(campaign_id: str, stat_field: str, increment: int = 1):
    """
    Increment a campaign statistic.

    Args:
        campaign_id: Campaign document ID
        stat_field: Field to increment (open_count, click_count, etc.)
        increment: Amount to increment by
    """
    if not campaign_id:
        return

    db = get_firestore_client()
    campaign_ref = db.collection('email_campaigns').document(campaign_id)

    # Use Firestore increment for atomic update
    campaign_ref.update({
        stat_field: firestore.Increment(increment)
    })


def handle_delivery(notification: dict):
    """Handle Delivery notification - email delivered to mail server."""
    delivery = notification.get('delivery', {})
    mail = notification.get('mail', {})
    message_id = mail.get('messageId')
    timestamp = delivery.get('timestamp')

    if not message_id:
        log_json('warning', 'Delivery notification missing messageId')
        return

    updates = {
        'status': 'delivered',
        'delivered_at': datetime.fromisoformat(timestamp.replace('Z', '+00:00')) if timestamp else datetime.utcnow()
    }

    if update_email_log(message_id, updates):
        log_json('info', 'Email marked as delivered',
                 message_id=message_id)


def handle_bounce(notification: dict):
    """Handle Bounce notification - email bounced."""
    bounce = notification.get('bounce', {})
    mail = notification.get('mail', {})
    message_id = mail.get('messageId')
    bounce_type = bounce.get('bounceType')  # Permanent, Transient, Undetermined
    bounce_subtype = bounce.get('bounceSubType')

    if not message_id:
        log_json('warning', 'Bounce notification missing messageId')
        return

    # Get bounced recipients
    bounced_recipients = bounce.get('bouncedRecipients', [])
    recipient_emails = [r.get('emailAddress', '')[:3] + '***' for r in bounced_recipients]

    updates = {
        'status': 'bounced',
        'error_message': f"{bounce_type}: {bounce_subtype}",
        'bounced_at': datetime.utcnow()
    }

    if update_email_log(message_id, updates):
        log_json('warning', 'Email bounced',
                 message_id=message_id,
                 bounce_type=bounce_type,
                 bounce_subtype=bounce_subtype,
                 recipients=recipient_emails)

        # Flag for hard bounces (Permanent)
        if bounce_type == 'Permanent':
            log_json('warning', 'Hard bounce - consider flagging email',
                     recipients=recipient_emails)


def handle_complaint(notification: dict):
    """Handle Complaint notification - recipient marked as spam."""
    complaint = notification.get('complaint', {})
    mail = notification.get('mail', {})
    message_id = mail.get('messageId')
    complaint_type = complaint.get('complaintFeedbackType', 'unknown')

    if not message_id:
        log_json('warning', 'Complaint notification missing messageId')
        return

    # Get complaining recipients
    complained_recipients = complaint.get('complainedRecipients', [])
    recipient_emails = [r.get('emailAddress', '')[:3] + '***' for r in complained_recipients]

    updates = {
        'status': 'complained',
        'error_message': f'Marked as spam by recipient ({complaint_type})',
        'complained_at': datetime.utcnow()
    }

    if update_email_log(message_id, updates):
        log_json('warning', 'Email marked as spam',
                 message_id=message_id,
                 complaint_type=complaint_type,
                 recipients=recipient_emails)

        # Consider unsubscribing member from future emails
        log_json('warning', 'Spam complaint - consider unsubscribing',
                 recipients=recipient_emails)


def handle_subscription_confirmation(data: dict) -> str:
    """
    Handle SNS SubscriptionConfirmation message.
    Must confirm subscription for webhook to receive notifications.
    """
    subscribe_url = data.get('SubscribeURL')
    topic_arn = data.get('TopicArn')

    if not subscribe_url:
        log_json('error', 'SubscriptionConfirmation missing SubscribeURL')
        return 'Missing SubscribeURL'

    log_json('info', 'Confirming SNS subscription',
             topic_arn=topic_arn)

    try:
        # Call the SubscribeURL to confirm
        with urllib.request.urlopen(subscribe_url, timeout=10) as response:
            response.read()
        log_json('info', 'SNS subscription confirmed',
                 topic_arn=topic_arn)
        return 'Subscription confirmed'
    except Exception as e:
        log_json('error', 'Failed to confirm SNS subscription',
                 error=str(e),
                 topic_arn=topic_arn)
        return f'Failed to confirm: {str(e)}'


# Notification handlers mapping
NOTIFICATION_HANDLERS = {
    'Delivery': handle_delivery,
    'Bounce': handle_bounce,
    'Complaint': handle_complaint,
}


@https_fn.on_request()
def ses_webhook(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP endpoint for SES SNS notifications.

    SNS sends POST requests with JSON body containing:
    - SubscriptionConfirmation: Initial subscription (must be confirmed)
    - Notification: Actual SES event data
    """
    # Only accept POST requests
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)

    # Get message type from header
    message_type = req.headers.get('x-amz-sns-message-type')

    # Parse JSON body
    try:
        data = req.get_json(force=True)
    except Exception as e:
        log_json('error', 'Failed to parse webhook JSON', error=str(e))
        return https_fn.Response('Invalid JSON', status=400)

    if not data:
        log_json('warning', 'Empty webhook payload')
        return https_fn.Response('Empty payload', status=400)

    # Handle subscription confirmation
    if message_type == 'SubscriptionConfirmation' or data.get('Type') == 'SubscriptionConfirmation':
        result = handle_subscription_confirmation(data)
        return https_fn.Response(result, status=200)

    # Handle unsubscribe confirmation
    if message_type == 'UnsubscribeConfirmation' or data.get('Type') == 'UnsubscribeConfirmation':
        log_json('info', 'SNS unsubscribe confirmation received',
                 topic_arn=data.get('TopicArn'))
        return https_fn.Response('OK', status=200)

    # Handle notification
    if message_type == 'Notification' or data.get('Type') == 'Notification':
        # The actual SES notification is in the 'Message' field as JSON string
        try:
            message = data.get('Message', '{}')
            if isinstance(message, str):
                notification = json.loads(message)
            else:
                notification = message
        except json.JSONDecodeError as e:
            log_json('error', 'Failed to parse notification message',
                     error=str(e))
            return https_fn.Response('Invalid notification format', status=400)

        # Get notification type from SES
        notification_type = notification.get('notificationType')

        if not notification_type:
            log_json('warning', 'Notification missing notificationType',
                     data=str(notification)[:200])
            return https_fn.Response('Missing notificationType', status=400)

        # Find and call appropriate handler
        handler = NOTIFICATION_HANDLERS.get(notification_type)

        if handler:
            try:
                handler(notification)
                log_json('info', 'SES notification processed',
                         notification_type=notification_type,
                         message_id=notification.get('mail', {}).get('messageId'))
            except Exception as e:
                log_json('error', 'Notification handler failed',
                         notification_type=notification_type,
                         error=str(e))
                # Return 200 anyway to prevent SNS retries for handler errors
                return https_fn.Response('Handler error', status=200)
        else:
            log_json('info', 'Unhandled notification type',
                     notification_type=notification_type)

    # Always return 200 to acknowledge receipt
    return https_fn.Response('OK', status=200)
