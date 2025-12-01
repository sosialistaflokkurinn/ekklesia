# Firestore Schema Documentation

**Database**: Cloud Firestore
**Project**: ekklesia-prod-10-2025
**Region**: Multi-region (default)
**Last Updated**: November 25, 2025

## 🎯 Overview

Firestore serves as the primary database for the Ekklesia member portal. It stores:

- Member profiles and contact information
- Sync logs for audit trail
- Session data for authentication

**Key Collections:**
1. `/members/` - Member profiles
2. ~~`/sync_queue/`~~ - ⚠️ **DEPRECATED** - No longer used (real-time sync)
3. `/sync_logs/` - Sync operation history

## 📦 Collection: /members/

### Overview

**Purpose**: Store member profile data accessible from the Ekklesia portal

**Document ID**: Kennitala without hyphen (e.g., `1234567890`)

**Indexes**: 
- `membership.status` (single field)
- `profile.email` (single field)
- Composite: `membership.status`, `profile.name` (ascending)

### Document Structure

```typescript
{
  // Profile Information
  profile: {
    name: string,                    // Full name
    kennitala: string,               // With hyphen: "123456-7890"
    email: string,                   // Primary email
    phone: string,                   // Phone number
    birthday: string,                // ISO date: "1990-01-15"
    gender: enum,                    // "male" | "female" | "other" | "unknown"
    housing_situation: enum,         // See Housing Situation enum below
    
    address: {
      street: string,                // Street address
      postalcode: string,            // Postal code
      city: string,                  // City name
      country: string                // Default: "Iceland"
    }
  },
  
  // Membership Information
  membership: {
    status: enum,                    // "active" | "inactive" | "pending"
    joined_date: string,             // ISO date: "2020-01-15"
    membership_type: string,         // "full" | "supporter"
    member_number: string,           // Unique member ID
    branch: string                   // Branch name or ID
  },
  
  // Privacy Settings
  privacy: {
    reachable: boolean,              // Can be contacted
    groupable: boolean,              // Can join working groups
    public_profile: boolean,         // Profile visible to others
    newsletter: boolean              // Receive newsletter
  },
  
  // Metadata
  metadata: {
    created_at: Timestamp,           // Document creation
    updated_at: Timestamp,           // Last update
    last_synced: Timestamp,          // Last sync with Django
    source: string,                  // "django" | "portal"
    version: number,                 // Schema version
    deleted_at: Timestamp | null     // Soft delete timestamp
  }
}
```

### Field Details

#### profile.gender

**Type**: Enum (string)

**Values**:
- `"unknown"` - Not specified
- `"male"` - Male
- `"female"` - Female  
- `"other"` - Non-binary/other

**Django Mapping**: Integer (0-3)
```python
0 → "unknown"
1 → "male"
2 → "female"
3 → "other"
```

#### profile.housing_situation

**Type**: Enum (string)

**Values**:
- `"unknown"` - Not specified
- `"owner"` - Home owner
- `"rental"` - Renting
- `"cooperative"` - Housing cooperative
- `"family"` - Living with family
- `"other"` - Other arrangement
- `"homeless"` - Without housing

**Django Mapping**: Integer (0-6)
```python
0 → "unknown"
1 → "owner"
2 → "rental"
3 → "cooperative"
4 → "family"
5 → "other"
6 → "homeless"
```

#### membership.status

**Type**: Enum (string)

**Values**:
- `"active"` - Active member with full rights
- `"inactive"` - Former member or suspended
- `"pending"` - Membership application pending

**Queries**:
```javascript
// Get all active members
db.collection('members')
  .where('membership.status', '==', 'active')
  .get()

// Get inactive members
db.collection('members')
  .where('membership.status', '==', 'inactive')
  .get()
```

### Example Document

```json
{
  "profile": {
    "name": "Jón Jónsson",
    "kennitala": "010190-3456",
    "email": "jon@example.com",
    "phone": "+3545551234",
    "birthday": "1990-01-01",
    "gender": "male",
    "housing_situation": "rental",
    "address": {
      "street": "Laugavegur 1",
      "postalcode": "101",
      "city": "Reykjavík",
      "country": "Iceland"
    }
  },
  "membership": {
    "status": "active",
    "joined_date": "2020-01-15",
    "membership_type": "full",
    "member_number": "M2020-001",
    "branch": "Reykjavík"
  },
  "privacy": {
    "reachable": true,
    "groupable": true,
    "public_profile": false,
    "newsletter": true
  },
  "metadata": {
    "created_at": "2020-01-15T10:30:00Z",
    "updated_at": "2025-11-05T12:15:00Z",
    "last_synced": "2025-11-05T03:30:00Z",
    "source": "django",
    "version": 2,
    "deleted_at": null
  }
}
```

### Queries

#### Get Member by Kennitala

```javascript
const kennitala = '0101903456'; // Without hyphen
const memberDoc = await db.collection('members').doc(kennitala).get();

if (memberDoc.exists) {
  const member = memberDoc.data();
  console.log(member.profile.name);
}
```

#### Search by Email

```javascript
const snapshot = await db.collection('members')
  .where('profile.email', '==', 'jon@example.com')
  .get();

snapshot.forEach(doc => {
  console.log(doc.id, doc.data());
});
```

#### Get Active Members

```javascript
const activeMembers = await db.collection('members')
  .where('membership.status', '==', 'active')
  .orderBy('profile.name', 'asc')
  .get();

console.log(`Total active: ${activeMembers.size}`);
```

#### Get Recently Updated

```javascript
const recentUpdates = await db.collection('members')
  .where('membership.status', '==', 'active')
  .orderBy('metadata.updated_at', 'desc')
  .limit(10)
  .get();
```

### Validation Rules

**Required Fields**:
- `profile.name`
- `profile.kennitala`
- `membership.status`

**Field Constraints**:
```javascript
// Kennitala format: DDMMYY-XXXX
const kennitalaPatter = /^\d{6}-?\d{4}$/;

// Email format
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone format (Iceland)
const phonePattern = /^\+354\d{7}$/;
```

## ~~📦 Collection: /sync_queue/~~ (DEPRECATED)

> ⚠️ **DEPRECATED (2025-11-25)**: This collection is no longer used.
> Real-time sync via `sync_from_django` and `updatememberprofile` Cloud Functions
> has replaced the queue-based approach. Changes sync instantly.
>
> **See:** [CLOUD_RUN_SERVICES.md](../infrastructure/CLOUD_RUN_SERVICES.md)

### ~~Overview~~

~~**Purpose**: Track pending changes from Firestore portal edits that need to sync to Django~~

~~**Document ID**: Auto-generated by Firestore~~

**Indexes**:
- `sync_status` (single field)
- Composite: `sync_status`, `created_at` (ascending)

### Document Structure

```typescript
{
  kennitala: string,               // Member kennitala (with hyphen)
  action: enum,                    // "update" | "create" | "delete"
  changes: {
    [field: string]: {
      old_value: any,              // Previous value
      new_value: any               // New value
    }
  },
  sync_status: enum,               // "pending" | "synced" | "failed"
  created_at: Timestamp,           // When change was queued
  synced_at: Timestamp | null,     // When successfully synced
  error_message: string | null,    // Error if sync failed
  retry_count: number,             // Number of retry attempts
  source: string                   // "portal" | "admin"
}
```

### Field Details

#### action

**Type**: Enum (string)

**Values**:
- `"update"` - Member field(s) updated
- `"create"` - New member created
- `"delete"` - Member deleted/deactivated

#### sync_status

**Type**: Enum (string)

**Values**:
- `"pending"` - Waiting to be synced
- `"synced"` - Successfully synced to Django
- `"failed"` - Sync failed (see error_message)

#### changes

**Type**: Object (map of field paths)

**Structure**:
```javascript
{
  "profile.email": {
    "old_value": "old@example.com",
    "new_value": "new@example.com"
  },
  "profile.phone": {
    "old_value": "+3545551111",
    "new_value": "+3545552222"
  }
}
```

### Example Document

```json
{
  "kennitala": "010190-3456",
  "action": "update",
  "changes": {
    "profile.email": {
      "old_value": "jon.old@example.com",
      "new_value": "jon.new@example.com"
    },
    "profile.phone": {
      "old_value": "+3545551111",
      "new_value": "+3545552222"
    }
  },
  "sync_status": "synced",
  "created_at": "2025-11-05T10:15:00Z",
  "synced_at": "2025-11-05T10:16:23Z",
  "error_message": null,
  "retry_count": 0,
  "source": "portal"
}
```

### Queries

#### Get Pending Changes

```javascript
const pending = await db.collection('sync_queue')
  .where('sync_status', '==', 'pending')
  .orderBy('created_at', 'asc')
  .get();

console.log(`Pending: ${pending.size}`);
```

#### Get Failed Syncs

```javascript
const failed = await db.collection('sync_queue')
  .where('sync_status', '==', 'failed')
  .get();

failed.forEach(doc => {
  const data = doc.data();
  console.log(`Failed: ${data.kennitala} - ${data.error_message}`);
});
```

#### Mark as Synced

```javascript
const syncQueueRef = db.collection('sync_queue').doc(docId);

await syncQueueRef.update({
  sync_status: 'synced',
  synced_at: admin.firestore.FieldValue.serverTimestamp()
});
```

#### Queue Statistics

```javascript
const stats = {
  pending: 0,
  synced: 0,
  failed: 0
};

const snapshot = await db.collection('sync_queue').get();
snapshot.forEach(doc => {
  const status = doc.data().sync_status;
  stats[status]++;
});

console.log('Queue Stats:', stats);
```

## 📦 Collection: /sync_logs/

### Overview

**Purpose**: Audit trail of all sync operations

**Document ID**: Auto-generated by Firestore

**Indexes**:
- `type` (single field)
- `status` (single field)
- Composite: `type`, `completed_at` (descending)

### Document Structure

```typescript
{
  type: enum,                      // "bidirectional_sync" | "member_change"
  status: enum,                    // "success" | "failed"
  started_at: Timestamp,           // When operation started
  completed_at: Timestamp,         // When operation finished
  duration_seconds: number,        // Execution time
  
  // For bidirectional_sync
  last_sync: Timestamp,            // Previous sync timestamp
  firestore_to_django: {
    success: number,               // Successful pushes
    failed: number                 // Failed pushes
  },
  django_to_firestore: {
    success: number,               // Successful pulls
    failed: number                 // Failed pulls
  },
  
  // For member_change
  kennitala: string,               // Which member changed
  action: string,                  // What happened
  changes: object,                 // What changed
  
  // Error tracking
  error_message: string | null,    // Error if failed
  error_stack: string | null       // Stack trace if available
}
```

### Field Details

#### type

**Type**: Enum (string)

**Values**:
- `"bidirectional_sync"` - Scheduled sync operation
- `"member_change"` - Individual member change logged

#### status

**Type**: Enum (string)

**Values**:
- `"success"` - Operation completed successfully
- `"failed"` - Operation encountered errors

### Example Documents

#### Bidirectional Sync Log

```json
{
  "type": "bidirectional_sync",
  "status": "success",
  "started_at": "2025-11-05T03:30:00Z",
  "completed_at": "2025-11-05T03:30:02Z",
  "duration_seconds": 2.45,
  "last_sync": "2025-11-04T03:30:00Z",
  "firestore_to_django": {
    "success": 0,
    "failed": 0
  },
  "django_to_firestore": {
    "success": 4,
    "failed": 0
  },
  "error_message": null,
  "error_stack": null
}
```

#### Member Change Log

```json
{
  "type": "member_change",
  "status": "success",
  "kennitala": "010190-3456",
  "action": "update",
  "changes": {
    "profile.email": {
      "old": "old@example.com",
      "new": "new@example.com"
    }
  },
  "completed_at": "2025-11-05T10:15:23Z",
  "error_message": null
}
```

### Queries

#### Get Recent Sync Logs

```javascript
const recentSyncs = await db.collection('sync_logs')
  .where('type', '==', 'bidirectional_sync')
  .orderBy('completed_at', 'desc')
  .limit(10)
  .get();

recentSyncs.forEach(doc => {
  const log = doc.data();
  console.log(`${log.completed_at}: ${log.status}`);
});
```

#### Get Failed Operations

```javascript
const failed = await db.collection('sync_logs')
  .where('status', '==', 'failed')
  .orderBy('completed_at', 'desc')
  .get();

failed.forEach(doc => {
  const log = doc.data();
  console.log(`Error: ${log.error_message}`);
});
```

#### Calculate Success Rate

```javascript
const logs = await db.collection('sync_logs')
  .where('type', '==', 'bidirectional_sync')
  .orderBy('completed_at', 'desc')
  .limit(100)
  .get();

let successCount = 0;
logs.forEach(doc => {
  if (doc.data().status === 'success') successCount++;
});

const successRate = (successCount / logs.size) * 100;
console.log(`Success Rate: ${successRate.toFixed(1)}%`);
```

## 🔐 Security Rules

### Current Rules

**File**: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(kennitala) {
      return isAuthenticated() && 
             request.auth.token.kennitala == kennitala;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             request.auth.token.role == 'admin';
    }
    
    // Members collection
    match /members/{kennitala} {
      // Read: Owner or admin
      allow read: if isOwner(kennitala) || isAdmin();
      
      // Update: Owner can update their own profile
      allow update: if isOwner(kennitala) && 
                      request.resource.data.membership.status == 
                      resource.data.membership.status;
      
      // Create/Delete: Admin only
      allow create, delete: if isAdmin();
    }
    
    // Sync queue - system only
    match /sync_queue/{document} {
      allow read, write: if false; // Cloud Functions only
    }
    
    // Sync logs - read-only for admins
    match /sync_logs/{document} {
      allow read: if isAdmin();
      allow write: if false; // Cloud Functions only
    }
  }
}
```

### Rule Explanations

#### Members Collection

**Read Access**:
- Members can read their own profile
- Admins can read all profiles

**Update Access**:
- Members can update their own profile fields
- Members cannot change their membership status
- Admins can update any profile

**Create/Delete Access**:
- Only admins can create or delete members

#### Sync Queue

**Access**: None from client
- Only Cloud Functions can read/write
- Prevents clients from manipulating sync operations

#### Sync Logs

**Access**: Read-only for admins
- Admins can view audit logs
- Only Cloud Functions can create logs

## 📊 Indexes

### Composite Indexes

**File**: `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "membership.status", "order": "ASCENDING" },
        { "fieldPath": "profile.name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "membership.status", "order": "ASCENDING" },
        { "fieldPath": "metadata.updated_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sync_queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sync_status", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "sync_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "completed_at", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

## 🔧 Data Migration

### Export Data

```bash
gcloud firestore export gs://ekklesia-prod-10-2025-backup/$(date +%Y%m%d) \
  --project=ekklesia-prod-10-2025
```

### Import Data

```bash
gcloud firestore import gs://ekklesia-prod-10-2025-backup/20251105 \
  --project=ekklesia-prod-10-2025
```

### Backup Script

```bash
#!/bin/bash
# backup-firestore.sh

PROJECT="ekklesia-prod-10-2025"
BUCKET="gs://ekklesia-prod-10-2025-backup"
DATE=$(date +%Y%m%d-%H%M%S)

echo "Starting Firestore backup..."
gcloud firestore export "${BUCKET}/${DATE}" --project="${PROJECT}"

if [ $? -eq 0 ]; then
  echo "✅ Backup completed: ${BUCKET}/${DATE}"
else
  echo "❌ Backup failed"
  exit 1
fi
```

## 🧪 Testing Data

### Create Test Member

```javascript
const testMember = {
  profile: {
    name: "Test Member",
    kennitala: "010190-0000",
    email: "test@example.com",
    phone: "+3545550000",
    birthday: "1990-01-01",
    gender: "other",
    housing_situation: "unknown",
    address: {
      street: "Test Street 1",
      postalcode: "000",
      city: "Test City",
      country: "Iceland"
    }
  },
  membership: {
    status: "active",
    joined_date: "2025-01-01",
    membership_type: "full",
    member_number: "TEST-001",
    branch: "Test"
  },
  privacy: {
    reachable: true,
    groupable: false,
    public_profile: false,
    newsletter: false
  },
  metadata: {
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    last_synced: null,
    source: "test",
    version: 2,
    deleted_at: null
  }
};

await db.collection('members').doc('0101900000').set(testMember);
console.log('✅ Test member created');
```

### Cleanup Test Data

```javascript
// Delete all test members
const testMembers = await db.collection('members')
  .where('membership.member_number', '>=', 'TEST-')
  .where('membership.member_number', '<', 'TEST-~')
  .get();

const batch = db.batch();
testMembers.forEach(doc => {
  batch.delete(doc.ref);
});

await batch.commit();
console.log(`✅ Deleted ${testMembers.size} test members`);
```

## 📈 Monitoring

### Collection Statistics

```javascript
async function getCollectionStats() {
  const members = await db.collection('members').get();
  const syncQueue = await db.collection('sync_queue').get();
  const syncLogs = await db.collection('sync_logs').get();
  
  console.log('📊 Firestore Statistics');
  console.log(`Members: ${members.size}`);
  console.log(`Sync Queue: ${syncQueue.size}`);
  console.log(`Sync Logs: ${syncLogs.size}`);
  
  // Active members
  const active = await db.collection('members')
    .where('membership.status', '==', 'active')
    .get();
  console.log(`Active Members: ${active.size}`);
}
```

### Storage Usage

```bash
# View Firestore usage in console
open "https://console.cloud.google.com/firestore/usage?project=ekklesia-prod-10-2025"
```

---

**Next**: [API_REFERENCE.md](./API_REFERENCE.md)  
**Back**: [INDEX.md](./INDEX.md)
