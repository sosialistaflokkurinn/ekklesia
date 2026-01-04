# Registration System (skraning.sosialistaflokkurinn.is)

## Overview

The registration system allows new members to join the party through a 3-step form. Data is written directly to Cloud SQL (PostgreSQL) via Firebase Cloud Functions.

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
- **Form steps:** 3 steps with validation at each step

### Backend
- **Cloud Function:** `register_member` (Python)
- **Location:** `services/svc-members/functions/fn_register_member.py`
- **Database module:** `services/svc-members/functions/db_registration.py`

### Database Tables (Cloud SQL)

| Table | Purpose |
|-------|---------|
| `membership_comrade` | Core member data (name, ssn, birthday, gender) |
| `membership_contactinfo` | Email, phone |
| `membership_newcomradeaddress` | Parent table for addresses (Django multi-table inheritance) |
| `membership_newlocaladdress` | Iceland addresses (links to map_address) |
| `membership_newforeignaddress` | Foreign addresses |
| `groups_comradegroupmembership` | Cell assignment |
| `membership_unionmembership` | Union membership |
| `membership_comradetitle` | Job title |
| `map_address` | Icelandic address registry (PostGIS geometry) |
| `cells_cell` | Cells with PostGIS geometry boundaries |

---

## Address Types

### 1. Iceland Address (Located)
- User types in autocomplete field (e.g., "Gullengi 31")
- `search_addresses` Cloud Function queries iceaddr database
- Returns `hnitnum` (iceaddr ID, e.g., 10144517)
- Backend looks up `map_address` by street/number/postal_code
- Cell assigned via PostGIS `ST_Contains()` on geometry

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

**Important:** `hnitnum` ≠ `map_address.id` - they are different ID systems!
- `hnitnum` = iceaddr database ID (e.g., 10144517)
- `map_address.id` = Cloud SQL ID (e.g., 13631)

### 2. Iceland Address (Unlocated)
- User checks "Ég er ekki með skráð heimilisfang"
- Selects postal code from dropdown
- `unlocated = true` in database
- Cell assigned by postal code mapping

### 3. Foreign Address
- User clicks "Ég bý erlendis"
- Selects country, enters address text
- Cell assigned by country (via `cells_cell_countries` junction table)

---

## Database Schema Details

### Django Multi-Table Inheritance

The address tables use Django's multi-table inheritance pattern:

```sql
-- Parent table (abstract base)
membership_newcomradeaddress
├── id (PK)
├── country_id (FK → map_country.id)
├── current (boolean)
├── moved_in (date)
└── moved_out (date)

-- Child table for Iceland addresses
membership_newlocaladdress
├── newcomradeaddress_ptr_id (PK, FK → parent.id)
├── comrade_id (FK → membership_comrade.id)
├── unlocated (boolean)
└── address_id (FK → map_address.id, nullable)

-- Child table for foreign addresses
membership_newforeignaddress
├── newcomradeaddress_ptr_id (PK, FK → parent.id)
├── comrade_id (FK → membership_comrade.id)
├── address (text)
├── postal_code (text)
└── municipality (text)
```

### Cell Assignment

Cells use `comradegroup_ptr_id` as their ID (Django multi-table inheritance from `groups_comradegroup`):

```sql
-- Cell lookup by PostGIS geometry
SELECT comradegroup_ptr_id as id
FROM cells_cell
WHERE ST_Contains(geometry, ST_GeomFromText('POINT(...)', 3057))
LIMIT 1;

-- Cell lookup by country (for foreign addresses)
SELECT c.comradegroup_ptr_id as id
FROM cells_cell c
JOIN cells_cell_countries cc ON c.comradegroup_ptr_id = cc.cell_id
WHERE cc.country_id = %s
LIMIT 1;
```

---

## Key Functions

### `create_member_in_cloudsql()` (db_registration.py)

Main function that creates a new member directly in Cloud SQL:

```python
def create_member_in_cloudsql(data: dict) -> dict:
    """
    Creates all related records in a single transaction:
    1. membership_comrade
    2. membership_contactinfo
    3. membership_newcomradeaddress + child table
    4. groups_comradegroupmembership (cell)
    5. membership_unionmembership (optional)
    6. membership_comradetitle (optional)
    """
```

### `find_map_address()` (db_registration.py)

Looks up `map_address` by street/number/postal_code:

```python
def find_map_address(street: str, number: int | str | None, postal_code: str) -> dict | None:
    """
    Returns: {id: map_address.id, geometry_text: WKT string}

    Uses ILIKE for case-insensitive street name matching.
    """
```

### `find_cell_by_geometry()` (db_registration.py)

Finds cell by PostGIS geometry:

```python
def find_cell_by_geometry(geometry_text: str) -> int | None:
    """
    Uses ST_Contains to find which cell contains the address point.
    Returns: cell ID (comradegroup_ptr_id)
    """
```

---

## Testing Results (January 2026)

### Test 1: Unlocated Address (No specific address)

| Step | Result |
|------|--------|
| Fill basic info | ✓ |
| Check "Ég er ekki með skráð heimilisfang" | ✓ |
| Select postal code 101 | ✓ |
| Submit | ✓ comrade_id: 3651 |
| Verify address | ✓ unlocated=true, country_id=109 |
| Verify cell | ✓ Húnaflói |

### Test 2: Iceland Address (Gullengi 31, 112 Reykjavík)

| Step | Result |
|------|--------|
| Fill basic info | ✓ |
| Type "Gullengi 31" in autocomplete | ✓ Shows suggestions |
| Select address | ✓ hnitnum: 10144517 |
| Submit | ✓ comrade_id: 3652 |
| Verify map_address | ✓ id: 13631, Gullengi 31, 112 |
| Verify cell | ✓ Grafarvogur (geometry-based) |
| Verify country | ✓ 109 (Iceland) |

### Test 3: Foreign Address (Denmark)

| Step | Result |
|------|--------|
| Fill basic info | ✓ |
| Click "Ég bý erlendis" | ✓ Shows country dropdown |
| Select "Danmörk" | ✓ country_id: 128 |
| Fill address: Vesterbrogade 123 | ✓ |
| Fill municipality: København | ✓ |
| Fill postal code: 1620 | ✓ |
| Submit | ✓ comrade_id: 3653 |
| Verify foreign address | ✓ address, postal_code, municipality stored |
| Verify country | ✓ 128 (Denmark) |
| Verify cell | ✓ Danmörk (via cells_cell_countries) |

### Autocomplete Behavior

- **Partial search** (e.g., "Gullen") → "Ekkert fannst" (not found)
- **Full address** (e.g., "Gullengi 31") → Shows matching addresses
- **Requires house number** for best results

---

## Common Issues

### 1. Autocomplete returns no results
- Include house number in search
- Street name must be in nominative case (nefnifall)
- Example: "Gullengi 31" works, "Gullengi" alone may not

### 2. Click on autocomplete option doesn't register
- UI may have timing issues
- Workaround: Use JavaScript click
```javascript
document.querySelector('a[href*="#"]').click();
```

### 3. Country ID incorrect
- Fixed in January 2026: Was getting "101" instead of "109"
- Now correctly defaults to ICELAND_COUNTRY_ID = 109

### 4. Cell not assigned
- Check PostGIS geometry in `cells_cell`
- Verify address has valid geometry in `map_address`
- For foreign addresses, verify `cells_cell_countries` mapping

---

## Deployment

### Deploy registration function
```bash
cd services/svc-members
firebase deploy --only functions:register_member
```

### Required secrets
- `django-socialism-db-password` - Cloud SQL password

### Verify deployment
```bash
gcloud functions describe register_member --region=europe-west2
```

---

## Related Files

| File | Purpose |
|------|---------|
| `functions/fn_register_member.py` | Cloud Function entry point |
| `functions/db_registration.py` | Cloud SQL operations |
| `functions/fn_search_addresses.py` | Address autocomplete API |
| `functions/fn_validate_address.py` | Address validation |

---

## Monitoring

### Check function logs
```bash
gcloud functions logs read register_member --region=europe-west2 --limit=50
```

### Verify registration in database
```sql
SELECT c.id, c.name, c.ssn, c.date_joined
FROM membership_comrade c
ORDER BY c.id DESC LIMIT 5;
```

### Check address assignment
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
