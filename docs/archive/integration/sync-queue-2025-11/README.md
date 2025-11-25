# Archived: Sync Queue Documentation (2025-11)

**Archived**: 2025-11-25
**Reason**: Queue-based sync replaced by real-time webhooks

## What Changed

The sync architecture was simplified from scheduled queue-based sync to instant real-time webhooks:

| Old (Queue-Based) | New (Real-Time) |
|-------------------|-----------------|
| `bidirectional_sync` function | `sync_from_django` webhook |
| `track_member_changes` trigger | Direct HTTP call from Django |
| `sync_queue` Firestore collection | No queue needed |
| Scheduled at 3:30 AM | Instant on save |
| `MemberSyncQueue` Django table | No queue table |

## Current Architecture

See: [CLOUD_RUN_SERVICES.md](../../../infrastructure/CLOUD_RUN_SERVICES.md)

## Archived Files

| File | Description |
|------|-------------|
| `BIDIRECTIONAL_SYNC.md` | Queue-based sync documentation |
| `BI_DIRECTIONAL_SYNC_DESIGN.md` | Original design document |
| `IMPLEMENTATION_STATUS.md` | Implementation tracking for queue system |
| `DEPLOYMENT_GUIDE.md` | Deployment guide for old functions |
