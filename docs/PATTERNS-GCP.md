# GCP & Firebase Patterns

Quick reference for querying and managing GCP/Firebase resources.

---

## Authentication

### Check Current Auth
```bash
gcloud auth list                    # GCP accounts
firebase login:list                 # Firebase accounts
gcloud config get-value project     # Current project
```

### Re-authenticate (when tokens expire)
```bash
# Full re-auth (for invalid_grant errors)
firebase login --reauth
gcloud auth login
gcloud auth application-default login
gcloud config set project ekklesia-prod-10-2025

# Quick refresh (usually enough)
gcloud auth application-default login
```

---

## Cloud SQL (PostgreSQL)

### Start Proxy
```bash
# IMPORTANT: Always use --gcloud-auth
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth
```

### Get Password
```bash
gcloud secrets versions access latest --secret=django-socialism-db-password
# Returns: Socialism2025#Db
```

### Connect
```bash
PGPASSWORD='Socialism2025#Db' psql -h localhost -p 5433 -U socialism -d socialism
```

### Common Queries
```bash
# List tables
PGPASSWORD='Socialism2025#Db' psql -h localhost -p 5433 -U socialism -d socialism -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;"

# Describe table
PGPASSWORD='Socialism2025#Db' psql -h localhost -p 5433 -U socialism -d socialism -c "
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'membership_comrade' ORDER BY ordinal_position;"

# Get member by ID
PGPASSWORD='Socialism2025#Db' psql -h localhost -p 5433 -U socialism -d socialism -c "
SELECT c.id, c.name, c.ssn, c.date_joined::date,
       ci.email, ci.phone
FROM membership_comrade c
LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
WHERE c.id = 3612;"

# Recent members
PGPASSWORD='Socialism2025#Db' psql -h localhost -p 5433 -U socialism -d socialism -c "
SELECT id, name, ssn, date_joined::date
FROM membership_comrade ORDER BY id DESC LIMIT 10;"
```

---

## Firestore

### Schema Structure
Firestore documents use nested maps:
```
members/{kennitala}
├── profile
│   ├── name
│   ├── kennitala
│   ├── email
│   ├── phone
│   ├── birthday
│   ├── gender
│   ├── housing_situation
│   ├── reachable
│   ├── groupable
│   ├── addresses[]
│   ├── facebook
│   └── foreign_phone
├── membership
│   ├── status (active/inactive/deleted)
│   ├── date_joined
│   ├── titles[]
│   ├── unions[]
│   └── cell
├── metadata
│   ├── django_id
│   ├── comrade_id
│   ├── source
│   ├── created_at
│   ├── last_modified
│   └── synced_at
└── django_roles (optional)
    ├── is_staff
    └── is_superuser
```

### Query by Kennitala
```bash
# Document ID IS the kennitala (without hyphen)
curl -s -X GET \
  "https://firestore.googleapis.com/v1/projects/ekklesia-prod-10-2025/databases/(default)/documents/members/0912546629" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  | jq '.fields'
```

### Query by Field (e.g., django_id)
```bash
# Note: Nested fields use dot notation: metadata.django_id
curl -s -X POST \
  "https://firestore.googleapis.com/v1/projects/ekklesia-prod-10-2025/databases/(default)/documents:runQuery" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "structuredQuery": {
      "from": [{"collectionId": "members"}],
      "where": {
        "fieldFilter": {
          "field": {"fieldPath": "metadata.django_id"},
          "op": "EQUAL",
          "value": {"integerValue": "3612"}
        }
      },
      "limit": 1
    }
  }'
```

### Query by Profile Field
```bash
# Search by profile.kennitala (no hyphen)
curl -s -X POST \
  "https://firestore.googleapis.com/v1/projects/ekklesia-prod-10-2025/databases/(default)/documents:runQuery" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "structuredQuery": {
      "from": [{"collectionId": "members"}],
      "where": {
        "fieldFilter": {
          "field": {"fieldPath": "profile.kennitala"},
          "op": "EQUAL",
          "value": {"stringValue": "0912546629"}
        }
      },
      "limit": 1
    }
  }' | jq '.[0].document.fields.profile.mapValue.fields | {
    name: .name.stringValue,
    email: .email.stringValue,
    phone: .phone.stringValue
  }'
```

### List Recent Members
```bash
curl -s -X POST \
  "https://firestore.googleapis.com/v1/projects/ekklesia-prod-10-2025/databases/(default)/documents:runQuery" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "structuredQuery": {
      "from": [{"collectionId": "members"}],
      "limit": 5
    }
  }' | jq '.[].document | {
    id: .name | split("/") | last,
    name: .fields.profile.mapValue.fields.name.stringValue,
    django_id: .fields.metadata.mapValue.fields.django_id.integerValue
  }'
```

### Lookup Collections
```bash
# Countries, postal codes, etc. are in lookup_* collections
curl -s -X GET \
  "https://firestore.googleapis.com/v1/projects/ekklesia-prod-10-2025/databases/(default)/documents/lookup_countries?pageSize=5" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  | jq '.documents[].fields'
```

### Update Document (PATCH)
```bash
# Update specific fields using updateMask.fieldPaths
# Write JSON to file first (more reliable than inline)
cat > /tmp/update.json << 'EOF'
{
  "fields": {
    "profile": {
      "mapValue": {
        "fields": {
          "addresses": {
            "arrayValue": {
              "values": [{
                "mapValue": {
                  "fields": {
                    "street": {"stringValue": "Lerkidalur"},
                    "number": {"stringValue": "11"},
                    "postal_code": {"stringValue": "260"},
                    "city": {"stringValue": "Reykjanesbær"},
                    "country": {"stringValue": "IS"},
                    "hnitnum": {"integerValue": "10088170"},
                    "is_default": {"booleanValue": true}
                  }
                }
              }]
            }
          }
        }
      }
    }
  }
}
EOF

# Update with multiple field paths
curl -s -X PATCH \
  "https://firestore.googleapis.com/v1/projects/ekklesia-prod-10-2025/databases/(default)/documents/members/1102992499?updateMask.fieldPaths=profile.addresses&updateMask.fieldPaths=dataFlags.emptyAddress" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d @/tmp/update.json
```

### Update Cell Assignment
```bash
# Update membership.cell for a member
cat > /tmp/update_cell.json << 'EOF'
{
  "fields": {
    "membership": {
      "mapValue": {
        "fields": {
          "cell": {
            "mapValue": {
              "fields": {
                "id": {"integerValue": "1904"},
                "name": {"stringValue": "Njarðvík og Ásbrú"}
              }
            }
          }
        }
      }
    }
  }
}
EOF

curl -s -X PATCH \
  "https://firestore.googleapis.com/v1/projects/ekklesia-prod-10-2025/databases/(default)/documents/members/KENNITALA?updateMask.fieldPaths=membership.cell" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d @/tmp/update_cell.json
```

---

## Cloud Functions

### List Functions
```bash
gcloud functions list --regions=europe-west2 --format="table(name,state)"
```

### Deploy Single Function
```bash
cd services/svc-members
firebase deploy --only functions:FUNCTION_NAME

# Examples:
firebase deploy --only functions:list_countries
firebase deploy --only functions:register_member
```

### Test Callable Function
```bash
# Firebase Callable functions need special format
curl -s -X POST \
  "https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/list_countries" \
  -H "Content-Type: application/json" \
  -d '{"data":{}}' | jq '.result | length'
```

### View Logs
```bash
gcloud functions logs read FUNCTION_NAME --region=europe-west2 --limit=20
```

---

## Cloud Run

### List Services
```bash
gcloud run services list --region=europe-west2 --format="table(name,status)"
```

### Describe Service
```bash
gcloud run services describe SERVICE_NAME --region=europe-west2
```

### View Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=SERVICE_NAME" --limit=20
```

---

## Secrets Manager

### List Secrets
```bash
gcloud secrets list --format="table(name)"
```

### Get Secret Value
```bash
gcloud secrets versions access latest --secret=SECRET_NAME
```

### Common Secrets
| Secret | Usage |
|--------|-------|
| `django-socialism-db-password` | Cloud SQL password |
| `django-api-token` | Django API auth |
| `elections-s2s-api-key` | Elections service auth |
| `kenni-client-secret` | Kenni.is OAuth |

---

## Firebase Hosting

### Deploy Frontend
```bash
cd services/svc-members
firebase deploy --only hosting
```

### Live URLs
| Environment | URL |
|-------------|-----|
| Production | https://ekklesia-prod-10-2025.web.app |
| Alt | https://ekklesia-prod-10-2025.firebaseapp.com |

---

## Troubleshooting

### "Permission denied" on Firestore
```bash
gcloud auth application-default login
```

### "Connection refused" on Cloud SQL
```bash
# Check if proxy is running
pgrep -f cloud-sql-proxy

# Start proxy with --gcloud-auth
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth
```

### "invalid_grant" errors
```bash
# Full re-authentication
gcloud auth login
gcloud auth application-default login
firebase login --reauth
```

### Function not found
```bash
# List all functions to verify name
gcloud functions list --regions=europe-west2 | grep FUNCTION_NAME
```

---

## Data Format Notes

### Kennitala
- **Django**: Stored without hyphen: `0912546629`
- **Firestore**: Stored without hyphen: `0912546629`
- **Display**: With hyphen: `091254-6629`
- **Document ID**: Is the kennitala (no hyphen)

### Dates
- **Django**: `date_joined::date` for date only
- **Firestore**: ISO timestamp: `2025-12-12T13:26:13.095712Z`

### Nested Fields
Firestore uses nested maps - query with dot notation:
- `profile.name`
- `profile.kennitala`
- `metadata.django_id`
- `membership.status`

---

## Address Services (iceaddr)

The registration form uses three Cloud Functions for Icelandic address handling, powered by the `iceaddr` library.

### Address Flow
```
User types address → search_addresses → User selects → validate_address → Store hnitnum
                                                    ↓
                              get_cells_by_postal_code → Assign cell
```

### 1. Search Addresses (`search_addresses`)
Live search as user types street name and number.

```bash
# Search for addresses matching "Laugaveg"
curl -s -X POST \
  "https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/search_addresses" \
  -H "Content-Type: application/json" \
  -d '{"data":{"query":"Laugaveg 1"}}' | jq '.result[:3]'
```

**Returns:**
```json
[
  {"hnitnum": 10083386, "display": "Laugavegur 1, 101 Reykjavík"},
  {"hnitnum": 10083387, "display": "Laugavegur 1a, 101 Reykjavík"},
  ...
]
```

### 2. Validate Address (`validate_address`)
Validates and returns full address details from `hnitnum`.

```bash
# Get address details by hnitnum
curl -s -X POST \
  "https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/validate_address" \
  -H "Content-Type: application/json" \
  -d '{"data":{"hnitnum":10083386}}' | jq '.result'
```

**Returns:**
```json
{
  "valid": true,
  "hnitnum": 10083386,
  "street": "Laugavegur",
  "number": "1",
  "letter": "",
  "postal_code": "101",
  "city": "Reykjavík"
}
```

### 3. Validate Postal Code (`validate_postal_code`)
Checks if postal code exists and returns region info.

```bash
curl -s -X POST \
  "https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/validate_postal_code" \
  -H "Content-Type: application/json" \
  -d '{"data":{"postal_code":"101"}}' | jq '.result'
```

**Returns:**
```json
{
  "valid": true,
  "postal_code_id": 81,
  "code": "101",
  "region": {"id": 1, "name": "Höfuðborgarsvæði"}
}
```

### 4. Get Cells by Postal Code (`get_cells_by_postal_code`)
Returns cells (sellur) that cover a postal code area.

```bash
curl -s -X POST \
  "https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/get_cells_by_postal_code" \
  -H "Content-Type: application/json" \
  -d '{"data":{"postal_code_id":81}}' | jq '.result'
```

**Returns:**
```json
[
  {"id": 1, "name": "Sella Miðbæjar"},
  {"id": 5, "name": "Sella Hlíða"}
]
```

### Cell Lookup Flow
To find which cell a member belongs to based on their address:

```bash
# 1. Get postal_code_id from postal code
curl -s -X POST \
  "https://firestore.googleapis.com/v1/projects/ekklesia-prod-10-2025/databases/(default)/documents:runQuery" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"structuredQuery":{"from":[{"collectionId":"lookup_postal_codes"}],"where":{"fieldFilter":{"field":{"fieldPath":"code"},"op":"EQUAL","value":{"integerValue":"260"}}},"limit":1}}'
# Returns: id: 27 for postal code 260

# 2. Get cells for that postal_code_id
curl -s -X POST \
  "https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/get_cells_by_postal_code" \
  -H "Content-Type: application/json" \
  -d '{"data":{"postal_code_id":27}}'
# Returns: [{"id":1904,"name":"Njarðvík og Ásbrú"}, ...]
```

### iceaddr Library
These functions use the Python `iceaddr` package which contains the Icelandic address registry (Staðfangaskrá).

```python
from iceaddr import iceaddr_suggest

# Search by text
results = iceaddr_suggest("Laugaveg 1")
```

**IMPORTANT:** `iceaddr_lookup()` does NOT support `hnitnum` parameter!
To lookup by hnitnum, use direct SQL:

```python
from iceaddr.db import shared_db
from iceaddr import postcode_lookup

def get_address_from_hnitnum(hnitnum: int) -> dict | None:
    conn = shared_db.connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM stadfong WHERE hnitnum = ?', (hnitnum,))
    row = cursor.fetchone()

    if row:
        postnr = row['postnr']
        city = ''
        if postnr:
            pc_info = postcode_lookup(postnr)
            if pc_info:
                city = pc_info.get('stadur_nf', '')

        return {
            'street': row['heiti_nf'] or '',
            'number': str(row['husnr']) if row['husnr'] else '',
            'letter': row['bokst'] or '',
            'postal_code': str(postnr) if postnr else '',
            'city': city,
            'hnitnum': hnitnum
        }
    return None
```

**Key fields from iceaddr:**
| Field | Description |
|-------|-------------|
| `hnitnum` | Unique address ID (store this!) |
| `heiti_nf` | Street name (nominative) |
| `husnr` | House number |
| `bokst` | Letter suffix (a, b, c...) |
| `postnr` | Postal code |
| `stadur_nf` | City/town name |

### Address Storage in Firestore
```json
{
  "profile": {
    "addresses": [
      {
        "street": "Laugavegur",
        "number": "1",
        "letter": "",
        "postal_code": "101",
        "city": "Reykjavík",
        "country": "IS",
        "hnitnum": 10083386,
        "is_default": true
      }
    ]
  }
}
```

### Troubleshooting Addresses

**Empty addresses in member document:**
- User may have skipped address step or selected "Ekkert heimilisfang"
- Check if `street-unlocated` was checked (no fixed address)
- Check `dataFlags.emptyAddress` field

**No cell assigned:**
- Address postal code may not be mapped to any cell
- Check `postal_code_cells` collection in Firestore

**Address search returns nothing:**
- Verify iceaddr package is updated in Cloud Function
- Check function logs for errors

**Type mismatch in Firestore queries:**
- `lookup_postal_codes.code` is stored as **integer**, not string
- Always convert: `int(postal_code)` before querying
```python
# WRONG - searching with string
docs = db.collection('lookup_postal_codes').where('code', '==', "101").stream()

# RIGHT - searching with integer
docs = db.collection('lookup_postal_codes').where('code', '==', 101).stream()
```

**Manual address update for members:**
1. Search address: `search_addresses` with query
2. Get hnitnum from result
3. Get postal_code_id from `lookup_postal_codes`
4. Get cells from `get_cells_by_postal_code`
5. Update Firestore with PATCH (see Update Document section)

---

## Node.js Firebase Admin Scripts

For complex queries and batch operations, use Node.js scripts with Firebase Admin SDK.

### Setup Script Template
```javascript
// tmp/my-script.js
import admin from "firebase-admin";

admin.initializeApp({ projectId: "ekklesia-prod-10-2025" });
const db = admin.firestore();

async function main() {
  // Your code here
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
```

### Run Script
```bash
cd /home/gudro/Development/projects/ekklesia/tmp && node my-script.js
```

### Search Members by Name
```javascript
const snapshot = await db.collection("members").get();

const nameLower = "jón jónsson".toLowerCase();
const parts = nameLower.split(" ");
const firstName = parts[0];
const lastName = parts[parts.length - 1];

snapshot.forEach(doc => {
  const data = doc.data();
  const memberName = (data.profile?.name || "").toLowerCase();

  if (memberName.includes(firstName) && memberName.includes(lastName)) {
    console.log("Nafn:", data.profile?.name);
    console.log("Kennitala:", doc.id);
    console.log("Django ID:", data.metadata?.django_id);
    console.log("Email:", data.profile?.email);
    console.log("Sími:", data.profile?.phone);
  }
});
```

### Update Document
```javascript
const docRef = db.collection("nomination-candidates").doc("jon-jonsson");

await docRef.update({
  member_info: {
    django_id: 1234,
    kennitala: "0101011234",
    phone: "1234567",
    email: "jon@example.com"
  },
  updated_at: admin.firestore.FieldValue.serverTimestamp()
});
```

### Batch Updates
```javascript
const updates = [
  { docId: "jon-jonsson", member_info: { django_id: 1234, ... } },
  { docId: "anna-sigurdardottir", member_info: { django_id: 5678, ... } }
];

for (const update of updates) {
  const docRef = db.collection("nomination-candidates").doc(update.docId);
  await docRef.update({
    member_info: update.member_info,
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

---

## Nomination Candidates Collection

### Schema
```
nomination-candidates/{slug}
├── name                    # Full name
├── bio                     # Biography text
├── experience              # Work/political experience
├── focus_areas[]           # Array of focus areas
├── other                   # Additional notes
├── photo_url               # Profile photo URL
├── member_info
│   ├── django_id           # Django member ID
│   ├── kennitala           # SSN (document key)
│   ├── email               # Contact email
│   ├── phone               # Contact phone
│   └── firebase_uid        # Firebase Auth UID (if logged in)
├── edit_history[]          # Array of {field, old_value, new_value, edited_by, timestamp}
├── created_at              # Timestamp
└── updated_at              # Timestamp
```

### Document IDs
Document IDs are URL-safe slugs, not kennitala:
- `jon-jonsson`
- `anna-sigurdardottir`
- `olafur-olafsson`
- `gudrun-magnusdottir`

### List All Candidates
```javascript
const snapshot = await db.collection("nomination-candidates").get();

snapshot.forEach(doc => {
  const data = doc.data();
  console.log("ID:", doc.id);
  console.log("Nafn:", data.name);
  console.log("member_info:", JSON.stringify(data.member_info || "ekki til"));
});
```

### Security Rules
```
match /nomination-candidates/{candidateId} {
  allow read: if isAuthenticated();
  allow update: if isAuthenticated();
  allow create, delete: if false;
}
```

### Link Candidate to Member
To find a candidate's member record and link them:

```javascript
// 1. Search for candidate in members collection
const snapshot = await db.collection("members").get();
const candidateName = "Jón Jónsson";
const nameLower = candidateName.toLowerCase();
const parts = nameLower.split(" ");
const firstName = parts[0];
const lastName = parts[parts.length - 1];

let memberInfo = null;
snapshot.forEach(doc => {
  const data = doc.data();
  const memberName = (data.profile?.name || "").toLowerCase();

  if (memberName.includes(firstName) && memberName.includes(lastName)) {
    memberInfo = {
      django_id: data.metadata?.django_id,
      kennitala: doc.id,
      email: data.profile?.email || "",
      phone: data.profile?.phone || ""
    };
  }
});

// 2. Update candidate with member_info
if (memberInfo) {
  await db.collection("nomination-candidates").doc("jon-jonsson").update({
    member_info: memberInfo,
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });
}
```
