# Nomination Committee System

## Overview

The Nomination Committee system is a **separate, restricted election system** for committee-based nominations. Only designated committee members can vote, and results are locked until ALL members have voted.

## Key Differences from Admin Elections

| Feature | Admin Elections | Nomination Committee |
|---------|-----------------|-------------------|
| **Path** | `/admin-elections/` | `/nomination/` |
| **Voters** | All members | Committee members only |
| **Results** | Visible when closed | Locked until all vote |
| **Voting Type** | Single/Multi/Ranked | Ranked only |
| **Identity** | Anonymous | Preserved (votes shown per member) |
| **Justification** | Optional | Required for top N candidates |

## Committee Membership

### How Access is Controlled

Access is controlled by the `committee_member_uids` array in the election document:

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

> **Note:** Always use Firebase UIDs, NOT kennitala. Using kennitala will cause access issues.

### Adding a Committee Member

#### Option 1: Via API (Recommended)

```bash
# Get current election
curl -s "https://elections-service-521240388393.europe-west1.run.app/api/admin/elections/{ELECTION_ID}" \
  -H "Authorization: Bearer $TOKEN"

# Update with new committee member
curl -X PATCH "https://elections-service-521240388393.europe-west1.run.app/api/admin/elections/{ELECTION_ID}" \
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

#### Option 2: Via PostgreSQL (Direct Database)

> **Important:** Elections are stored in **PostgreSQL**, NOT Firestore! Firestore updates will fail with "No document to update".

```bash
# Start cloud-sql-proxy first
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth &

# Get password
gcloud secrets versions access latest --secret=postgres-password --project=ekklesia-prod-10-2025

# Connect and update
PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U postgres -d socialism -c "
UPDATE elections.elections
SET committee_member_uids = '[\"uid1\", \"uid2\", \"uid3\"]'::jsonb
WHERE id = 'ELECTION_ID';
"
```

### Finding a Member's Firebase UID

```bash
# From the functions directory:
cd ~/Development/projects/ekklesia/services/svc-members/functions

# Look up by kennitala
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
  } else {
    console.log('Member not found');
  }
}
findMember('KENNITALA_HERE').then(() => process.exit(0));
"
```

## File Structure

```
apps/members-portal/nomination/
├── index.html              # Committee dashboard
├── vote.html               # Voting interface
├── results.html            # Results (locked until all vote)
└── js/
    ├── api-nomination.js   # Nomination-specific API
    ├── nomination-vote.js # Voting logic
    └── nomination-results.js # Results display
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/nomination/{id}` | Get nomination election (member endpoint) |
| `GET /api/admin/elections/{id}` | Get election with committee info (admin) |
| `POST /api/nomination/{id}/vote` | Submit ranked vote with justifications |
| `GET /api/nomination/{id}/results` | Get results (only if all have voted) |

## Error Messages

| Message | Meaning |
|---------|---------|
| "Enginn aðgangur" | User's UID not in `committee_member_uids` OR election is `hidden` |
| "Niðurstöður eru ekki aðgengilegar..." | Not all committee members have voted |
| "X nefndarmaenn á eftir að kjósa" | X members still need to vote |

## Troubleshooting

### "Enginn aðgangur" - No Access

**Two possible causes:**

#### Cause 1: Election is Hidden (`hidden = TRUE`)

The API filters elections with `AND e.hidden = FALSE`. If election is hidden, it returns empty array which shows "Enginn aðgangur".

**Check in PostgreSQL:**
```bash
PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U postgres -d socialism -c "
SELECT title, hidden FROM elections.elections
WHERE id = 'ELECTION_ID';
"
```

**Fix:**
```bash
PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U postgres -d socialism -c "
UPDATE elections.elections SET hidden = FALSE
WHERE id = 'ELECTION_ID';
"
```

#### Cause 2: User's UID Not in Committee

1. **Check user's Firebase UID:**
   - Open browser DevTools → Console
   - Run: `firebase.auth().currentUser.uid`

2. **Verify UID is in committee:**
   ```bash
   PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U postgres -d socialism -c "
   SELECT committee_member_uids FROM elections.elections
   WHERE id = 'ELECTION_ID';
   "
   ```

3. **Add user to committee:**
   ```bash
   # Replace the array with updated UIDs
   PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U postgres -d socialism -c "
   UPDATE elections.elections
   SET committee_member_uids = '[\"uid1\", \"uid2\", \"NEW_UID\"]'::jsonb
   WHERE id = 'ELECTION_ID';
   "
   ```

### Results Not Showing

- Results only show when ALL committee members have voted
- Check `vote_count` vs length of `committee_member_uids`
- Individual member votes are shown with justifications

## Creating a New Nomination Committee Election

```bash
TOKEN="your-firebase-token"

curl -X POST "https://elections-service-521240388393.europe-west1.run.app/api/admin/elections" \
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
    "committee_member_uids": [
      "uid-1",
      "uid-2",
      "uid-3"
    ],
    "answers": [
      {"id": "candidate-1", "text": "Candidate Name 1"},
      {"id": "candidate-2", "text": "Candidate Name 2"}
    ]
  }'
```

## Database Architecture

Elections are stored in **PostgreSQL** (Cloud SQL), NOT Firestore:

| Component | Storage |
|-----------|---------|
| Members | Firestore (`members/{kennitala}`) |
| Elections | PostgreSQL (`elections.elections` schema) |
| Ballots | PostgreSQL (`elections.ballots` schema) |

**Connection details:**
- Database: `socialism`
- Schema: `elections`
- Tables: `elections`, `ballots`, `ballot_justifications`, `voting_tokens`, `audit_log`
- Cloud SQL Instance: `ekklesia-prod-10-2025:europe-west2:ekklesia-db`
- Proxy port: `5433`

## Security Notes

- Committee UIDs are stored in election document, NOT in user profiles
- Only users with matching Firebase UID can access
- Superusers/admins can view but NOT vote (unless in committee)
- Votes are preserved with voter identity for transparency
- The `hidden` flag controls visibility - hidden elections are not returned by API
