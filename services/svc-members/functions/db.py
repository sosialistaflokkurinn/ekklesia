"""
Cloud SQL Database Connector

Provides connection pooling for Cloud Functions to Cloud SQL.
Uses password authentication via Secret Manager.

Connection details:
- Instance: ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1
- Database: socialism
- User: socialism (Django admin)

Usage:
    from db import get_connection, execute_query

    # Simple query
    rows = execute_query("SELECT id, name FROM membership_comrade LIMIT 10")

    # With parameters
    rows = execute_query(
        "SELECT * FROM membership_comrade WHERE ssn = %s",
        params=("1234567890",)
    )

    # Manual connection (for transactions)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("...")
        conn.commit()

Environment:
    LOCAL_DB_HOST: Set to use direct connection (e.g., "localhost:5433")
    If not set, uses Cloud SQL Python Connector
"""

import logging
import os
from contextlib import contextmanager
from typing import List, Dict, Any, Optional, Tuple

# Configure logging
logger = logging.getLogger(__name__)

# Cloud SQL configuration
CLOUD_SQL_CONNECTION_NAME = "ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1"
DB_NAME = "socialism"
DB_USER = "socialism"

# Check if running locally (via Cloud SQL Proxy)
LOCAL_DB_HOST = os.environ.get('LOCAL_DB_HOST', '')

# Cache for secrets
_db_password: Optional[str] = None


def _get_db_password() -> str:
    """
    Get database password from environment or Secret Manager.
    Cached for performance.

    Priority:
    1. DB_PASSWORD env var (local testing)
    2. django-socialism-db-password env var (Firebase Functions secret injection)
    3. Secret Manager API (fallback)
    """
    global _db_password
    if _db_password is not None:
        return _db_password

    # Check explicit DB_PASSWORD first (for local testing)
    if os.environ.get('DB_PASSWORD'):
        _db_password = os.environ['DB_PASSWORD']
        logger.info("Loaded database password from DB_PASSWORD env var")
        return _db_password

    # Check Firebase Functions secret injection (hyphenated name becomes env var)
    # Firebase converts 'django-socialism-db-password' to environment variable
    secret_env = os.environ.get('django-socialism-db-password')
    if secret_env:
        _db_password = secret_env.strip()
        logger.info("Loaded database password from Firebase secret injection")
        return _db_password

    # Fallback: Use Secret Manager API
    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = "projects/ekklesia-prod-10-2025/secrets/django-socialism-db-password/versions/latest"
        response = client.access_secret_version(request={"name": name})
        _db_password = response.payload.data.decode("UTF-8").strip()
        logger.info("Loaded database password from Secret Manager API")
        return _db_password
    except Exception as e:
        logger.error(f"Failed to get database password: {e}")
        raise


# Global connector instance (reused across function invocations)
_connector = None


def _create_connection():
    """
    Create a new database connection.
    Uses Cloud SQL Python Connector in Cloud Functions, or direct connection locally.
    """
    global _connector

    password = _get_db_password()

    if LOCAL_DB_HOST:
        # Local development: use direct connection via Cloud SQL Proxy
        import pg8000
        host, port = LOCAL_DB_HOST.split(':') if ':' in LOCAL_DB_HOST else (LOCAL_DB_HOST, '5432')
        conn = pg8000.connect(
            host=host,
            port=int(port),
            user=DB_USER,
            password=password,
            database=DB_NAME,
        )
        logger.debug(f"Created local connection to {host}:{port}")
        return conn
    else:
        # Cloud Functions Gen 2 (Cloud Run): use Cloud SQL Python Connector
        # The connector handles both public IP and Unix socket automatically
        from google.cloud.sql.connector import Connector, IPTypes
        import pg8000

        if _connector is None:
            _connector = Connector()
            logger.info("Created Cloud SQL connector")

        try:
            # Try private IP first (VPC), then fallback to public
            conn = _connector.connect(
                CLOUD_SQL_CONNECTION_NAME,
                "pg8000",
                user=DB_USER,
                password=password,
                db=DB_NAME,
                ip_type=IPTypes.PUBLIC,  # Use PUBLIC since we don't have VPC connector
            )
            logger.info("Created Cloud SQL connection via public IP")
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to Cloud SQL: {e}")
            raise


@contextmanager
def get_connection():
    """
    Get a database connection as a context manager.

    Usage:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM table")
            rows = cursor.fetchall()
    """
    conn = None
    try:
        conn = _create_connection()
        yield conn
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception as e:
                logger.warning(f"Error closing connection: {e}")


def execute_query(
    query: str,
    params: Optional[Tuple] = None,
    fetch_one: bool = False
) -> List[Dict[str, Any]] | Dict[str, Any] | None:
    """
    Execute a SQL query and return results as list of dicts.

    Args:
        query: SQL query string (use %s for parameters)
        params: Tuple of query parameters
        fetch_one: If True, return only first row (or None)

    Returns:
        List of dicts (each dict is a row with column names as keys)
        Or single dict if fetch_one=True
        Or None if fetch_one=True and no results

    Example:
        # Get all members
        rows = execute_query("SELECT id, name FROM membership_comrade")

        # Get single member
        member = execute_query(
            "SELECT * FROM membership_comrade WHERE ssn = %s",
            params=("1234567890",),
            fetch_one=True
        )
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)

            # Get column names from cursor description
            columns = [desc[0] for desc in cursor.description] if cursor.description else []

            if fetch_one:
                row = cursor.fetchone()
                if row is None:
                    return None
                return dict(zip(columns, row))
            else:
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]

        except Exception as e:
            logger.error(f"Query failed: {e}\nQuery: {query}")
            raise
        finally:
            cursor.close()


def execute_update(query: str, params: Optional[Tuple] = None) -> int:
    """
    Execute an INSERT, UPDATE, or DELETE query.

    Args:
        query: SQL query string
        params: Tuple of query parameters

    Returns:
        Number of affected rows

    Example:
        affected = execute_update(
            "UPDATE membership_comrade SET name = %s WHERE id = %s",
            params=("New Name", 123)
        )
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            conn.rollback()
            logger.error(f"Update failed: {e}\nQuery: {query}")
            raise
        finally:
            cursor.close()


def test_connection() -> Dict[str, Any]:
    """
    Test the database connection.

    Returns:
        Dict with connection status and version info
    """
    try:
        result = execute_query("SELECT version()", fetch_one=True)
        count = execute_query("SELECT COUNT(*) as count FROM membership_comrade WHERE deleted_at IS NULL", fetch_one=True)
        return {
            "status": "connected",
            "version": result.get("version", "unknown") if result else "unknown",
            "member_count": count.get("count", 0) if count else 0,
            "connection_name": CLOUD_SQL_CONNECTION_NAME,
            "database": DB_NAME,
            "user": DB_USER
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "connection_name": CLOUD_SQL_CONNECTION_NAME,
            "database": DB_NAME,
            "user": DB_USER
        }
