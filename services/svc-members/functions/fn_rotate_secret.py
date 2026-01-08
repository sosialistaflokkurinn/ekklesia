"""
Secret Rotation Cloud Function

Automatically rotates internal secrets when triggered by Secret Manager.
Triggered via Pub/Sub topic: secret-rotation

Internal secrets that can be rotated:
- unsubscribe-secret: HMAC key for email unsubscribe tokens
- elections-s2s-api-key: Service-to-service API key
- anonymization-salt: Salt for anonymizing member data
- log-salt: Salt for log pseudonymization
"""

import base64
import json
import secrets as secrets_module
from google.cloud import secretmanager
from firebase_functions import pubsub_fn

# Secrets that this function is allowed to rotate
ROTATABLE_SECRETS = {
    'unsubscribe-secret',
    'elections-s2s-api-key',
    'anonymization-salt',
    'log-salt',
}

# Project ID
PROJECT_ID = 'ekklesia-prod-10-2025'


def generate_secret_value(secret_name: str) -> str:
    """
    Generate a new random value for a secret.

    Uses cryptographically secure random bytes, URL-safe base64 encoded.
    32 bytes = 256 bits of entropy, sufficient for HMAC keys and salts.
    """
    random_bytes = secrets_module.token_bytes(32)
    return base64.urlsafe_b64encode(random_bytes).decode('utf-8')


def rotate_secret_handler(event: pubsub_fn.CloudEvent[pubsub_fn.MessagePublishedData]) -> None:
    """
    Handle secret rotation request from Secret Manager.

    Secret Manager sends a Pub/Sub message when rotation is needed.
    Message contains the secret name in the 'name' field.

    Args:
        event: CloudEvent with Pub/Sub message data
    """
    # Parse the Pub/Sub message
    try:
        message_data = event.data.message.data
        if message_data:
            decoded = base64.b64decode(message_data).decode('utf-8')
            message = json.loads(decoded)
        else:
            print("Empty message data")
            return
    except (KeyError, json.JSONDecodeError) as e:
        print(f"Error parsing message: {e}")
        return

    # Extract secret name from the rotation event
    # Format: projects/PROJECT/secrets/SECRET_NAME
    secret_path = message.get('name', '')
    if not secret_path:
        print("No secret name in message")
        return

    # Extract just the secret name
    secret_name = secret_path.split('/')[-1]

    # Security check: only rotate allowed secrets
    if secret_name not in ROTATABLE_SECRETS:
        print(f"Secret '{secret_name}' is not in the rotatable list. Skipping.")
        return

    print(f"Rotating secret: {secret_name}")

    # Generate new secret value
    new_value = generate_secret_value(secret_name)

    # Add new version to Secret Manager
    client = secretmanager.SecretManagerServiceClient()
    parent = f"projects/{PROJECT_ID}/secrets/{secret_name}"

    try:
        response = client.add_secret_version(
            request={
                "parent": parent,
                "payload": {"data": new_value.encode('utf-8')},
            }
        )
        print(f"Created new version: {response.name}")

        # Note: Old versions are not deleted automatically.
        # Secret Manager keeps version history for audit purposes.
        # Old versions can be disabled/destroyed via retention policy.

    except Exception as e:
        print(f"Error adding secret version: {e}")
        raise
