# Elections Service MVP - Dockerfile
# Node.js 20 LTS + Express
# Optimized for Cloud Run deployment

FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Create non-root user for security
RUN useradd -r -u 1001 -g node appuser && \
    chown -R appuser:node /app

# Switch to non-root user
USER appuser

# Expose port (Cloud Run will override this)
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "src/index.js"]
