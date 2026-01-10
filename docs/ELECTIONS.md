# Elections System

The Ekklesia platform has **two election systems** with different purposes and access rules.

## Overview

| System | Path | Purpose | Voters | Results |
|--------|------|---------|--------|---------|
| **Admin Elections** | `/admin-elections/` | General member voting | All members | Immediate when closed |
| **Nomination Committee** | `/nomination/` | Committee nominations | Committee only | Locked until all vote |

---

## Admin Elections

General elections open to all members with three voting types.

### Voting Types

| Type | API Value | Description |
|------|-----------|-------------|
| **Eitt val** | `single-choice` | Select one option (radio buttons) |
| **Mörg val** | `multi-choice` | Select multiple options (checkboxes) |
| **Forgangsröðun** | `ranked-choice` | Rank options in preference order (STV) |

### File Structure

```
apps/members-portal/admin-elections/
├── index.html              # Elections list
├── create.html             # Create wizard (3 steps)
├── election-control.html   # Control panel
├── results.html            # Results viewer
├── i18n/
│   ├── strings-loader.js
│   └── values-is/admin-elections-strings.xml
└── js/
    ├── elections-list.js
    ├── election-create.js
    ├── election-control.js
    ├── election-results.js
    ├── api/elections-admin-api.js
    └── validation/election-validation.js
```

### API Endpoints

Base URL: `https://elections-service-521240388393.europe-west1.run.app`

#### Admin Endpoints (`/api/admin/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/elections` | List all elections |
| GET | `/elections/{id}` | Get single election |
| POST | `/elections` | Create election |
| PATCH | `/elections/{id}` | Update election |
| DELETE | `/elections/{id}` | Delete election |
| POST | `/elections/{id}/open` | Open for voting |
| POST | `/elections/{id}/close` | Close voting |
| POST | `/elections/{id}/hide` | Soft delete |
| POST | `/elections/{id}/unhide` | Restore |
| GET | `/elections/{id}/results` | Get results |

#### Member Endpoints (`/api/elections/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List open elections |
| GET | `/{id}` | Get election details |
| POST | `/{id}/vote` | Cast vote |

### Vote Payloads

**Single/Multi Choice:**
```json
{
  "answer_ids": ["answer-uuid-1", "answer-uuid-2"]
}
```

**Ranked Choice:**
```json
{
  "rankings": [
    {"answer_id": "uuid-1", "rank": 1},
    {"answer_id": "uuid-2", "rank": 2},
    {"answer_id": "uuid-3", "rank": 3}
  ]
}
```

### Create Election Payload

```json
{
  "title": "Election Title",
  "question": "What is the question?",
  "description": "Optional description",
  "voting_type": "single-choice|multi-choice|ranked-choice",
  "max_selections": 1,
  "num_seats": 3,
  "answers": [
    {"answer_text": "Option 1", "display_order": 0},
    {"answer_text": "Option 2", "display_order": 1}
  ]
}
```

### Election Status Flow

```
draft → published → closed
         ↓
       hidden (soft delete)
```

| Status | Voting | Editable | Results |
|--------|--------|----------|---------|
| `draft` | No | Full | No |
| `published` | Yes | Metadata only | No |
| `closed` | No | Metadata only | Yes |
| `hidden` | No | No | No |

### Results Display

When election is closed:
- Summary: Total votes, options count, status
- Vote distribution table with percentages
- Bar chart visualization
- Winner badge for highest vote getter
- Export to CSV option

### i18n Pattern

```javascript
import { R } from '../i18n/strings-loader.js';

await R.load('is');
const label = R.string.voting_type_single;
const formatted = R.format(R.string.duration_minutes, 30);
```

---

## Nomination Committee Elections

Restricted elections for committee nominations with special rules.

### Key Differences from Admin Elections

| Feature | Admin Elections | Nomination Committee |
|---------|-----------------|---------------------|
| **Path** | `/admin-elections/` | `/nomination/` |
| **Voters** | All members | Committee members only |
| **Results** | Visible when closed | Locked until ALL vote |
| **Voting Type** | Single/Multi/Ranked | Ranked only |
| **Identity** | Anonymous | Preserved (votes shown) |
| **Justification** | Optional | Required for top N |

### Access Control

Access controlled by `committee_member_uids` array in election document:

```json
{
  "id": "election-uuid-here",
  "title": "Uppstilling - [Election Name]",
  "voting_type": "nomination-committee",
  "eligibility": "committee",
  "committee_member_uids": [
    "firebase-uid-1",
    "firebase-uid-2",
    "firebase-uid-3"
  ],
  "preserve_voter_identity": true,
  "requires_justification": true,
  "justification_required_for_top_n": 3
}
```

> **Important:** Always use Firebase UIDs, NOT kennitala.

### File Structure

```
apps/members-portal/nomination/
├── index.html              # Committee dashboard
├── vote.html               # Voting interface
├── results.html            # Results (locked until all vote)
└── js/
    ├── api-nomination.js   # Nomination-specific API
    ├── nomination-vote.js  # Voting logic
    └── nomination-results.js
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/nomination/{id}` | Get election (member) |
| `GET /api/admin/elections/{id}` | Get with committee info (admin) |
| `POST /api/nomination/{id}/vote` | Submit ranked vote with justifications |
| `GET /api/nomination/{id}/results` | Results (only if all have voted) |

### Adding Committee Member

#### Via API (Recommended)

```bash
curl -X PATCH "$API/admin/elections/{ELECTION_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "committee_member_uids": [
      "existing-uid-1",
      "existing-uid-2",
      "NEW-MEMBER-UID"
    ]
  }'
```

#### Via PostgreSQL

```bash
# Start proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 --port 5433 --gcloud-auth &

# Update
PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U postgres -d socialism -c "
UPDATE elections.elections
SET committee_member_uids = '[\"uid1\", \"uid2\", \"uid3\"]'::jsonb
WHERE id = 'ELECTION_ID';
"
```

### Finding Firebase UID

```bash
cd ~/Development/projects/ekklesia/services/svc-members/functions

node -e "
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ekklesia-prod-10-2025' });
const db = admin.firestore();

async function findMember(kennitala) {
  const doc = await db.collection('members').doc(kennitala).get();
  if (doc.exists) {
    const d = doc.data();
    console.log('Name:', d.profile?.name || d.name);
    console.log('Firebase UID:', d.metadata?.firebase_uid);
  }
}
findMember('KENNITALA_HERE').then(() => process.exit(0));
"
```

### Creating Nomination Election

```bash
curl -X POST "$API/admin/elections" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Uppstilling - [NAME]",
    "question": "Raðaðu frambjóðendum í forgangsröð",
    "voting_type": "nomination-committee",
    "eligibility": "committee",
    "seats_to_fill": 3,
    "preserve_voter_identity": true,
    "requires_justification": true,
    "justification_required_for_top_n": 3,
    "committee_member_uids": ["uid-1", "uid-2", "uid-3"],
    "answers": [
      {"id": "candidate-1", "text": "Candidate Name 1"},
      {"id": "candidate-2", "text": "Candidate Name 2"}
    ]
  }'
```

---

## Troubleshooting

### "Enginn aðgangur" (No Access)

**Cause 1: Election is hidden**
```bash
PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U postgres -d socialism -c "
SELECT title, hidden FROM elections.elections WHERE id = 'ELECTION_ID';
"

# Fix:
UPDATE elections.elections SET hidden = FALSE WHERE id = 'ELECTION_ID';
```

**Cause 2: UID not in committee**
1. Get user's UID: Browser DevTools → `firebase.auth().currentUser.uid`
2. Check committee: `SELECT committee_member_uids FROM elections.elections WHERE id = '...'`
3. Add UID to array

### Results Not Showing
- Results only appear when ALL committee members have voted
- Check `vote_count` vs `committee_member_uids` length

---

## Database Architecture

Elections are stored in **PostgreSQL** (Cloud SQL), NOT Firestore:

| Component | Storage |
|-----------|---------|
| Members | Firestore (`members/{kennitala}`) |
| Elections | PostgreSQL (`elections.elections`) |
| Ballots | PostgreSQL (`elections.ballots`) |

**Connection:**
- Database: `socialism`
- Schema: `elections`
- Tables: `elections`, `ballots`, `ballot_justifications`, `voting_tokens`, `audit_log`
- Instance: `ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1`
- Proxy port: `5433`

---

## Testing

```bash
# Create test election
curl -X POST "$API/admin/elections" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Test", "question": "?", "type": "single_choice", "answers": [{"text": "Yes"}, {"text": "No"}]}'

# Open
curl -X POST "$API/admin/elections/{id}/open" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"voting_starts_at": "2025-01-01T00:00:00Z", "voting_ends_at": "2025-01-02T00:00:00Z"}'

# Vote (member endpoint)
curl -X POST "$API/elections/{id}/vote" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"answer_ids": ["Yes"]}'

# Close
curl -X POST "$API/admin/elections/{id}/close" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Deployment

```bash
cd ~/Development/projects/ekklesia/services/svc-members
firebase deploy --only hosting
```

> **Note:** JS files use version parameters (`?v=YYYYMMDD`) for cache busting.
