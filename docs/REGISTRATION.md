# Registration System

Member registration through skraning.sosialistaflokkurinn.is.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REGISTRATION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Step 1: Basic Info          Step 2: Address           Step 3: Details │
│   ┌─────────────────┐        ┌─────────────────┐       ┌──────────────┐ │
│   │ Name*           │        │ Iceland Address │       │ Housing      │ │
│   │ Kennitala*      │   →    │ - Autocomplete  │   →   │ Union        │ │
│   │ Email*          │        │ - Foreign       │       │ Job Title    │ │
│   │ Phone*          │        │ - Unlocated     │       │ Preferences  │ │
│   └─────────────────┘        └─────────────────┘       └──────────────┘ │
│                                                                          │
│   Frontend (static)           Firebase Function         Cloud SQL        │
│   skraning.sosialistaflokkurinn.is  register_member    PostgreSQL       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Frontend
- **Location:** Separate static site (not in Ekklesia repo)
- **URL:** https://skraning.sosialistaflokkurinn.is/
- **Form:** 3 steps with validation

### Backend
- **Cloud Function:** `register_member` (Python)
- **Location:** `services/svc-members/functions/fn_register_member.py`
- **Database:** `services/svc-members/functions/db_registration.py`

### Database Tables (Cloud SQL)

| Table | Purpose |
|-------|---------|
| `membership_comrade` | Core member data |
| `membership_contactinfo` | Email, phone |
| `membership_newcomradeaddress` | Address parent table |
| `membership_newlocaladdress` | Iceland addresses |
| `membership_newforeignaddress` | Foreign addresses |
| `groups_comradegroupmembership` | Cell assignment |
| `membership_unionmembership` | Union membership |
| `membership_comradetitle` | Job title |

---

## Address Types

See [ADDRESSES.md](ADDRESSES.md) for detailed address handling documentation.

### 1. Iceland Address (Located)

```
User types → search_addresses API → iceaddr lookup
                                          ↓
                                    hnitnum: 10144517
                                          ↓
                          find_map_address(street, number, postal_code)
                                          ↓
                                    map_address.id: 13631
                                          ↓
                          find_cell_by_geometry(geometry_text)
                                          ↓
                                    cell: Grafarvogur (2024)
```

> **Important:** `hnitnum` ≠ `map_address.id` - different ID systems!

### 2. Iceland Address (Unlocated)

- User checks "Ég er ekki með skráð heimilisfang"
- Selects postal code from dropdown
- `unlocated = true` in database
- Cell assigned by postal code mapping

### 3. Foreign Address

- User clicks "Ég bý erlendis"
- Selects country, enters address text
- Cell assigned by country (via `cells_cell_countries`)

---

## Database Schema

### Django Multi-Table Inheritance

```sql
-- Parent table
membership_newcomradeaddress
├── id (PK)
├── country_id (FK → map_country.id)
├── current (boolean)
├── moved_in (date)
└── moved_out (date)

-- Iceland addresses
membership_newlocaladdress
├── newcomradeaddress_ptr_id (PK, FK → parent.id)
├── comrade_id (FK → membership_comrade.id)
├── unlocated (boolean)
└── address_id (FK → map_address.id, nullable)

-- Foreign addresses
membership_newforeignaddress
├── newcomradeaddress_ptr_id (PK, FK → parent.id)
├── comrade_id (FK → membership_comrade.id)
├── address (text)
├── postal_code (text)
└── municipality (text)
```

### Cell Assignment SQL

```sql
-- By PostGIS geometry
SELECT comradegroup_ptr_id as id
FROM cells_cell
WHERE ST_Contains(geometry, ST_GeomFromText('POINT(...)', 3057))
LIMIT 1;

-- By country (for foreign addresses)
SELECT c.comradegroup_ptr_id as id
FROM cells_cell c
JOIN cells_cell_countries cc ON c.comradegroup_ptr_id = cc.cell_id
WHERE cc.country_id = %s
LIMIT 1;
```

---

## Key Functions

### create_member_in_cloudsql()

Creates all records in a single transaction:
1. `membership_comrade`
2. `membership_contactinfo`
3. `membership_newcomradeaddress` + child table
4. `groups_comradegroupmembership` (cell)
5. `membership_unionmembership` (optional)
6. `membership_comradetitle` (optional)

### find_map_address()

Looks up `map_address` by street/number/postal_code with ILIKE matching.

### find_cell_by_geometry()

Uses ST_Contains to find which cell contains the address point.

---

## Common Issues

### Autocomplete Returns No Results
- Include house number in search
- Street name must be in nominative case (nefnifall)
- Example: "Gullengi 31" works, "Gullengi" alone may not

### Click on Autocomplete Option Doesn't Register
- UI may have timing issues
- Workaround: `document.querySelector('a[href*="#"]').click();`

### Cell Not Assigned
- Check PostGIS geometry in `cells_cell`
- Verify address has valid geometry in `map_address`
- For foreign addresses, verify `cells_cell_countries` mapping

---

## Deployment

```bash
cd services/svc-members
firebase deploy --only functions:register_member
```

### Required Secrets
- `django-socialism-db-password` - Cloud SQL password

### Verify
```bash
gcloud functions describe register_member --region=europe-west2
```

---

## Related Files

| File | Purpose |
|------|---------|
| `functions/fn_register_member.py` | Cloud Function entry |
| `functions/db_registration.py` | Cloud SQL operations |
| `functions/fn_search_addresses.py` | Address autocomplete |
| `functions/fn_validate_address.py` | Address validation |

---

## Monitoring

### Function Logs
```bash
gcloud functions logs read register_member --region=europe-west2 --limit=50
```

### Verify in Database
```sql
SELECT c.id, c.name, c.ssn, c.date_joined
FROM membership_comrade c
ORDER BY c.id DESC LIMIT 5;
```

### Check Address Assignment
```sql
SELECT
    nla.comrade_id,
    nla.unlocated,
    nla.address_id,
    nca.country_id
FROM membership_newlocaladdress nla
JOIN membership_newcomradeaddress nca ON nla.newcomradeaddress_ptr_id = nca.id
WHERE nla.comrade_id = ?;
```
