# Address System - Heimilisfangakerfi

Ekklesia styður þrjár gerðir heimilisfanga:

| Tegund | Lýsing | Gögn |
|--------|--------|------|
| **Iceland** | Íslenskt heimilisfang með hnitnum | `NewLocalAddress` + `map.Address` |
| **Foreign** | Erlent heimilisfang | `NewForeignAddress` (text fields) |
| **Unlocated** | Staðsetningarlaus (t.d. póstbox) | Handvirk úthlutun í sellu |

---

## hnitnum (Fasteignanúmer)

`hnitnum` er einstakur auðkenni úr íslenska fasteignaskránni (Þjóðskrá).
Það kemur frá `iceaddr` Python pakkanum sem inniheldur öll íslensk heimilisföng.

### Hvers vegna er hnitnum mikilvægt?

- **Kort:** Tengir heimilisfang við GPS hnit
- **Sella:** Ákvarðar hvaða sellu félagi tilheyrir (geometry intersection)
- **Staðfesting:** Tryggir að heimilisfangið sé gilt

**Ef hnitnum vantar:** Heimilisfangið verður ekki tengt við kort eða sellu.

### Hvernig á að fá hnitnum

#### 1. Frontend (Autocomplete)

Notaðu `search_addresses` Cloud Function:

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

#### 3. Direct SQL (hnitnum lookup)

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

Leit að heimilisföngum með autocomplete.

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

Staðfestir heimilisfang og skilar GPS hnitum.

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

## Registration API

Þegar félagi er skráður þarf að senda `address_id` (hnitnum) ef heimilisfang er íslenskt.

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

**Mikilvægt:** `address_id` er hnitnum úr iceaddr. Fáið það með `search_addresses` eða `validate_address`.

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

### Unlocated (Staðsetningarlaus)

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

Íslensk heimilisföng tengd við `map.Address`:

| Field | Type | Description |
|-------|------|-------------|
| `comrade_id` | FK → Comrade | Félagi |
| `address_id` | FK → map.Address | Tengist við kort |
| `unlocated` | bool | Staðsetningarlaus |

### NewForeignAddress (Django)

Erlend heimilisföng sem texti:

| Field | Type | Description |
|-------|------|-------------|
| `comrade_id` | FK → Comrade | Félagi |
| `country_id` | FK → Country | Land |
| `street` | str | Götuheiti |
| `postal_code` | str | Póstnúmer |
| `city` | str | Borg |

### map.Address (Django)

Íslensk heimilisföng úr Þjóðskrá:

| Field | Type | Description |
|-------|------|-------------|
| `hnitnum` | int | Fasteignanúmer (primary key) |
| `street` | FK → Street | Götuheiti |
| `number` | int | Húsnúmer |
| `letter` | str | Húsbókstafur |
| `postal_code` | FK → PostalCode | Póstnúmer |
| `geometry` | Point (ISN93) | GPS hnit |

---

## Cell Assignment

Þegar félagi er skráður með íslensku heimilisfangi er sella úthlutað sjálfvirkt:

1. Sækja `map.Address` eftir hnitnum
2. Finna sellu sem inniheldur geometry point
3. Tengja félaga við sellu

```python
from cells.models import Cell

map_address = MapAddress.objects.get(hnitnum=2000507)
cell = Cell.objects.filter(geometry__contains=map_address.geometry).first()
```

**Athugið:** Ef geometry er ekki til staðar verður félagi ekki úthlutað í sellu.

---

## iceaddr Package

Ekklesia notar `iceaddr` Python pakkann til að fletta upp íslenskum heimilisföngum.

### Installation

```bash
pip install iceaddr
```

### Usage

```python
from iceaddr import iceaddr_lookup, postcode_lookup

# Leita að heimilisfangi
results = iceaddr_lookup('Laugavegur', number=1, postcode=101)

# Fá upplýsingar um póstnúmer
postcode_info = postcode_lookup(101)
# {'postnumer': 101, 'stadur_nf': 'Reykjavík', ...}
```

### Fields from iceaddr

| iceaddr field | Our field | Description |
|---------------|-----------|-------------|
| `heiti_nf` | `street` | Götuheiti (nominative) |
| `husnr` | `number` | Húsnúmer |
| `bokst` | `letter` | Húsbókstafur |
| `postnr` | `postal_code` | Póstnúmer |
| `stadur_nf` | `city` | Borg (nominative) |
| `svfheiti` | `municipality` | Sveitarfélag |
| `lat_wgs84` | `latitude` | GPS latitude |
| `long_wgs84` | `longitude` | GPS longitude |
| `hnitnum` | `hnitnum` | Fasteignanúmer |

---

## Troubleshooting

### Heimilisfang finnst ekki

1. Athugaðu hvort póstnúmer sé rétt
2. Prófaðu án húsbókstafa (t.d. "15" í stað "15a")
3. Notaðu autocomplete til að finna rétt heimilisfang

### Félagi ekki úthlutað í sellu

1. Athugaðu hvort hnitnum sé til staðar
2. Athugaðu hvort `map.Address` sé með geometry
3. Athugaðu hvort sella sé skilgreind fyrir svæðið

### iceaddr skilar tómum niðurstöðum

1. Athugaðu hvort heimilisfang sé rétt skrifað
2. Prófaðu með nominative case (nefnifall)
3. Athugaðu hvort iceaddr sé uppfært (`pip install --upgrade iceaddr`)

---

## Related Documentation

- [API Reference](API_REFERENCE.md) - Allir API endpoints
- [ARCHITECTURE.md](ARCHITECTURE.md) - Kerfisarkitektúr
- [Django member-registration-system.md](../django/docs/api/member-registration-system.md) - Django API
