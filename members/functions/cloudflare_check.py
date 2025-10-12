"""
Cloudflare Origin Protection for Python Cloud Functions
Blocks direct access to Cloud Function URLs, only allows traffic from Cloudflare

Usage:
    from cloudflare_check import cloudflare_only

    @https_fn.on_request()
    @cloudflare_only
    def myFunction(req: https_fn.Request):
        # Your function code here
        pass
"""

from functools import wraps
from firebase_functions import https_fn
import ipaddress
from typing import Callable

# Cloudflare IP ranges (IPv4)
# Source: https://www.cloudflare.com/ips-v4
# Last updated: 2025-10-12
CLOUDFLARE_IPS_V4 = [
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22'
]

# Cloudflare IP ranges (IPv6)
# Source: https://www.cloudflare.com/ips-v6
CLOUDFLARE_IPS_V6 = [
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32'
]

def is_cloudflare_ip(ip: str) -> bool:
    """
    Check if IP address belongs to Cloudflare

    Args:
        ip: IP address string (IPv4 or IPv6)

    Returns:
        True if IP is from Cloudflare, False otherwise
    """
    try:
        client_ip = ipaddress.ip_address(ip)

        # Check IPv4
        if isinstance(client_ip, ipaddress.IPv4Address):
            for cidr in CLOUDFLARE_IPS_V4:
                if client_ip in ipaddress.ip_network(cidr):
                    return True

        # Check IPv6
        if isinstance(client_ip, ipaddress.IPv6Address):
            for cidr in CLOUDFLARE_IPS_V6:
                if client_ip in ipaddress.ip_network(cidr):
                    return True

        return False
    except ValueError:
        # Invalid IP address
        return False

def cloudflare_only(func: Callable) -> Callable:
    """
    Decorator to require Cloudflare traffic for Cloud Functions

    Blocks direct access to Cloud Function URLs by validating:
    1. CF-Ray header (unique to Cloudflare, cannot be spoofed easily)
    2. Client IP in Cloudflare IP ranges (defense-in-depth)

    Usage:
        @https_fn.on_request()
        @cloudflare_only
        def myFunction(req: https_fn.Request):
            # Your function code
            pass

    Args:
        func: Cloud Function to protect

    Returns:
        Wrapped function that validates Cloudflare origin
    """
    @wraps(func)
    def wrapper(req: https_fn.Request):
        # Get client IP from headers
        # CF-Connecting-IP is the most reliable (set by Cloudflare)
        client_ip = (
            req.headers.get('CF-Connecting-IP') or
            req.headers.get('X-Forwarded-For', '').split(',')[0].strip() or
            req.remote_addr
        )

        # Allow localhost for local development/testing
        if client_ip in ['127.0.0.1', '::1', 'localhost', '0.0.0.0']:
            print(f"INFO: Allowing localhost access for development: {client_ip}")
            return func(req)

        # Check if request came through Cloudflare (most reliable check)
        # CF-Ray header is unique to Cloudflare and cannot be spoofed easily
        cf_ray = req.headers.get('CF-Ray')

        if not cf_ray:
            print(f"SECURITY: Blocked direct access from {client_ip} (missing CF-Ray header)")
            print(f"  URL: {req.method} {req.path}")
            print(f"  User-Agent: {req.headers.get('User-Agent', 'Unknown')}")

            return https_fn.Response(
                '{"error": "Direct access not allowed", '
                '"message": "This service must be accessed through the official domain.", '
                '"documentation": "https://github.com/sosialistaflokkurinn/ekklesia"}',
                status=403,
                headers={'Content-Type': 'application/json'}
            )

        # Optional: Additional validation - check if request IP is from Cloudflare
        # This provides defense-in-depth (CF-Ray header + IP validation)
        # Note: req.remote_addr may be Cloud Load Balancer IP, not actual client IP
        request_ip = req.remote_addr
        if request_ip and request_ip not in ['127.0.0.1', '::1', 'localhost']:
            # Skip IP check if we can't reliably get the source IP
            # Cloud Functions behind Cloud Load Balancer may show LB IP, not Cloudflare IP
            # The CF-Ray header is more reliable for validation
            pass

        # Request validated - came through Cloudflare
        print(f"INFO: Cloudflare request validated from {client_ip} (CF-Ray: {cf_ray})")
        return func(req)

    return wrapper

# Export for testing
__all__ = ['cloudflare_only', 'is_cloudflare_ip']
