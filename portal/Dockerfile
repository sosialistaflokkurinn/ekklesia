# Ekklesia Portal - Simplified Production Dockerfile for Cloud Run
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create application user
RUN useradd -m -u 10000 ekklesia-portal

# Set working directory
WORKDIR /app

# Copy application source first (for pip install -e)
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY babel.cfg ./
COPY entrypoint.sh ./
COPY pyproject.toml ./

# Install PyYAML 6.0.1 first to avoid build issues with 5.4.1
RUN pip install --no-cache-dir pyyaml==6.0.1

# Install ekklesia-common from GitHub WITH all its dependencies
RUN pip install --no-cache-dir git+https://github.com/edemocracy/ekklesia-common.git@master

# Install remaining Portal-specific dependencies
RUN pip install --no-cache-dir \
    alembic \
    dataclasses-json \
    passlib \
    psycopg2-binary \
    sqlalchemy==1.4.53 \
    sqlalchemy-searchable \
    base32-crockford \
    babel \
    deform \
    eliot-tree \
    pdbpp \
    Jinja2 \
    typer \
    gunicorn \
    ipython \
    rich \
    pytz \
    zope.sqlalchemy \
    case-conversion \
    attrs \
    more.babel-i18n \
    more.browser-session \
    more.forwarded \
    more.itsdangerous \
    more.jinja2 \
    more.transaction \
    more.webassets \
    morepath \
    webob

# Compile translations (if they exist)
RUN if [ -d "src/ekklesia_portal/translations" ]; then \
    cd src/ekklesia_portal && \
    python -m babel.messages.frontend compile -d translations || true; \
    fi

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    PYTHONPATH=/app/src

# Change ownership and make entrypoint executable
RUN chown -R ekklesia-portal:ekklesia-portal /app && \
    chmod +x /app/entrypoint.sh

# Switch to non-root user
USER ekklesia-portal

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["serve"]
