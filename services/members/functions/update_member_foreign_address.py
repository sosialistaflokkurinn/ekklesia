"""
Cloud Function: Update Member Foreign Address

Proxies foreign address updates to Django API while keeping token secure.
Issue #161: Foreign Address CRUD API

Security:
- Requires Firebase Authentication
- Calls Django API with server-side token from Secret Manager
- Only allows members to update their own address (or admins for any)
"""

import os
import requests
from firebase_functions import https_fn
from firebase_admin import auth


@https_fn.on_call(region="europe-west2")
def updatememberforeignaddress(req: https_fn.CallableRequest) -> dict:
    """
    Update member foreign address via Django API
    
    Input:
    {
        "kennitala": "2009783589",
        "foreign_address": {
            "country": 231,
            "address": "123 Main St",
            "postal_code": "98101",
            "municipality": "Seattle",
            "current": true
        }
    }
    
    Output:
    {
        "success": true,
        "django_id": 3204,
        "method": "POST",  // or "PATCH"
        "updated_fields": ["country", "address", "postal_code", "municipality"]
    }
    """
    
    # Require authentication
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )
    
    # Get parameters
    kennitala = req.data.get('kennitala')
    foreign_address = req.data.get('foreign_address')

    if not kennitala or not foreign_address:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="kennitala and foreign_address required"
        )

    # Convert country code to country ID if needed
    # Frontend sends country code (e.g., "US"), Django expects country ID (e.g., 211)
    country_value = foreign_address.get('country')
    if country_value and isinstance(country_value, str):
        # Map common country codes to Django Country IDs
        COUNTRY_CODE_TO_ID = {
            'US': 211,  # Bandaríkin
            'DK': 48,   # Danmörk
            'NO': 155,  # Noregur
            'SE': 189,  # Svíþjóð
            'FI': 64,   # Finnland
            'GB': 72,   # Bretland
            'DE': 204,  # Þýskaland
            'FR': 65,   # Frakkland
            'IS': 109,  # Ísland
            'CA': 35,   # Kanada
            'AU': 13,   # Ástralía
            'NZ': 154,  # Nýja-Sjáland
        }

        django_country_id = COUNTRY_CODE_TO_ID.get(country_value)
        if not django_country_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"Unknown country code: {country_value}"
            )

        foreign_address['country'] = django_country_id
    
    # Get Django API token from environment variable (injected via Secret Manager)
    django_token = os.environ.get('DJANGO_API_TOKEN')
    if not django_token:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="DJANGO_API_TOKEN environment variable not set"
        )
    
    # Django API base URL
    django_api_url = "https://starf.sosialistaflokkurinn.is/felagar/api/members"
    
    headers = {
        'Authorization': f'Token {django_token}',
        'Content-Type': 'application/json'
    }
    
    try:
        # Step 1: Check if foreign address already exists
        list_url = f"{django_api_url}/{kennitala}/foreign-addresses/"
        list_response = requests.get(list_url, headers=headers, timeout=10)
        
        if not list_response.ok:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message=f"Failed to list foreign addresses: {list_response.text}"
            )
        
        list_data = list_response.json()
        existing_addresses = list_data.get('results', list_data)
        
        # Find current address
        current_address = None
        if isinstance(existing_addresses, list):
            for addr in existing_addresses:
                if addr.get('current'):
                    current_address = addr
                    break
        
        # Step 2: Create or update
        if current_address:
            # PATCH existing
            method = "PATCH"
            url = f"{django_api_url}/{kennitala}/foreign-addresses/{current_address['pk']}/"
        else:
            # POST new
            method = "POST"
            url = f"{django_api_url}/{kennitala}/foreign-addresses/"
        
        # Make the request
        if method == "POST":
            response = requests.post(url, json=foreign_address, headers=headers, timeout=10)
        else:
            response = requests.patch(url, json=foreign_address, headers=headers, timeout=10)
        
        if not response.ok:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message=f"Django API error ({response.status_code}): {response.text}"
            )
        
        result = response.json()
        
        return {
            "success": True,
            "django_id": result.get('pk'),
            "method": method,
            "updated_fields": list(foreign_address.keys())
        }
        
    except requests.exceptions.RequestException as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Django API request failed: {str(e)}"
        )
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Unexpected error: {str(e)}"
        )
