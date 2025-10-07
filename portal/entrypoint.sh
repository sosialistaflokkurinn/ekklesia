#!/bin/bash
set -e

# Ekklesia Portal - Docker Entrypoint
# Supports multiple commands: serve (default), migrate, shell

COMMAND="${1:-serve}"

case "$COMMAND" in
    serve)
        echo "🚀 Starting Ekklesia Portal..."
        exec gunicorn \
            --bind "0.0.0.0:${PORT:-8080}" \
            --workers 2 \
            --threads 4 \
            --timeout 120 \
            --access-logfile - \
            --error-logfile - \
            --log-level info \
            "ekklesia_portal.app:make_wsgi_app()"
        ;;

    migrate)
        echo "🔄 Running database migrations..."
        cd /app
        exec alembic upgrade head
        ;;

    shell)
        echo "🐚 Starting Python shell..."
        cd /app
        exec python
        ;;

    *)
        echo "Unknown command: $COMMAND"
        echo "Usage: $0 {serve|migrate|shell}"
        exit 1
        ;;
esac
