# Django → Ekklesia Migration Path

**Document Type**: Strategic Planning
**Last Updated**: 2025-10-15
**Status**: 📋 Planned - Multi-phase (2025-2026)
**Purpose**: Roadmap for migrating from Django legacy system to Ekklesia

---

## Executive Summary

This document outlines the **strategic migration path** from the legacy Django membership system to Ekklesia, the new e-democracy platform.

### Current State (Oct 2025)

- **Django**: Production system with 2,216 members, handles all member management
- **Ekklesia**: MVP in development, read-only member verification + voting

### Target State (Q2 2026)

- **Django**: Decommissioned
- **Ekklesia**: Full member management + voting platform (source of truth)

### Migration Strategy

**Phased approach** over 6-9 months, minimizing risk and maintaining service continuity.

---

## Migration Phases

### Phase 1-4: MVP Foundation ✅ (Oct-Nov 2025)

**Status**: In progress (PR#28, PR#34)

**Goal**: Establish Ekklesia as voting platform with read-only member verification

**Deliverables**:
- ✅ Members Service: Firebase + Kenni.is authentication
- ✅ Events Service: Token issuance (Cloud Run + PostgreSQL)
- ✅ Elections Service: Anonymous voting (Cloud Run + PostgreSQL)
- ✅ Security hardening: CSRF, idempotency, Firestore rules
- ⏸️ Manual member list upload (kennitalas.txt)

**Django Status**: Remains sole source of truth for member management

**Risk**: Low (Ekklesia is supplemental, Django unaffected)

**Timeline**: Oct-Nov 2025 (2 months)

---

### Phase 5: Automated Sync 📋 (Dec 2025)

**Status**: Planned

**Goal**: Eliminate manual member list export/upload process

**Deliverables**:
- Django REST API endpoint: `/api/members/kennitalas/`
- Cloud Function: `syncMemberList` (scheduled weekly)
- Cloud Scheduler: Monday 3 AM Iceland time
- Audit trail: Firestore `sync_audit` collection
- Monitoring: Alert on sync failures

**Django Status**: Still source of truth, Ekklesia reads from Django

**Risk**: Low (one-way sync, Django unaffected)

**Timeline**: Dec 2025 (2-3 weeks work)

**Documentation**: [DJANGO_SYNC_IMPLEMENTATION.md](DJANGO_SYNC_IMPLEMENTATION.md)

---

### Phase 6: Admin Panel - Read Operations (Q1 2026)

**Status**: Future planning

**Goal**: Allow administrators to view member data in Ekklesia

**Deliverables**:

#### 6.1: Admin UI (Ekklesia)
- Admin portal (Firebase Hosting)
- Member list view (search, filter, sort)
- Member detail view (profile, history, status)
- Authentication: Kenni.is + admin role check
- Authorization: Firestore rules (admin-only collections)

#### 6.2: Django API Extensions
- `GET /api/members/` - List members (paginated)
- `GET /api/members/{id}/` - Member detail
- `GET /api/members/{id}/history/` - Payment history, events
- Authentication: Token (shared with sync endpoint)

#### 6.3: Ekklesia Backend (Cloud Functions)
- `getMembers()` - Proxy to Django API
- `getMemberDetail()` - Proxy to Django API
- Cache: Firestore (optional, for performance)

**Django Status**: Source of truth, Ekklesia reads via API

**Risk**: Low (read-only, no data modification)

**Timeline**: Q1 2026 (4-6 weeks work)

**UI Mockup**:
```
┌─────────────────────────────────────────────────────────┐
│ Ekklesia Admin - Meðlimir                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Leita: [____________________] [Leita]                  │
│                                                         │
│ ┌────────┬──────────────┬──────────────┬─────────────┐ │
│ │ Nafn   │ Kennitala    │ Inngöngudags │ Staða       │ │
│ ├────────┼──────────────┼──────────────┼─────────────┤ │
│ │ Jón    │ 010190-2330  │ 2020-01-15   │ ✅ Virkur   │ │
│ │ Anna   │ 121285-4450  │ 2019-05-20   │ ✅ Virkur   │ │
│ │ Pétur  │ 050378-6590  │ 2021-03-10   │ ⚠️  Óvirkur │ │
│ └────────┴──────────────┴──────────────┴─────────────┘ │
│                                                         │
│ Síða 1 af 45 [<] [>]                                   │
└─────────────────────────────────────────────────────────┘
```

---

### Phase 7: Admin Panel - Write Operations (Q1-Q2 2026)

**Status**: Future planning

**Goal**: Allow administrators to create/edit/delete members in Ekklesia

**Deliverables**:

#### 7.1: Django API Extensions (Write)
- `POST /api/members/` - Create member
- `PATCH /api/members/{id}/` - Update member
- `DELETE /api/members/{id}/` - Soft delete member
- Validation: Kennitala format, required fields
- Permissions: Admin token required

#### 7.2: Ekklesia Admin UI (Forms)
- Add member form (name, kennitala, contact info)
- Edit member form (profile updates)
- Delete confirmation dialog
- Form validation (client + server)

#### 7.3: Ekklesia Backend (Write Operations)
- `createMember()` - POST to Django API
- `updateMember()` - PATCH to Django API
- `deleteMember()` - DELETE from Django API
- Error handling: Display Django validation errors
- Audit logging: Track admin actions

#### 7.4: Two-Way Sync (Critical!)
- Weekly sync continues (Django → Ekklesia)
- Ekklesia writes to Django immediately (real-time)
- Conflict resolution: Django wins (Ekklesia is proxy)

**Django Status**: Still source of truth, Ekklesia writes to Django

**Risk**: Medium (data modification, potential conflicts)

**Mitigation**:
- Admin training: Use Ekklesia OR Django, not both simultaneously
- Conflict detection: Check Django timestamp before update
- Rollback: Django database backups
- Audit trail: Log all admin actions (Firestore + Django)

**Timeline**: Q1-Q2 2026 (6-8 weeks work)

**UI Mockup (Add Member)**:
```
┌─────────────────────────────────────────────────────────┐
│ Ekklesia Admin - Bæta við meðlim                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Nafn: [_________________________________]               │
│                                                         │
│ Kennitala: [______-____]                               │
│                                                         │
│ Netfang: [_________________________________]            │
│                                                         │
│ Sími: [_______]                                        │
│                                                         │
│ Stéttarfélag: [▼ Veldu stéttarfélag]                  │
│                                                         │
│ [Hætta við] [Vista]                                    │
└─────────────────────────────────────────────────────────┘
```

---

### Phase 8: Full Data Migration (Q2 2026)

**Status**: Future planning

**Goal**: Migrate all data from Django → Firestore, make Ekklesia source of truth

**Deliverables**:

#### 8.1: Data Migration Script
```javascript
// functions/migrate-django-to-firestore.js

const admin = require('firebase-admin');
const fetch = require('node-fetch');

async function migrateMembers() {
  // Fetch all members from Django API (with full profiles)
  const response = await fetch('http://172.105.71.207/api/members/?limit=10000');
  const members = await response.json();

  const batch = admin.firestore().batch();

  for (const member of members) {
    const docRef = admin.firestore().collection('members').doc(member.ssn);

    batch.set(docRef, {
      kennitala: member.ssn,
      name: member.name,
      birthday: member.birthday,
      dateJoined: member.date_joined,
      email: member.email,
      phone: member.phone,
      address: member.address,
      unionMemberships: member.unions,
      titles: member.titles,
      // Preserve Django ID for reference
      djangoId: member.id,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(`Migrated ${members.length} members to Firestore`);
}
```

#### 8.2: Data Validation
- Compare Django record count vs Firestore count
- Verify all required fields migrated
- Check for duplicates (should be none)
- Validate kennitala format
- Test random sample (manual verification)

#### 8.3: Payment History Migration
- Export payment records from Django
- Import to Firestore `payments` collection
- Link to member records (kennitala)
- Preserve historical data (years, amounts, dates)

#### 8.4: Email List Migration
- Export email subscriptions from Django
- Import to Firestore `email_lists` collection
- Link to member records
- Preserve subscription preferences

**Django Status**: Backup/archive only (read-only)

**Risk**: High (data migration always risky)

**Mitigation**:
- **Backup Django database** before migration
- **Parallel run**: Keep Django online for 1 month (fallback)
- **Incremental migration**: Test with 10 members, then 100, then all
- **Data validation**: Automated checks + manual spot checks
- **Rollback plan**: Restore Django if critical issues found

**Timeline**: Q2 2026 (4-6 weeks work + 1 month parallel run)

**Validation Checklist**:
- [ ] Member count matches (Django vs Firestore)
- [ ] All kennitalas migrated
- [ ] Payment history complete (last 5 years)
- [ ] Email subscriptions preserved
- [ ] No duplicate records
- [ ] Admin panel works with Firestore data
- [ ] Voting system works with Firestore data
- [ ] Performance acceptable (<500ms query times)

---

### Phase 9: Payment Integration (Q2-Q3 2026)

**Status**: Future planning

**Goal**: Replace Django payment tracking with Ekklesia system

**Deliverables**:

#### 9.1: Payment Tracking (Ekklesia)
- Payment record form (admin panel)
- Payment status display (member profile)
- Payment reminders (email notifications)
- Payment history (timeline view)

#### 9.2: Bank Integration (Optional)
- API integration with Icelandic bank (Landsbankinn, Íslandsbanki, etc.)
- Automatic payment detection (match kennitala → member)
- Payment import (CSV/API)

#### 9.3: Accounting Export
- Export to accounting software (Navision, Dynamics, etc.)
- CSV format for manual import
- Monthly reports (paid/unpaid members)

**Django Status**: Decommission payment module

**Risk**: Medium (financial data sensitive)

**Mitigation**:
- Keep Django database backup (5 years)
- Manual verification for first 3 months
- Accountant approval before cutover

**Timeline**: Q2-Q3 2026 (6-8 weeks work)

---

### Phase 10: Django Decommissioning (Q3 2026)

**Status**: Future planning

**Goal**: Shut down Django system, Ekklesia is sole source of truth

**Deliverables**:

#### 10.1: Final Data Sync
- Export final snapshot from Django
- Compare with Firestore (ensure parity)
- Archive Django database (PostgreSQL dump)

#### 10.2: DNS/URL Migration
- Redirect old URLs: `old-system.example.com` → `ekklesia-prod-10-2025.web.app`
- Update bookmarks, documentation
- Notify administrators of new URLs

#### 10.3: Archive Django Codebase
- Git repository: Archive to `django-legacy-2026` repo
- Documentation: Save all admin guides, setup docs
- Database dump: Store in secure cloud storage (encrypted)
- Retention: Keep for 7 years (legal requirement)

#### 10.4: Linode Server Shutdown
- Cancel Linode subscription
- Download final backups
- Verify backups are accessible

**Django Status**: ❌ Decommissioned

**Risk**: Low (all data migrated, validated)

**Cost Savings**: $20-30/month ($240-360/year)

**Timeline**: Q3 2026 (2-3 weeks work)

---

## Risk Matrix

| Phase | Risk Level | Impact if Failed | Mitigation |
|-------|-----------|------------------|------------|
| 1-4: MVP | Low | Ekklesia unavailable (Django unaffected) | Rollback to manual voting |
| 5: Sync | Low | Manual export required | Resume manual process |
| 6: Read Admin | Low | Admins use Django instead | No data loss |
| 7: Write Admin | Medium | Data corruption possible | Backups, audit trail, conflict detection |
| 8: Migration | High | Data loss or corruption | Incremental migration, parallel run, backups |
| 9: Payments | Medium | Payment tracking errors | Manual verification, Django backup |
| 10: Decommission | Low | Need to restore Django | Keep backups for 7 years |

---

## Rollback Plans

### Phase 5-7: Before Full Migration

**If issues arise**:
1. Disable Ekklesia admin panel (set feature flag)
2. Resume using Django for admin tasks
3. Keep weekly sync running (Django → Ekklesia)
4. Fix Ekklesia issues offline
5. Re-enable when stable

**Data safety**: Django is still source of truth, no data loss

### Phase 8: During Migration

**If validation fails**:
1. Stop migration script immediately
2. Delete partial Firestore data
3. Keep Django as source of truth
4. Investigate issues (missing fields, validation errors)
5. Fix migration script
6. Re-run migration

**Data safety**: Django database unchanged (backup exists)

### Phase 8: After Migration (Parallel Run)

**If critical issues found**:
1. Announce to admins: "Switch back to Django immediately"
2. Update DNS: Point back to Django URLs
3. Disable Ekklesia admin panel
4. Investigate issues (data discrepancies, bugs)
5. Fix Ekklesia
6. Re-migrate when ready

**Data safety**: Django still online (1 month parallel run)

### Phase 10: After Django Decommissioned

**If need Django data**:
1. Restore Linode server from backup (or new server)
2. Import PostgreSQL dump
3. Run Django in read-only mode
4. Extract needed data
5. Import to Ekklesia

**Data safety**: PostgreSQL dump + code archive (7 year retention)

---

## Success Criteria

### Phase 5: Automated Sync
- ✅ Weekly sync runs successfully (4+ consecutive weeks)
- ✅ Member count matches Django database
- ✅ No manual intervention required
- ✅ Audit trail logs all syncs

### Phase 6: Read Admin Panel
- ✅ Admins can view member list
- ✅ Admins can search/filter members
- ✅ Member detail view shows complete profile
- ✅ Performance acceptable (<2 sec page load)

### Phase 7: Write Admin Panel
- ✅ Admins can add new members
- ✅ Admins can edit existing members
- ✅ Django database reflects changes immediately
- ✅ No data conflicts after 1 month testing
- ✅ Audit trail logs all admin actions

### Phase 8: Full Migration
- ✅ All members migrated (2,216 → Firestore)
- ✅ Payment history complete (5 years)
- ✅ Email subscriptions preserved
- ✅ Validation passes (automated + manual checks)
- ✅ Admin panel works with Firestore data
- ✅ Voting system works with Firestore data
- ✅ Parallel run successful (1 month, no issues)

### Phase 9: Payment Integration
- ✅ Admins can record payments
- ✅ Payment status visible on member profiles
- ✅ Accounting export works
- ✅ No payment tracking errors (3 months)

### Phase 10: Decommissioning
- ✅ Django database archived (PostgreSQL dump)
- ✅ Django code archived (git repo)
- ✅ Linode server shut down
- ✅ Cost savings realized ($20-30/month)
- ✅ Ekklesia sole source of truth

---

## Resource Requirements

### Development Time

| Phase | Estimated Effort | Notes |
|-------|------------------|-------|
| 1-4: MVP | 2 months | In progress |
| 5: Sync | 2-3 weeks | Django API + Cloud Function |
| 6: Read Admin | 4-6 weeks | UI + API integration |
| 7: Write Admin | 6-8 weeks | Forms + validation + two-way sync |
| 8: Migration | 4-6 weeks | Script + validation + parallel run |
| 9: Payments | 6-8 weeks | Payment tracking + bank integration |
| 10: Decommission | 2-3 weeks | Archive + shutdown |
| **Total** | **6-9 months** | Oct 2025 - Q3 2026 |

### Technical Skills Required

- **Firebase**: Firestore, Storage, Authentication, Cloud Functions
- **GCP**: Cloud Run, Cloud SQL, Secret Manager, Cloud Scheduler
- **Django**: REST API development, PostgreSQL
- **Frontend**: HTML/CSS/JS (admin panel UI)
- **Data Migration**: SQL, scripting, validation

### Infrastructure Costs

| Phase | Additional Cost | Notes |
|-------|----------------|-------|
| 1-5 | $0.16/month | Cloud Scheduler + Secret Manager |
| 6-7 | $1-2/month | Increased Cloud Function usage |
| 8 | $0 | One-time migration (no recurring) |
| 9 | $0-5/month | Depends on bank API costs |
| 10 | -$20-30/month | **Savings** (Linode eliminated) |
| **Net** | **-$15-25/month** | **$180-300/year savings** |

---

## Dependencies & Assumptions

### External Dependencies
- **Django server uptime**: Must remain online through Phase 8
- **Linode backups**: Must be functional (recovery plan)
- **Bank API availability**: Required for Phase 9 (if automated)

### Assumptions
- Django database schema remains stable (no major changes)
- Admin users can be trained on new UI (Ekklesia)
- Firestore can handle member data volume (2,000-3,000 members)
- No major Ekklesia architecture changes during migration

### Risks to Timeline
- **Django API issues**: Legacy code hard to modify
- **Data quality**: Duplicates, invalid kennitalas in Django
- **Stakeholder availability**: Admin testing, approval delays
- **Scope creep**: New feature requests during migration

---

## Communication Plan

### Stakeholder Updates

**Frequency**: Monthly status report

**Recipients**:
- Party leadership
- System administrators
- Accountant (financial data)

**Content**:
- Phase progress (completed, in-progress, upcoming)
- Risks and issues
- Timeline adjustments
- Action items

### Admin Training

**Phase 6-7**: Admin panel introduction
- Training session: 1 hour (live demo)
- User guide: Written documentation
- Support: Email/phone for first month

**Phase 8**: Migration cutover
- Announcement: 1 week notice
- Training: Django → Ekklesia differences
- Support: On-call for first week

---

## Related Documentation

- [docs/legacy/DJANGO_LEGACY_SYSTEM.md](../legacy/DJANGO_LEGACY_SYSTEM.md) - Django system details
- [docs/integration/DJANGO_SYNC_IMPLEMENTATION.md](DJANGO_SYNC_IMPLEMENTATION.md) - Phase 5 sync implementation
- [docs/status/CURRENT_PRODUCTION_STATUS.md](../status/CURRENT_PRODUCTION_STATUS.md) - Ekklesia current state

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-10-15 | Initial migration roadmap | Claude |
| 2025-10-15 | Added Phases 1-10 detailed plans | Claude |
| 2025-10-15 | Added risk matrix and rollback plans | Claude |

---

**Last Updated**: 2025-10-15
**Status**: 📋 Strategic roadmap (Oct 2025 - Q3 2026)
**Next Review**: After Phase 5 completion (Dec 2025)
