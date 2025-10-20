# Django Legacy System Documentation

**Document Type**: Legacy System Reference
**Last Updated**: 2025-10-15
**Status**: 🟢 Active - Production System (Source of Truth)
**Purpose**: Document existing Django membership system on Linode

---

## Overview

The legacy Django system (`sfi_felagakerfi_live`) is the **current source of truth** for Sósíalistaflokkur Íslands's member registry. It runs on a Linode server and manages:

- Member registration and profiles
- Membership status tracking
- Email lists and communication
- Membership fee payments
- Administrative tools

**Critical**: This system is **still in production** and will remain so until Ekklesia achieves feature parity and completes full data migration (estimated Q2 2026).

---

## System Access

### Server Details

- **Server Name**: `sfi_felagakerfi_live`
- **IP Address**: 172.105.71.207
- **OS**: Ubuntu 18.04 LTS
- **SSH Access**: `ssh root@172.105.71.207`
- **Lish Console**: `ssh -t gudrodur@lish-eu-central.linode.com sfi_felagakerfi_live`

### Application Details

- **Location**: `/home/manager/socialism/`
- **Python**: Python 3.6 (virtualenv at `venv/`)
- **Django Version**: Unknown (legacy, not updated in years)
- **Web Server**: Unknown (likely Gunicorn/uWSGI + Nginx)
- **User**: `manager` (owns Django files)

### Database

- **Type**: PostgreSQL
- **Database Name**: `socialism`
- **User**: `socialism`
- **Password**: `[PASSWORD_IN_SETTINGS]` (stored in Django settings)
- **Authentication**: Peer authentication (Unix socket)
- **Access**: `sudo -u postgres psql socialism`

---

## Database Schema

### Member Data (`membership_comrade` table)

**Total Members**: 2,216 (as of Oct 15, 2025)

**Key Fields**:
```python
class Comrade(models.Model):
    name = models.CharField(max_length=250)                    # Nafn
    ssn = models.CharField(max_length=10)                      # Kennitala (10 digits, no hyphen)
    birthday = models.DateField(null=True)                     # Fæðingardagur
    date_joined = models.DateTimeField()                       # Dagsetning inngöngu
    reachable = models.BooleanField(default=True)              # Samband allowed
    groupable = models.BooleanField(default=True)              # Málefnahóp allowed
    housing_situation = models.IntegerField(null=True)         # Húsnæðisstaða
    gender = models.IntegerField(null=True)                    # Kyn
    union_memberships = models.ManyToManyField('Union')        # Stéttarfélög
    titles = models.ManyToManyField('Title')                   # Starfsheiti
    emails = models.ManyToManyField('Email')                   # Tölvupóstar
    groups = models.ManyToManyField('ComradeGroup')            # Félagahópar
```

**Important Notes**:
- `ssn` field stores kennitala in **10-digit format** (e.g., `0101012980`, no hyphen)
- This differs from Ekklesia's normalized format (`DDMMYY-XXXX`)
- All records in `membership_comrade` are considered active members (no "inactive" flag)

### Related Tables

- `membership_union` - Unions (stéttarfélög)
- `membership_title` - Titles (starfsheiti)
- `membership_unionmembership` - M2M: Comrade ↔ Union
- `membership_comradetitle` - M2M: Comrade ↔ Title
- `communication_email` - Emails sent
- `groups_comradegroup` - Member groups

---

## Django Application Structure

### Apps

```
/home/manager/socialism/
├── membership/          # Core member management
│   ├── models.py        # Comrade, Union, Title models
│   ├── views.py         # Registration, settings
│   ├── serializers.py   # REST framework serializers
│   ├── urls.py          # Membership URLs
│   └── forms.py         # Registration forms
├── communication/       # Email system
├── elections/           # Legacy elections (separate from Ekklesia)
├── cells/               # Local cells/chapters
├── groups/              # Member groups
├── action/              # Actions/campaigns
├── issues/              # Political issues
├── economy/             # Financial management
├── map/                 # Geographic mapping
├── rsk/                 # Tax/accounting
├── web/                 # Public website
└── socialism/           # Main project settings
    ├── settings.py      # Django configuration
    └── urls.py          # Root URL configuration
```

### REST Framework Setup

**Status**: ✅ Installed and configured

```python
# socialism/settings.py
INSTALLED_APPS = [
    ...
    'rest_framework',
    'rest_framework.authtoken',
    ...
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
}
```

**Existing ViewSets**:
- `UnionViewSet` - Union CRUD
- `TitleViewSet` - Title CRUD

**Existing Serializers**:
- `ComradeSerializer` - Member serialization (does NOT include `ssn` field)
- `UnionSerializer` - Union serialization
- `TitleSerializer` - Title serialization

---

## Current Functionality

### Member Registration

**URL**: `/skraning/` (public registration form)
**API**: `/api_skraning/` (POST endpoint for registration)

**Process**:
1. User fills registration form with:
   - Name, kennitala, birthday
   - Address (local or foreign)
   - Union membership
   - Contact preferences
2. Django creates:
   - `Comrade` record
   - `User` record (Django auth)
   - Address records
   - Union membership links
3. Account activation email sent

### Member Management (Admin)

**URL**: `/stillingar/` (requires authentication)

**Features**:
- Update profile information
- Manage union memberships
- Update contact preferences
- Change password

### Data Export (Current Method)

**Django Shell**:
```bash
cd /home/manager/socialism
sudo -u manager venv/bin/python manage.py shell
```

```python
from membership.models import Comrade

# Export all kennitalas
kennitalas = Comrade.objects.all().values_list('ssn', flat=True).order_by('ssn')
for kt in kennitalas:
    print(kt)
```

**Manual Process** (currently used):
1. SSH to server
2. Run Django shell command
3. Redirect output to file
4. Download file
5. Upload to Firebase Storage (`kennitalas.txt`)

---

## Data Comparison: Django vs Ekklesia

### Current State (Oct 15, 2025)

| Source | Member Count | Format | Location |
|--------|--------------|--------|----------|
| **Django (Linode)** | 2,216 | 10 digits (no hyphen) | PostgreSQL `membership_comrade` |
| **Ekklesia (Firebase)** | 2,273 (last upload) | 10 digits (no hyphen) | `gs://.../kennitalas.txt` |

**Discrepancy**: 57 members difference

**Possible Reasons**:
1. Firebase data is from older export (includes members who left)
2. Django has newer data (recent departures not in Firebase)
3. Data cleaning happened in Django (duplicates removed)

**Recommendation**: Upload fresh Django export to Firebase Storage to sync current state.

---

## Integration Challenges

### Why Ekklesia Cannot Replace Django Yet

**Missing Features** (as of Oct 2025):
1. ❌ **Admin Panel**: No UI for administrators to add/remove members
2. ❌ **Payment Integration**: No membership fee tracking
3. ❌ **Email System**: No email list management
4. ❌ **Full CRUD**: Ekklesia is read-only (verification only)
5. ❌ **Data Migration**: No automated migration from Django DB → Firestore

**What Ekklesia Has**:
1. ✅ **Authentication**: Kenni.is national eID
2. ✅ **Membership Verification**: Check if kennitala is in registry
3. ✅ **Voting**: Issue voting tokens for elections
4. ✅ **User Profiles**: Store basic user data in Firestore

**Timeline to Feature Parity**: Estimated Q1-Q2 2026 (Phases 6-8)

---

## Recommended Migration Strategy

### Phase 1-4: MVP (Oct-Nov 2025) ✅

**Status**: Current work (PR#28, PR#34)

- Ekklesia is **read-only** (authentication + voting only)
- Django remains **source of truth** (all member management)
- **Manual sync**: Export Django → upload kennitalas.txt

### Phase 5: Automated Sync (Dec 2025)

**Goal**: Eliminate manual export/upload process

**Implementation**:
1. Create Django REST API endpoint: `/api/members/kennitalas/`
2. Create Cloud Function: `syncMemberList` (scheduled weekly)
3. Deploy Cloud Scheduler: Monday 3 AM Iceland time
4. Audit trail: Log syncs to Firestore

**Documentation**: [docs/integration/DJANGO_SYNC_IMPLEMENTATION.md](../integration/DJANGO_SYNC_IMPLEMENTATION.md)

**Effort**: 15-30 minutes Django work + 1 hour Cloud Function work

### Phase 6-7: Two-Way Sync (Q1 2026)

**Goal**: Allow Ekklesia admin panel to write back to Django

**Features**:
- Admin panel in Ekklesia (add/remove members)
- Ekklesia writes to Django via API (create `Comrade` records)
- Django → Ekklesia sync continues (weekly)
- Both systems remain active (hybrid period)

**Risk**: Data conflicts if both systems modified simultaneously

**Mitigation**:
- Django remains primary (Ekklesia writes to Django, not Firestore)
- Conflict resolution rules (Django wins)
- Admin training (use one system at a time)

### Phase 8+: Full Migration (Q2 2026)

**Goal**: Ekklesia becomes sole source of truth, decommission Django

**Steps**:
1. **Data Migration**: Move all Django data to Firestore
   - Members: Django DB → Firestore `users` collection
   - History: Preserve join dates, payment history
   - Groups: Migrate member groups and affiliations
2. **Feature Parity**: Implement all Django features in Ekklesia
   - Admin panel (full CRUD)
   - Payment tracking
   - Email integration
3. **Payment Integration**: Connect to accounting system
4. **Testing**: Parallel run (Django + Ekklesia) for 1 month
5. **Cutover**: Switch production traffic to Ekklesia
6. **Decommission**: Archive Django DB, shut down Linode server

**Timeline**: 2-3 months work (Q2 2026)

**Cost Savings**: $20-30/month (Linode server eliminated)

---

## Security Considerations

### Current Django Security

**Authentication**:
- Django session-based authentication (cookies)
- Password hashing: Django default (PBKDF2)
- HTTPS: Unknown (check Nginx config)

**Authorization**:
- Django permissions system
- Admin users have full access
- Regular users can only edit own profile

**Sensitive Data**:
- Kennitalas stored in plaintext (PostgreSQL `ssn` field)
- No encryption at rest (standard PostgreSQL)
- Backups: Unknown

### Ekklesia Security Improvements

**Authentication**:
- National eID (Kenni.is) - stronger than passwords
- No password storage (delegated to government IdP)
- Firebase custom tokens (short-lived)

**Authorization**:
- Firestore security rules (granular access control)
- Role-based access (member, admin, super-admin)

**Data Protection**:
- Kennitalas in Firebase Auth claims (not in Firestore)
- No PII in Elections service (anonymous voting)
- Audit logging (Cloud Logging)

**Improvement**: Ekklesia is more secure (national eID + granular rules)

---

## Monitoring & Maintenance

### Django System Health

**Check Service Status**:
```bash
ssh root@172.105.71.207
ps aux | grep -E "python|django|gunicorn"
```

**Check Database**:
```bash
sudo -u postgres psql socialism -c "SELECT COUNT(*) FROM membership_comrade;"
```

**Check Logs**:
- Location: Unknown (likely `/var/log/socialism/` or `/var/log/nginx/`)
- Django logs: Check Django settings for `LOGGING` configuration

### Common Issues

**Issue**: Database connection errors
**Solution**: Restart PostgreSQL (`systemctl restart postgresql`)

**Issue**: Django app not responding
**Solution**: Restart web server (Gunicorn/uWSGI)

**Issue**: Disk space full
**Solution**: Clean up old logs, media files

---

## Technical Debt

### Known Issues (Legacy System)

1. **Python 3.6**: End of life (Dec 2021) - security risk
2. **Ubuntu 18.04**: End of standard support (April 2023) - security risk
3. **No Automated Backups**: Database backups not verified
4. **No Monitoring**: No uptime monitoring, no alerting
5. **No Version Control**: Django code changes not tracked in git
6. **Hard-coded Secrets**: Database password in settings.py (plaintext)
7. **No Tests**: No automated testing for Django app
8. **No Documentation**: No API docs, no admin guides

### Risks

**High Risk**:
- Server compromise (outdated OS + Python)
- Data loss (no verified backups)
- Service outage (no monitoring)

**Medium Risk**:
- Code changes without version control
- Admin errors (no rollback mechanism)

**Low Risk**:
- Performance issues (small user base, low traffic)

### Recommendations

**Short-term** (while Django is still primary):
1. ✅ Set up automated database backups (Linode backups)
2. ✅ Set up uptime monitoring (Pingdom, UptimeRobot)
3. ⚠️ Upgrade to Python 3.10+ and Ubuntu 22.04 (security)
4. ⚠️ Move secrets to environment variables

**Long-term**:
- ✅ Migrate to Ekklesia (eliminate technical debt entirely)
- ✅ Decommission Linode server (Q2 2026)

---

## Resources

### SSH Commands Reference

```bash
# Connect to server
ssh root@172.105.71.207

# Connect via Lish console (if SSH fails)
ssh -t gudrodur@lish-eu-central.linode.com sfi_felagakerfi_live

# Access Django shell
cd /home/manager/socialism
sudo -u manager venv/bin/python manage.py shell

# Access database
sudo -u postgres psql socialism

# Check member count
sudo -u postgres psql socialism -c "SELECT COUNT(*) FROM membership_comrade;"

# Export kennitalas
cd /home/manager/socialism
sudo -u manager venv/bin/python manage.py shell <<'EOF'
from membership.models import Comrade
kennitalas = Comrade.objects.all().values_list('ssn', flat=True).order_by('ssn')
for kt in kennitalas:
    print(kt)
EOF
```

### Django Management Commands

```bash
# Run migrations
sudo -u manager venv/bin/python manage.py migrate

# Create superuser
sudo -u manager venv/bin/python manage.py createsuperuser

# Collect static files
sudo -u manager venv/bin/python manage.py collectstatic

# Run development server (DO NOT USE IN PRODUCTION)
sudo -u manager venv/bin/python manage.py runserver
```

---

## Related Documentation

- [docs/integration/DJANGO_SYNC_IMPLEMENTATION.md](../integration/DJANGO_SYNC_IMPLEMENTATION.md) - Weekly sync implementation
- [docs/status/CURRENT_PRODUCTION_STATUS.md](../status/CURRENT_PRODUCTION_STATUS.md) - Ekklesia production status
- [docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](../SYSTEM_ARCHITECTURE_OVERVIEW.md) - Ekklesia architecture

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-10-15 | Initial documentation of Django system | Claude |
| 2025-10-15 | Added database schema, SSH access details | Claude |
| 2025-10-15 | Documented migration strategy (Phases 5-8) | Claude |

---

**Last Updated**: 2025-10-15
**Status**: 🟢 Django system is production (2,216 active members)
**Next Review**: After Phase 5 sync implementation (Dec 2025)
