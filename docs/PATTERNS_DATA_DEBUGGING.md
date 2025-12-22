# Data Debugging Patterns

Patterns learned from debugging data loss and sync issues between Django and Firestore.

---

## 1. iceaddr SQLite Access

The `iceaddr` Python package provides Icelandic address data. Its `shared_db.connection()` returns a connection with a **custom row_factory that returns dictionaries**, not tuples.

```python
# CORRECT - dict-style access
from iceaddr.db import shared_db

conn = shared_db.connection()
cursor = conn.cursor()
cursor.execute('SELECT * FROM stadfong WHERE hnitnum = ?', (hnitnum,))
row = cursor.fetchone()

if row:
    street = row['heiti_nf']      # Dict key access
    number = row['husnr']
    postal = row['postnr']

# WRONG - tuple index access fails with KeyError
street = row[1]   # KeyError: 1
number = row[2]   # KeyError: 2
```

**Lesson:** Don't assume SQLite returns tuples. Check the library's row_factory.

---

## 2. Bidirectional Sync - Preserve Source Data

When System B syncs data to System A, and System A already has the document (created by a different flow), preserve fields that System B doesn't have.

### Problem Scenario

```
1. User registers → Firestore saves email, phone, address
2. Registration creates member in Django (just name/kennitala)
3. Django signals call sync webhook
4. Sync overwrites Firestore with Django's EMPTY values
```

### Solution

```python
def sync_from_external(req):
    external_data = body.get('data')
    firestore_doc = transform_to_firestore(external_data)

    doc_ref = db.collection('members').document(id)
    existing_doc = doc_ref.get()

    if existing_doc.exists:
        existing = existing_doc.to_dict()
        existing_profile = existing.get('profile', {})
        new_profile = firestore_doc.get('profile', {})

        # Preserve fields if external source is empty but we have data
        for field in ['email', 'phone', 'addresses']:
            if existing_profile.get(field) and not new_profile.get(field):
                new_profile[field] = existing_profile[field]

        firestore_doc['profile'] = new_profile

    doc_ref.set(firestore_doc, merge=True)
```

**Key insight:** The external system may not have all the data that the original source captured.

---

## 3. Debugging Data Loss - Verify After Save

When data appears to be lost (saved but empty when read later), the problem is often that **another operation overwrites it**.

### Investigation Pattern

```python
# 1. Log BEFORE save
log_json('DEBUG', 'About to save',
         email=member_doc['profile']['email'],
         phone=member_doc['profile']['phone'])

# 2. Save
doc_ref.set(member_doc)

# 3. Verify IMMEDIATELY after save
verify_doc = doc_ref.get()
if verify_doc.exists:
    data = verify_doc.to_dict()
    log_json('DEBUG', 'VERIFIED after save',
             email=data.get('profile', {}).get('email'),
             phone=data.get('profile', {}).get('phone'))
```

### Decision Tree

```
Data correct BEFORE save?
├── No  → Bug in data preparation
└── Yes → Data correct AFTER save?
          ├── No  → Bug in save operation
          └── Yes → Data correct when read LATER?
                    ├── Yes → No bug
                    └── No  → SOMETHING ELSE IS OVERWRITING
                              ├── Search for sync webhooks
                              ├── Search for Firestore triggers
                              └── Check for race conditions
```

### Common Culprits

| Symptom | Likely Cause |
|---------|--------------|
| Data disappears within seconds | Sync webhook from external system |
| Data disappears on specific action | Firestore trigger on that action |
| Data sometimes missing | Race condition between parallel operations |
| Data replaced with older version | Sync job running with stale cache |

---

## 4. Sync Webhook Debugging

When Django (or other external system) calls a sync webhook:

```python
@https_fn.on_request(...)
def sync_from_django(req):
    action = body.get('action')  # 'create', 'update', 'delete'

    # Log what we received
    log_json('INFO', 'Sync received',
             action=action,
             kennitala=f"{kennitala[:6]}****",
             has_email=bool(django_data.get('contact_info', {}).get('email')),
             has_phone=bool(django_data.get('contact_info', {}).get('phone')))
```

**Key fields to log:**
- Action type (create/update/delete)
- Whether key fields are present in incoming data
- Whether document already exists in target system
- What fields will be preserved vs overwritten
