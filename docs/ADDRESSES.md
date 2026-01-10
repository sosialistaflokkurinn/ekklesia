# Address System - Heimilisfangakerfi

Ekklesia supports three address types:

| Type | Description | Data Source |
|------|-------------|-------------|
| **Iceland** | Icelandic address with hnitnum | `NewLocalAddress` + `map.Address` |
| **Foreign** | Foreign address | `NewForeignAddress` (text fields) |
| **Unlocated** | Locationless (e.g., P.O. box) | Manual cell assignment |

---

## hnitnum (Fasteignanúmer)

`hnitnum` is a unique identifier from the Icelandic property registry (Þjóðskrá), provided by the `iceaddr` Python package.

### Why hnitnum Matters

| Purpose | Description |
|---------|-------------|
| **Map** | Links address to GPS coordinates |
| **Cell** | Determines member's cell (geometry intersection) |
| **Validation** | Ensures address is valid |

**If hnitnum is missing:** Address won't be linked to map or cell.

### Getting hnitnum

#### 1. Frontend (Autocomplete)

```javascript
const functions = getFunctions(app, 'europe-west2');
const searchAddresses = httpsCallable(functions, 'search_addresses');

const result = await searchAddresses({ query: 'Laugavegur 1', limit: 10 });
// result.data.results[0].hnitnum = 2000507
```

#### 2. Python (iceaddr library)

```python
from iceaddr import iceaddr_lookup

results = iceaddr_lookup('Laugavegur', number=1, postcode=101)
# results[0]['hnitnum'] = 2000507
```

#### 3. Direct SQL

```python
from iceaddr.db import shared_db

conn = shared_db.connection()
cursor = conn.cursor()
cursor.execute('SELECT * FROM stadfong WHERE hnitnum = ?', (2000507,))
row = cursor.fetchone()
# row['heiti_nf'] = 'Laugavegur'
```

---

## API Endpoints

### search_addresses (Firebase Function)

Address search with autocomplete.

**Request:**
```json
{
  "query": "Laugavegur 1",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "street": "Laugavegur",
      "number": "1",
      "letter": "",
      "postal_code": "101",
      "city": "Reykjavík",
      "municipality": "Reykjavíkurborg",
      "latitude": 64.1466,
      "longitude": -21.9426,
      "hnitnum": 2000507,
      "display": "Laugavegur 1, 101 Reykjavík"
    }
  ]
}
```

### validate_address (Firebase Function)

Validates address and returns GPS coordinates.

**Request:**
```json
{
  "street": "Laugavegur",
  "number": "1",
  "postal_code": "101"
}
```

**Response:**
```json
{
  "valid": true,
  "address": {
    "street": "Laugavegur",
    "number": "1",
    "postal_code": "101",
    "city": "Reykjavík",
    "latitude": 64.1466,
    "longitude": -21.9426,
    "hnitnum": 2000507
  }
}
```

---

## Registration API Payloads

### Iceland Address

```json
{
  "name": "Jón Jónsson",
  "ssn": "0000000000",
  "email": "jon@example.is",
  "phone": "5551234",
  "address_type": "iceland",
  "address_id": 2000507
}
```

> **Note:** `address_id` is hnitnum from iceaddr.

### Foreign Address

```json
{
  "name": "Jón Jónsson",
  "ssn": "0000000000",
  "email": "jon@example.is",
  "phone": "5551234",
  "address_type": "foreign",
  "country_id": 45,
  "foreign_address": "123 Main Street",
  "foreign_municipality": "London",
  "foreign_postal_code": "SW1A 1AA"
}
```

### Unlocated

```json
{
  "name": "Jón Jónsson",
  "ssn": "0000000000",
  "email": "jon@example.is",
  "phone": "5551234",
  "address_type": "unlocated",
  "cell_id": 5
}
```

---

## Database Models

### NewLocalAddress (Django)

Icelandic addresses linked to `map.Address`:

| Field | Type | Description |
|-------|------|-------------|
| `comrade_id` | FK → Comrade | Member |
| `address_id` | FK → map.Address | Map link |
| `unlocated` | bool | Locationless |

### NewForeignAddress (Django)

Foreign addresses as text:

| Field | Type | Description |
|-------|------|-------------|
| `comrade_id` | FK → Comrade | Member |
| `country_id` | FK → Country | Country |
| `street` | str | Street name |
| `postal_code` | str | Postal code |
| `city` | str | City |

### map.Address (Django)

Icelandic addresses from Þjóðskrá:

| Field | Type | Description |
|-------|------|-------------|
| `hnitnum` | int | Property ID (PK) |
| `street` | FK → Street | Street name |
| `number` | int | House number |
| `letter` | str | House letter |
| `postal_code` | FK → PostalCode | Postal code |
| `geometry` | Point (ISN93) | GPS coordinates |

---

## Cell Assignment

When a member registers with an Icelandic address:

1. Get `map.Address` by hnitnum
2. Find cell containing geometry point
3. Link member to cell

```python
from cells.models import Cell

map_address = MapAddress.objects.get(hnitnum=2000507)
cell = Cell.objects.filter(geometry__contains=map_address.geometry).first()
```

> **Note:** If geometry is missing, member won't be assigned to a cell.

---

## iceaddr Package

### Installation

```bash
pip install iceaddr
```

### Usage

```python
from iceaddr import iceaddr_lookup, postcode_lookup

# Search address
results = iceaddr_lookup('Laugavegur', number=1, postcode=101)

# Get postal code info
postcode_info = postcode_lookup(101)
# {'postnumer': 101, 'stadur_nf': 'Reykjavík', ...}
```

### Field Mapping

| iceaddr field | Our field | Description |
|---------------|-----------|-------------|
| `heiti_nf` | `street` | Street (nominative) |
| `husnr` | `number` | House number |
| `bokst` | `letter` | House letter |
| `postnr` | `postal_code` | Postal code |
| `stadur_nf` | `city` | City (nominative) |
| `svfheiti` | `municipality` | Municipality |
| `lat_wgs84` | `latitude` | GPS latitude |
| `long_wgs84` | `longitude` | GPS longitude |
| `hnitnum` | `hnitnum` | Property ID |

---

## iceaddr Debugging

The `iceaddr` package returns **dictionaries**, not tuples:

```python
# CORRECT - dict-style access
from iceaddr.db import shared_db

conn = shared_db.connection()
cursor = conn.cursor()
cursor.execute('SELECT * FROM stadfong WHERE hnitnum = ?', (hnitnum,))
row = cursor.fetchone()

if row:
    street = row['heiti_nf']    # Dict key access
    number = row['husnr']

# WRONG - tuple index access
street = row[1]   # KeyError: 1
```

> **Lesson:** Don't assume SQLite returns tuples. Check the library's row_factory.

---

## Troubleshooting

### Address Not Found

1. Check postal code is correct
2. Try without house letter (e.g., "15" instead of "15a")
3. Use autocomplete to find exact address

### Member Not Assigned to Cell

1. Check hnitnum is present
2. Check `map.Address` has geometry
3. Check cell is defined for the area

### iceaddr Returns Empty

1. Check address spelling
2. Use nominative case (nefnifall)
3. Update iceaddr: `pip install --upgrade iceaddr`

---

## Related Documentation

- [REGISTRATION.md](REGISTRATION.md) - Registration flow
- [../API_REFERENCE.md](../API_REFERENCE.md) - All API endpoints
- [../ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
