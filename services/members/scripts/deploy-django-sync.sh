#!/bin/bash
set -e

# Django Bi-Directional Sync Deployment Script
# Deploys models, signals, views, and URLs to Django on Linode server

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Django Bi-Directional Sync Deployment${NC}"
echo -e "${BLUE}========================================${NC}"

# Configuration
DJANGO_SSH="$HOME/django-ssh.sh"
DJANGO_PROJECT_DIR="/home/manager/socialism"
MEMBERSHIP_DIR="${DJANGO_PROJECT_DIR}/membership"
LOCAL_DJANGO_DIR="$(dirname "$0")/../django-backend"

# Check if django-ssh.sh exists
if [ ! -f "$DJANGO_SSH" ]; then
    echo -e "${RED}Error: django-ssh.sh not found at $DJANGO_SSH${NC}"
    exit 1
fi

# Check if local Django files exist
if [ ! -d "$LOCAL_DJANGO_DIR" ]; then
    echo -e "${RED}Error: Local Django files not found at $LOCAL_DJANGO_DIR${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 1: Backing up existing files on Django server...${NC}"
BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
$DJANGO_SSH "mkdir -p ${MEMBERSHIP_DIR}/backups/${BACKUP_TIMESTAMP}"

# Backup files that we'll modify
echo "Creating backups..."
$DJANGO_SSH "
    cd ${MEMBERSHIP_DIR}
    [ -f models.py ] && cp models.py backups/${BACKUP_TIMESTAMP}/models.py.backup
    [ -f urls.py ] && cp urls.py backups/${BACKUP_TIMESTAMP}/urls.py.backup
    [ -f admin.py ] && cp admin.py backups/${BACKUP_TIMESTAMP}/admin.py.backup
"

echo -e "\n${YELLOW}Step 2: Uploading new Django files...${NC}"

# Upload models_sync.py
echo "Uploading models_sync.py..."
cat "${LOCAL_DJANGO_DIR}/models_sync.py" | $DJANGO_SSH "cat > ${MEMBERSHIP_DIR}/models_sync.py"

# Upload signals.py
echo "Uploading signals.py..."
cat "${LOCAL_DJANGO_DIR}/signals.py" | $DJANGO_SSH "cat > ${MEMBERSHIP_DIR}/signals.py"

# Upload api_views_sync.py
echo "Uploading api_views_sync.py..."
cat "${LOCAL_DJANGO_DIR}/api_views_sync.py" | $DJANGO_SSH "cat > ${MEMBERSHIP_DIR}/api_views_sync.py"

# Upload admin_sync.py
echo "Uploading admin_sync.py..."
cat "${LOCAL_DJANGO_DIR}/admin_sync.py" | $DJANGO_SSH "cat > ${MEMBERSHIP_DIR}/admin_sync.py"

echo -e "\n${YELLOW}Step 3: Updating Django configuration files...${NC}"

# Add import for signals in __init__.py
echo "Updating __init__.py to load signals..."
$DJANGO_SSH "
    cd ${MEMBERSHIP_DIR}
    
    # Check if signals are already imported
    if ! grep -q 'from . import signals' __init__.py 2>/dev/null; then
        echo 'from . import signals  # Load signal handlers for bi-directional sync' >> __init__.py
        echo 'Added signals import to __init__.py'
    else
        echo 'Signals import already exists in __init__.py'
    fi
"

# Update urls.py to include sync endpoints
echo "Updating urls.py to include sync API endpoints..."
$DJANGO_SSH "
    cd ${MEMBERSHIP_DIR}
    
    # Check if sync URLs are already added
    if ! grep -q 'api_views_sync' urls.py; then
        # Create temporary file with updated imports and URLs
        cat > urls_temp.py << 'URLS_EOF'
from django.conf.urls import url, include
from django.contrib.auth import views as auth_views
from rest_framework.routers import DefaultRouter

from . import views
from .api_views_sync import (
    get_pending_changes,
    apply_firestore_changes,
    mark_changes_synced,
    sync_status
)

# Epic #43 REST API router
router = DefaultRouter()
router.register(r'full', views.ComradeFullViewSet, basename='comrade-full')

urlpatterns = [
    # Original URLs (keep all existing patterns)
    url(r'^skraning/lond/(?P<continent_id>[0-9]+)/', views.register_country),
    url(r'^skraning/landshlutar/', views.register_region),
    url(r'^skraning/erlendis/', views.register_foreign_address),
    url(r'^skraning/postnumer/(?P<region_id>[0-9]+)/', views.register_postal_code),
    url(r'^skraning/sveitarfelag/(?P<postal_code_id>[0-9]+)/', views.register_municipality),
    url(r'^skraning/gata/(?P<postal_code_id>[0-9]+)/(?P<municipality_id>[0-9]+)/', views.register_street),
    url(r'^skraning/sella/(?P<postal_code_id>[0-9]+)/', views.register_cell),
    url(r'^skraning/stadfang/(?P<street_id>[0-9]+)/', views.register_address),
    url(r'^skraning/', views.new_register),
    url(r'^api_skraning/', views.register_api),
    url(r'^endurheimt/', views.recovery),
    url(r'^stillingar/(?P<comrade_id>[0-9]+)/(?P<key>[\w]+)/frumstilla/', views.settings, {'initializing': True}),
    url(r'^stillingar/(?P<comrade_id>[0-9]+)/(?P<key>[\w]+)/', views.settings),
    url(r'^stillingar/', views.settings),
    url(r'^innskraning/', auth_views.LoginView.as_view(template_name='membership/login.html'), name=\"innskraning\"),
    
    # Issue #161: Foreign Address API
    url(r'^api/members/(?P<kennitala>[0-9]{10})/foreign-addresses/\$', 
        views.ForeignAddressViewSet.as_view({
            'get': 'list',
            'post': 'create'
        }), 
        name='foreign-address-list'),
    url(r'^api/members/(?P<kennitala>[0-9]{10})/foreign-addresses/(?P<pk>[0-9]+)/\$', 
        views.ForeignAddressViewSet.as_view({
            'get': 'retrieve',
            'patch': 'partial_update',
            'put': 'update'
        }), 
        name='foreign-address-detail'),
    
    # Epic #43: Full member data API
    url(r'^api/', include(router.urls)),
    
    # NEW: Bi-directional sync API
    url(r'^api/sync/changes/\$', get_pending_changes, name='sync_get_changes'),
    url(r'^api/sync/apply/\$', apply_firestore_changes, name='sync_apply_changes'),
    url(r'^api/sync/mark-synced/\$', mark_changes_synced, name='sync_mark_synced'),
    url(r'^api/sync/status/\$', sync_status, name='sync_status'),
]
URLS_EOF
        
        # Replace old urls.py with new one
        mv urls.py urls.py.backup-before-sync
        mv urls_temp.py urls.py
        echo 'Updated urls.py with sync API endpoints'
    else
        echo 'Sync API endpoints already exist in urls.py'
    fi
"

# Update admin.py to include sync admin
echo "Updating admin.py to include sync queue admin..."
$DJANGO_SSH "
    cd ${MEMBERSHIP_DIR}
    
    # Check if sync admin is already added
    if ! grep -q 'admin_sync' admin.py; then
        echo '' >> admin.py
        echo '# Bi-directional sync queue admin' >> admin.py
        echo 'from .admin_sync import MemberSyncQueueAdmin' >> admin.py
        echo 'Added sync admin to admin.py'
    else
        echo 'Sync admin already exists in admin.py'
    fi
"

echo -e "\n${YELLOW}Step 4: Running Django migrations...${NC}"

# Create migrations for new model
$DJANGO_SSH "
    cd ${DJANGO_PROJECT_DIR}
    source venv/bin/activate
    
    # Make migrations
    echo 'Creating migrations for MemberSyncQueue...'
    python manage.py makemigrations membership
    
    # Apply migrations
    echo 'Applying migrations...'
    python manage.py migrate
"

echo -e "\n${YELLOW}Step 5: Collecting static files...${NC}"
$DJANGO_SSH "
    cd ${DJANGO_PROJECT_DIR}
    source venv/bin/activate
    python manage.py collectstatic --noinput
"

echo -e "\n${YELLOW}Step 6: Restarting Django service...${NC}"
$DJANGO_SSH "
    # Restart gunicorn
    systemctl restart gunicorn
    
    # Wait for service to start
    sleep 3
    
    # Check service status
    systemctl status gunicorn --no-pager | head -20
"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Django deployment completed!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}Backup location on server:${NC}"
echo "${MEMBERSHIP_DIR}/backups/${BACKUP_TIMESTAMP}/"

echo -e "\n${BLUE}New API endpoints available:${NC}"
echo "- GET  https://starf.sosialistaflokkurinn.is/felagar/api/sync/changes/"
echo "- POST https://starf.sosialistaflokkurinn.is/felagar/api/sync/apply/"
echo "- POST https://starf.sosialistaflokkurinn.is/felagar/api/sync/mark-synced/"
echo "- GET  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/"

echo -e "\n${BLUE}Admin interface:${NC}"
echo "https://starf.sosialistaflokkurinn.is/admin/membership/membersyncqueue/"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Deploy Cloud Functions: ./deploy-cloud-functions.sh"
echo "2. Set up Cloud Scheduler: ./setup-scheduler.sh"
echo "3. Update frontend: Deploy member-profile.js changes"
