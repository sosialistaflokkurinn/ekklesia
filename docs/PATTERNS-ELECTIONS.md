# Elections System Patterns

## Overview

The Ekklesia platform has **two separate election systems** with different purposes and rules:

| System | Path | Purpose | Results Visibility |
|--------|------|---------|-------------------|
| **Admin Elections** | `/admin-elections/` | General member voting | Immediate (when closed) |
| **Nomination** | `/nomination/` | Committee nominations | Locked until all vote |

## Election Types

### Admin Elections (`/admin-elections/`)

Supports three voting types:

| Type | API Value | Description |
|------|-----------|-------------|
| **Eitt val** | `single-choice` | Members select one option (radio buttons) |
| **Mörg val** | `multi-choice` | Members select multiple options (checkboxes) |
| **Forgangsröðun** | `ranked-choice` | Members rank options in preference order |

#### Ranked Choice (Forgangsröðun)

- Uses STV (Single Transferable Vote) algorithm
- Requires `num_seats` parameter (number of winners)
- Results show: Winners, First-choice distribution, Full rankings

### Nomination Committee (`/nomination/`)

Committee nomination elections with special rules:
- Results locked until ALL committee members have voted
- Uses ranked-choice voting exclusively
- Shows individual votes with justifications after completion

## File Structure

```
apps/members-portal/
├── admin-elections/           # General elections admin
│   ├── index.html             # Elections list
│   ├── create.html            # Create wizard (3 steps)
│   ├── election-control.html  # Control panel
│   ├── results.html           # Results viewer
│   ├── i18n/
│   │   ├── strings-loader.js
│   │   ├── values-is/admin-elections-strings.xml
│   │   └── values-en/admin-elections-strings.xml
│   └── js/
│       ├── elections-list.js
│       ├── election-create.js
│       ├── election-control.js
│       ├── election-results.js
│       ├── election-create-i18n.js
│       ├── api/
│       │   ├── elections-admin-api.js    # Real API client
│       │   └── elections-admin-mock.js   # Mock for testing
│       ├── forms/
│       │   └── election-form-data.js     # Form data handling
│       └── validation/
│           └── election-validation.js
│
└── nomination/                # Committee nominations
    ├── index.html             # Election list
    ├── vote.html              # Voting interface
    ├── results.html           # Results (locked until complete)
    └── js/
        ├── nomination.js
        ├── nomination-vote.js
        └── nomination-results.js
```

## API Endpoints

### Elections Service

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

### Vote Payload Examples

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

## Create Election Payload

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

## i18n Pattern

Elections use XML-based i18n with the `AdminElectionsStringsLoader` class:

```javascript
import { R } from '../i18n/strings-loader.js';

// Load strings
await R.load('is');

// Access strings
const label = R.string.voting_type_single;

// Format with placeholders
const formatted = R.format(R.string.duration_minutes, 30);
```

XML structure:
```xml
<resources>
  <string name="voting_type_single">Eitt val</string>
  <string name="voting_type_multi">Mörg val</string>
  <string name="voting_type_ranked">Forgangsröðun</string>
</resources>
```

## Election Status Flow

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

## Results Display

### Admin Elections Results

Shows immediately when election is closed:
- Summary: Total votes, options count, status
- Vote distribution table with percentages
- Bar chart visualization
- Winner badge for highest vote getter
- Export to CSV option

### Uppstilling Results

Locked until all committee members vote:
- Average rankings table
- STV winners with Droop quota
- Individual votes with justifications

## Testing Elections

### Create Test Election via API

```bash
# 1. Create
curl -X POST "$API/admin/elections" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Test", "question": "?", "type": "single_choice", "answers": [{"text": "Yes"}, {"text": "No"}]}'

# 2. Open
curl -X POST "$API/admin/elections/{id}/open" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"voting_starts_at": "2025-01-01T00:00:00Z", "voting_ends_at": "2025-01-02T00:00:00Z"}'

# 3. Vote (member endpoint - no /admin/)
curl -X POST "$API/elections/{id}/vote" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"answer_ids": ["Yes"]}'

# 4. Close
curl -X POST "$API/admin/elections/{id}/close" \
  -H "Authorization: Bearer $TOKEN"
```

## Deployment

```bash
cd ~/Development/projects/ekklesia/services/svc-members
firebase deploy --only hosting
```

Note: JS files use version parameters (`?v=YYYYMMDD`) for cache busting. Update when making JS changes.
