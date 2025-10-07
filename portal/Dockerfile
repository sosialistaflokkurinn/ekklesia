# Ekklesia Portal - Production Dockerfile for Cloud Run
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create application user
RUN useradd -m -u 10000 ekklesia-portal

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install Poetry and dependencies
RUN pip install --no-cache-dir poetry==1.7.1 && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction --no-ansi

# Copy application source
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Copy babel config for translations
COPY babel.cfg ./

# Copy entrypoint script
COPY entrypoint.sh ./

# Compile translations (if they exist)
RUN if [ -d "src/ekklesia_portal/translations" ]; then \
    cd src/ekklesia_portal && \
    find translations -name "*.mo" -o -name "*.po" | head -1 && \
    python -m babel.messages.frontend compile -d translations || true; \
    fi

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

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
