"""
Cloud Function: getDjangoToken
Epic #116, Issue #137

Securely provides Django API token to authorized admin users.
Token is stored in Secret Manager and only accessible to admin/superuser roles.
"""

import os
import logging
from typing import Tuple, Any
from flask import jsonify, Request
from google.cloud import secretmanager
import firebase_admin
from firebase_admin import auth

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Secret Manager client
secret_client = secretmanager.SecretManagerServiceClient()

def get_django_token(request: Request) -> Tuple[Any, int, dict]:
    """
    HTTP Cloud Function to retrieve Django API token.

    Args:
        request (flask.Request): The request object

    Returns:
        flask.Response: JSON response with token or error

    Security:
        - Requires Firebase authentication
        - Requires 'admin' or 'superuser' role
        - Returns token from Secret Manager
    """

    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': 'https://ekklesia-prod-10-2025.web.app',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
    }

    # Handle preflight
    if request.method == 'OPTIONS':
        return ('', 204, headers)

    try:
        # Get Firebase auth token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            logger.warning('getDjangoToken: Missing or invalid Authorization header')
            return (jsonify({
                'error': 'Unauthorized',
                'message': 'Missing or invalid authentication token'
            }), 401, headers)

        id_token = auth_header.split('Bearer ')[1]

        # Verify Firebase token
        try:
            decoded_token = auth.verify_id_token(id_token)
        except Exception as e:
            logger.error(f'getDjangoToken: Token verification failed: {e}')
            return (jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid authentication token'
            }), 401, headers)

        # Check user roles
        roles = decoded_token.get('roles', [])
        has_admin_access = 'admin' in roles or 'superuser' in roles

        if not has_admin_access:
            logger.warning(f"getDjangoToken: Access denied for user {decoded_token['uid']} (roles: {', '.join(roles)})")
            return (jsonify({
                'error': 'Forbidden',
                'message': 'You do not have permission to access this resource. Admin or superuser role required.'
            }), 403, headers)

        # Get Django token from Secret Manager
        project_id = 'ekklesia-prod-10-2025'
        secret_name = f'projects/{project_id}/secrets/django-api-token/versions/latest'

        response = secret_client.access_secret_version(request={'name': secret_name})
        django_token = response.payload.data.decode('utf-8').strip()

        # Return token
        logger.info(f"getDjangoToken: Token provided to user {decoded_token['uid']} ({decoded_token.get('email', 'unknown')})")
        return (jsonify({
            'token': django_token,
            'expiresAt': None,  # Django tokens don't expire by default
            'message': 'Token retrieved successfully'
        }), 200, headers)

    except Exception as e:
        logger.error(f'getDjangoToken: Error: {e}')

        # Don't leak internal error details
        return (jsonify({
            'error': 'Internal Server Error',
            'message': 'Failed to retrieve token. Please try again later.'
        }), 500, headers)
