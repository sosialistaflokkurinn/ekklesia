#!/bin/bash
# Build script for admin portal
# Copies admin portal files into public/admin/ directory for deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_SOURCE="$SCRIPT_DIR/../../apps/admin-portal"
ADMIN_DEST="$SCRIPT_DIR/public/admin"

echo "🔨 Building admin portal..."
echo "Source: $ADMIN_SOURCE"
echo "Destination: $ADMIN_DEST"

# Remove old admin files (but keep directory)
if [ -d "$ADMIN_DEST" ]; then
  echo "Cleaning old admin files..."
  rm -rf "$ADMIN_DEST"
fi

# Copy all admin portal files
echo "Copying admin portal files..."
cp -r "$ADMIN_SOURCE" "$ADMIN_DEST"

echo "✅ Admin portal built successfully!"
echo "Files copied to: $ADMIN_DEST"
