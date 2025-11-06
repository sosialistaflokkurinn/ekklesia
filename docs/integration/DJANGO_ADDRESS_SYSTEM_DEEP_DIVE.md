# Django Address System - Deep Dive

**Document Type**: Technical Reference - Address System Architecture
**Last Updated**: 2025-10-31
**Status**: ✅ Active - Required Reading for Address Integration
**Purpose**: Comprehensive explanation of Django address database schema, serializer system, and API integration

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Schema Architecture](#database-schema-architecture)
3. [Django Model Relationships](#django-model-relationships)
4. [Serializer System](#serializer-system)
5. [API Integration](#api-integration)
6. [Common Pitfalls](#common-pitfalls)
7. [Bug History](#bug-history)
8. [Testing Guide](#testing-guide)

---

## Executive Summary

Django stores member addresses using a complex **multi-table relational structure** that integrates with Iceland's national address registry. Understanding this system is critical for:

- Epic #43 member sync to Firestore
- Epic #116 member edit functionality
- Address display in member portal
- Address updates via admin UI

**Key Stats** (Verified 2025-10-31):
- **1,975 members** have valid addresses in Django database
- **0 members** currently have addresses synced to Firestore (bug identified)
- **5 database tables** work together to store one address

---

## Database Schema Architecture

### Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Member Address System                            │
└─────────────────────────────────────────────────────────────────────┘

  membership_comrade (Members)
         │
         │ 1:1
         ▼
  membership_contactinfo (Phone/Email/Facebook)


  membership_comrade (Members)
         │
         │ 1:Many
         ▼
  membership_newcomradeaddress (Base Address - Abstract)
         │
         ├─────────────────┬─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  membership_new         (inherits)     (inherits)
  localaddress
   (Iceland)
         │
         │ Many:1
         ▼
  map_address (Address Registry)
         │
         │ Many:1
         ▼
  map_street (Street Names)
         │
         ├──────────────┬──────────────┐
         │ Many:1       │ Many:1       │
         ▼              ▼              ▼
  map_postalcode   map_municipality
  (Postal Codes)   (Cities/Towns)
```

---

### Table-by-Table Breakdown

#### 1. `membership_comrade` (The Member)

**Purpose**: Main member table - source of truth for all member data

**Key Fields**:
```python
id: 813                           # Primary key
name: "Jón Jónsson"              # Full name
ssn: "0101901234"                # Kennitala (10 digits, no hyphen)
date_joined: 2022-10-15          # Membership start date
```

**Relationship to addresses**: One member → Many addresses (via `local_addresses` relationship)

**Django Model**:
```python
class Comrade(models.Model):
    name = models.CharField(max_length=250)
    ssn = models.CharField(max_length=10)
    # ... other fields ...

    # This creates the REVERSE relationship!
    # Django automatically creates: comrade.local_addresses.all()
```

---

#### 2. `membership_contactinfo` (Contact Details)

**Purpose**: Stores phone, email, Facebook (1:1 with member)

**Key Fields**:
```python
comrade_id: 813                   # FK to membership_comrade (ALSO primary key!)
phone: "5551234"                 # Phone number
email: "example@example.com"      # Email address
facebook: None                   # Facebook profile URL (optional)
```

**Schema**:
```sql
CREATE TABLE membership_contactinfo (
    comrade_id INTEGER PRIMARY KEY REFERENCES membership_comrade(id),
    phone VARCHAR(32),
    email VARCHAR(124),
    facebook VARCHAR(255)
);
```

**Relationship**: 1:1 (one contact info per member)

**Django Model**:
```python
class ContactInfo(models.Model):
    comrade = models.OneToOneField(
        'Comrade',
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='contact_info'
    )
    phone = models.CharField(max_length=32)
    email = models.CharField(max_length=124)
    facebook = models.CharField(max_length=255)
```

**ORM Access**:
```python
comrade = Comrade.objects.get(id=813)
phone = comrade.contact_info.phone    # ✅ 1:1 relationship (no .all())
email = comrade.contact_info.email
```

---

#### 3. `membership_newcomradeaddress` (Base Address Class)

**Purpose**: Base table for all address types (Django inheritance pattern)

**Key Fields**:
```python
id: 1157                         # Primary key (for address record)
country_id: 1                    # FK to map_country
current: True                    # Is this the current address?
moved_in: 2022-01-01            # Date moved in
moved_out: None                  # Date moved out (null = still living there)
```

**Schema**:
```sql
CREATE TABLE membership_newcomradeaddress (
    id SERIAL PRIMARY KEY,
    country_id INTEGER REFERENCES map_country(id),
    current BOOLEAN DEFAULT TRUE,
    moved_in DATE,
    moved_out DATE
);
```

**Django Model**:
```python
class NewComradeAddress(models.Model):
    """Base class for all address types"""
    country = models.ForeignKey('map.Country', on_delete=models.SET_NULL, null=True)
    current = models.BooleanField(default=True)
    moved_in = models.DateField(null=True, blank=True)
    moved_out = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = 'heimilisfang'
        verbose_name_plural = 'heimilisföng'
```

**Important**: This is an **abstract base class** in Django's multi-table inheritance pattern!

---

#### 4. `membership_newlocaladdress` (Iceland Address)

**Purpose**: Links member to Iceland address registry (inherits from NewComradeAddress)

**Key Fields**:
```python
newcomradeaddress_ptr_id: 1157   # FK to parent table (also PK!)
comrade_id: 813                  # FK to membership_comrade
address_id: 13634                # FK to map_address (the actual address!)
unlocated: False                 # Address not found in map system?
```

**Schema**:
```sql
CREATE TABLE membership_newlocaladdress (
    newcomradeaddress_ptr_id INTEGER PRIMARY KEY
        REFERENCES membership_newcomradeaddress(id),
    comrade_id INTEGER REFERENCES membership_comrade(id),
    address_id INTEGER REFERENCES map_address(id),
    unlocated BOOLEAN DEFAULT FALSE
);
```

**Django Model**:
```python
class NewLocalAddress(NewComradeAddress):
    """Iceland address - inherits from NewComradeAddress"""
    unlocated = models.BooleanField(blank=True, default=False)
    address = models.ForeignKey(
        'map.Address',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='staðfang'
    )
    comrade = models.ForeignKey(
        'Comrade',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='local_addresses'  # ← This creates comrade.local_addresses!
    )
```

**ORM Access**:
```python
comrade = Comrade.objects.get(id=813)

# Get all addresses for member
all_addresses = comrade.local_addresses.all()  # QuerySet[NewLocalAddress]

# Get CURRENT address only
current_address = comrade.local_addresses.filter(current=True).first()
# Returns: NewLocalAddress(id=1157, address_id=13634, current=True)
```

**Critical Understanding**:
- One member can have MANY addresses (historical + current)
- `current=True` marks which address is actively used
- `address_id` points to Iceland's address registry

---

#### 5. `map_address` (Iceland Address Registry)

**Purpose**: National address database for ALL of Iceland (not just members)

**Key Fields**:
```python
id: 13634                        # Primary key
number: 5                       # House number
letter: ""                       # House letter (e.g., "A", "B")
extra: ""                        # Extra info (apt #, floor)
special: ""                      # Special notes
geometry: <Point(...)>           # GPS coordinates (PostGIS)
street_id: 5492                  # FK to map_street
```

**Schema**:
```sql
CREATE TABLE map_address (
    id SERIAL PRIMARY KEY,
    number INTEGER,
    letter VARCHAR(16),
    extra VARCHAR(64),
    special VARCHAR(128),
    geometry GEOMETRY(Point, 3857),  -- PostGIS spatial data
    street_id INTEGER REFERENCES map_street(id)
);
```

**Example Row**:
```
id: 13634
number: 5
letter: (empty string)
street_id: 5492  ──→ map_street(id=5492, name="Laufásvegur")
```

**Important**: This table contains EVERY address in Iceland, not just member addresses!

---

#### 6. `map_street` (Street Registry)

**Purpose**: Street names with postal codes and municipalities

**Key Fields**:
```python
id: 5492                         # Primary key
name: "Laufásvegur"                 # Street name
postal_code_id: 48               # FK to map_postalcode
municipality_id: 7               # FK to map_municipality
```

**Schema**:
```sql
CREATE TABLE map_street (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128),
    postal_code_id INTEGER REFERENCES map_postalcode(id),
    municipality_id INTEGER REFERENCES map_municipality(id)
);
```

**Django Model**:
```python
class Street(models.Model):
    name = models.CharField(max_length=128)
    postal_code = models.ForeignKey('PostalCode', on_delete=models.CASCADE)
    municipality = models.ForeignKey('Municipality', on_delete=models.CASCADE)
```

---

#### 7. `map_postalcode` (Postal Codes)

**Purpose**: Iceland postal codes (e.g., 101, 112, 200)

**Key Fields**:
```python
id: 48                           # Primary key
code: 112                        # Postal code
```

**Schema**:
```sql
CREATE TABLE map_postalcode (
    id SERIAL PRIMARY KEY,
    code INTEGER UNIQUE
);
```

**Example Rows**:
```
id: 1,  code: 101  (Reykjavík city center)
id: 48, code: 112  (Reykjavík - Grafarvogur)
id: 95, code: 200  (Kópavogur)
```

---

#### 8. `map_municipality` (Cities/Towns)

**Purpose**: Iceland municipalities (sveitarfélög)

**Key Fields**:
```python
id: 7                            # Primary key
name: "Reykjavík"                # Municipality name
```

**Schema**:
```sql
CREATE TABLE map_municipality (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) UNIQUE
);
```

**Example Rows**:
```
id: 7,  name: "Reykjavík"
id: 8,  name: "Kópavogur"
id: 12, name: "Akureyri"
```

---

### Full Join Example: Get Complete Address

To fetch a complete address for member (ID 813):

```sql
SELECT
    c.id AS member_id,
    c.name AS member_name,
    s.name AS street_name,
    a.number AS house_number,
    a.letter AS house_letter,
    pc.code AS postal_code,
    m.name AS city,
    nca.current AS is_current_address
FROM membership_comrade c
JOIN membership_newlocaladdress nla ON nla.comrade_id = c.id
JOIN membership_newcomradeaddress nca ON nca.id = nla.newcomradeaddress_ptr_id
JOIN map_address a ON a.id = nla.address_id
JOIN map_street s ON s.id = a.street_id
JOIN map_postalcode pc ON pc.id = s.postal_code_id
JOIN map_municipality m ON m.id = s.municipality_id
WHERE c.id = 813 AND nca.current = TRUE;
```

**Result**:
```
member_id: 813
member_name: "Jón Jónsson"
street_name: "Laufásvegur"
house_number: 5
house_letter: ""
postal_code: 112
city: "Reykjavík"
is_current_address: true
```

**Formatted Address**: `Laufásvegur 5, 112 Reykjavík`

---

## Django Model Relationships

### Relationship Hierarchy

```python
# Member (Comrade)
comrade = Comrade.objects.get(id=813)

# 1:1 Contact Info
comrade.contact_info              # ← ContactInfo object (NOT a QuerySet!)
comrade.contact_info.phone        # ← "7758493"

# 1:Many Addresses
comrade.local_addresses           # ← RelatedManager (use .all(), .filter())
comrade.local_addresses.all()     # ← QuerySet[NewLocalAddress, ...]
comrade.local_addresses.filter(current=True).first()  # ← Current address only

# Address → Map System
local_addr = comrade.local_addresses.filter(current=True).first()
local_addr.address                # ← map_address object
local_addr.address.number         # ← 37
local_addr.address.street         # ← map_street object
local_addr.address.street.name    # ← "Gullengi"
local_addr.address.street.postal_code.code  # ← 112
local_addr.address.street.municipality.name # ← "Reykjavík"
```

### Key Insight: `related_name` Parameter

When Django defines a ForeignKey, it creates a **reverse relationship**:

```python
class NewLocalAddress(models.Model):
    comrade = models.ForeignKey(
        'Comrade',
        on_delete=models.SET_NULL,
        related_name='local_addresses'  # ← This creates the reverse lookup!
    )
```

**What this means**:
- `NewLocalAddress` → `comrade` (forward relationship)
- `Comrade` → `local_addresses` (reverse relationship, AUTO-CREATED by Django!)

**Usage**:
```python
# Forward: address → comrade
address = NewLocalAddress.objects.get(id=1157)
member = address.comrade  # ← Comrade object

# Reverse: comrade → addresses
comrade = Comrade.objects.get(id=813)
addresses = comrade.local_addresses.all()  # ← QuerySet[NewLocalAddress]
```

---

## Serializer System

### What is a Django REST Framework Serializer?

A **serializer** transforms complex Django ORM objects into JSON (and vice versa).

**Process**:
```
Django ORM Object → Serializer → JSON (for API response)
JSON (from request) → Serializer → Django ORM Object (for save/update)
```

---

### Serializer Field Types

#### 1. `SerializerMethodField()` (Read-Only, Custom Logic)

**Purpose**: Call a custom method to compute field value

**Syntax**:
```python
class MySerializer(serializers.ModelSerializer):
    computed_field = serializers.SerializerMethodField()

    def get_computed_field(self, obj):
        """
        This method is called automatically when serializing.
        `obj` is the Django model instance (e.g., Comrade)
        """
        # Custom logic here
        return some_computed_value
```

**Example**: Address Serialization
```python
class ComradeFullSerializer(serializers.ModelSerializer):
    local_address = serializers.SerializerMethodField()

    def get_local_address(self, obj):
        """
        obj = Comrade instance (e.g., Comrade(id=813))
        """
        # Find current address
        local_addr = obj.local_addresses.filter(current=True).first()

        if local_addr:
            # Serialize the address
            return AddressSerializer(local_addr).data

        return None
```

**When Django calls this**:
```python
comrade = Comrade.objects.get(id=813)
serializer = ComradeFullSerializer(comrade)
data = serializer.data  # ← Django calls get_local_address(comrade) HERE!

# Result:
# {
#   "id": 813,
#   "name": "Jón Jónsson",
#   "local_address": {     ← from get_local_address()
#     "street": "Laufásvegur",
#     "number": 5,
#     "postal_code": 112,
#     "city": "Reykjavík"
#   }
# }
```

**Key Points**:
- ✅ **Read-only** (cannot write to this field via API)
- ✅ **Custom logic** (full control over value)
- ✅ **Always called** during serialization
- ❌ **Cannot accept input** from API requests

---

#### 2. `DictField()` (Read-Write, No Custom Logic)

**Purpose**: Accept/return a dictionary directly from model attribute

**Syntax**:
```python
class MySerializer(serializers.ModelSerializer):
    metadata = serializers.DictField()
```

**How it works**:
```python
# Django expects the model to have this attribute:
class MyModel(models.Model):
    metadata = models.JSONField()  # ← Must exist on model!

# Serialization:
obj = MyModel(metadata={"key": "value"})
serializer = MySerializer(obj)
serializer.data  # {"metadata": {"key": "value"}}
```

**Critical Limitation**:
- Requires model to have the attribute (e.g., `obj.local_address`)
- **Does NOT call any get_* methods**
- Cannot use custom logic

---

### Address Serializer Implementation

#### `AddressSerializer` (Helper)

**Purpose**: Transform `NewLocalAddress` ORM object → JSON

```python
class AddressSerializer(serializers.Serializer):
    """Serialize address from NewLocalAddress → JSON"""
    street = serializers.SerializerMethodField()
    number = serializers.SerializerMethodField()
    letter = serializers.SerializerMethodField()
    postal_code = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()

    def get_street(self, obj):
        """
        obj = NewLocalAddress instance
        obj.address = map_address instance
        obj.address.street = map_street instance
        """
        try:
            if hasattr(obj, 'address') and obj.address:
                return obj.address.street.name  # "Gullengi"
        except:
            pass
        return None

    def get_number(self, obj):
        try:
            if hasattr(obj, 'address') and obj.address:
                return obj.address.number  # 37
        except:
            pass
        return None

    def get_postal_code(self, obj):
        try:
            if hasattr(obj, 'address') and obj.address and obj.address.street:
                return obj.address.street.postal_code.code  # 112
        except:
            pass
        return None

    def get_city(self, obj):
        try:
            if hasattr(obj, 'address') and obj.address and obj.address.street:
                return obj.address.street.municipality.name  # "Reykjavík"
        except:
            pass
        return None
```

**Input**: `NewLocalAddress` object with relationships loaded
**Output**:
```json
{
  "street": "Laufásvegur",
  "number": 5,
  "letter": "",
  "postal_code": 112,
  "city": "Reykjavík"
}
```

---

#### `ComradeFullSerializer` (Main Serializer)

**Purpose**: Transform `Comrade` ORM object → Complete JSON including address

```python
class ComradeFullSerializer(serializers.ModelSerializer):
    """Full member serializer including address"""

    # Other fields
    contact_info = ContactInfoSerializer(required=False)
    unions = UnionSerializer(source='union_memberships', many=True, read_only=True)
    titles = TitleSerializer(many=True, read_only=True)

    # ✅ CORRECT: Use SerializerMethodField to call get_local_address()
    local_address = serializers.SerializerMethodField()

    class Meta:
        model = Comrade
        fields = (
            'id', 'name', 'ssn', 'birthday', 'date_joined',
            'contact_info', 'unions', 'titles',
            'local_address',  # ← This field
        )

    def get_local_address(self, obj):
        """
        obj = Comrade instance
        Returns address dict or None
        """
        try:
            # Find current address
            local_addr = obj.local_addresses.filter(current=True).first()

            if local_addr:
                # Use AddressSerializer to format it
                return AddressSerializer(local_addr).data
        except Exception as e:
            # Log error but don't crash
            pass

        return None
```

---

### Query Optimization: `prefetch_related()`

**Problem**: Each address lookup triggers a database query ("N+1 problem")

```python
# BAD: 1 query for members + 1 query PER MEMBER for address
members = Comrade.objects.all()
for member in members:
    addr = member.local_addresses.filter(current=True).first()  # ← NEW QUERY!
```

**Solution**: Prefetch all relationships in ONE query

```python
# GOOD: 1 query for members + 1 query for ALL addresses
members = Comrade.objects.prefetch_related(
    'local_addresses__address__street__postal_code',
    'local_addresses__address__street__municipality',
).all()

for member in members:
    addr = member.local_addresses.filter(current=True).first()  # ← NO NEW QUERY!
```

**Django ORM Magic**:
- `prefetch_related()` loads ALL related objects in one query
- Django caches them in memory
- Future lookups are instant (no DB hit)

---

## API Integration

### API ViewSet Implementation

```python
class ComradeFullViewSet(viewsets.ModelViewSet):
    """API endpoint for full member data"""

    # CRITICAL: Prefetch all address relationships!
    queryset = Comrade.objects.all().select_related(
        'contact_info',
    ).prefetch_related(
        'union_memberships',
        'titles',
        'local_addresses__address__street__postal_code',    # ← Address prefetch!
        'local_addresses__address__street__municipality',   # ← Address prefetch!
        'foreign_addresses',
    ).order_by('id')

    serializer_class = ComradeFullSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsStaffUser]
```

**Why this works**:
1. Django loads ALL members
2. Django prefetches ALL addresses (one query)
3. Django prefetches ALL streets, postal codes, municipalities (separate queries)
4. Serializer has all data cached in memory
5. `get_local_address()` runs without hitting database

---

### API Request Flow

```
1. Client Request
   ↓
   GET https://starf.sosialistaflokkurinn.is/felagar/api/full/813/
   Header: Authorization: Token abc123...

2. Django REST Framework
   ↓
   - Authenticates token
   - Checks permissions (IsStaffUser)
   - Finds ViewSet: ComradeFullViewSet

3. Django ORM
   ↓
   SELECT * FROM membership_comrade WHERE id = 813;
   SELECT * FROM membership_contactinfo WHERE comrade_id = 813;
   SELECT * FROM membership_newlocaladdress WHERE comrade_id = 813;
   SELECT * FROM map_address WHERE id IN (13634);
   SELECT * FROM map_street WHERE id IN (5492);
   SELECT * FROM map_postalcode WHERE id IN (48);
   SELECT * FROM map_municipality WHERE id IN (7);

4. Serializer
   ↓
   ComradeFullSerializer(comrade)
   - Calls get_local_address(comrade)
   - Filters: comrade.local_addresses.filter(current=True).first()
   - Returns: NewLocalAddress(id=1157, address_id=13634)
   - Calls AddressSerializer(local_addr)
   - Accesses: local_addr.address.street.name (already cached!)

5. JSON Response
   ↓
   {
     "id": 813,
     "name": "Jón Jónsson",
     "local_address": {
       "street": "Laufásvegur",
       "number": 5,
       "postal_code": 112,
       "city": "Reykjavík"
     }
   }
```

---

## Common Pitfalls

### Pitfall #1: Using DictField for Relationships

❌ **WRONG**:
```python
class ComradeFullSerializer(serializers.ModelSerializer):
    local_address = serializers.DictField(required=False, allow_null=True)
```

**Why this fails**:
1. Django expects `obj.local_address` attribute (doesn't exist!)
2. Model has `obj.local_addresses` (plural, relationship)
3. `get_local_address()` method is NEVER called
4. API returns `null` for all members

✅ **CORRECT**:
```python
class ComradeFullSerializer(serializers.ModelSerializer):
    local_address = serializers.SerializerMethodField()

    def get_local_address(self, obj):
        local_addr = obj.local_addresses.filter(current=True).first()
        if local_addr:
            return AddressSerializer(local_addr).data
        return None
```

---

### Pitfall #2: Forgetting Prefetch

❌ **WRONG**:
```python
queryset = Comrade.objects.all()  # ← No prefetch!
```

**Result**: N+1 query problem (thousands of queries for 2,000 members)

✅ **CORRECT**:
```python
queryset = Comrade.objects.prefetch_related(
    'local_addresses__address__street__postal_code',
    'local_addresses__address__street__municipality',
).all()
```

**Result**: ~5 queries total (optimal)

---

### Pitfall #3: Assuming 1:1 Relationship

❌ **WRONG**:
```python
# Assuming only ONE address per member
address = obj.local_addresses.first()  # ← Could be old address!
```

**Problem**: Members can have multiple addresses (historical + current)

✅ **CORRECT**:
```python
# Filter for CURRENT address only
address = obj.local_addresses.filter(current=True).first()
```

---

### Pitfall #4: Not Handling None

❌ **WRONG**:
```python
def get_street(self, obj):
    return obj.address.street.name  # ← Crashes if address is None!
```

✅ **CORRECT**:
```python
def get_street(self, obj):
    try:
        if hasattr(obj, 'address') and obj.address:
            return obj.address.street.name
    except:
        pass
    return None
```

---

## Bug History

### Epic #116 Address Sync Bug (2025-10-31)

**Discovered**: 2025-10-31
**Status**: ✅ Identified, Fix Ready

#### What Happened

Epic #116 added write functionality to Django API (allow updates via admin UI). During implementation, `local_address` field was changed from `SerializerMethodField()` to `DictField()` to allow accepting address updates.

**Original Code** (Epic #43 - Working):
```python
class ComradeFullSerializer(serializers.ModelSerializer):
    local_address = serializers.SerializerMethodField()

    def get_local_address(self, obj):
        local_addr = obj.local_addresses.filter(current=True).first()
        if local_addr:
            return AddressSerializer(local_addr).data
        return None
```

**Changed Code** (Epic #116 - Broken):
```python
class ComradeFullSerializer(serializers.ModelSerializer):
    # Epic #116: Allow updates via custom update method
    local_address = serializers.DictField(required=False, allow_null=True)
```

#### Why It Broke

1. `DictField` expects model to have `local_address` attribute (doesn't exist)
2. `get_local_address()` method no longer called (not a SerializerMethodField)
3. Django returns `null` for non-existent attributes
4. API returns `"local_address": null` for ALL members
5. Firestore sync receives null → empty address fields

#### Impact

- ❌ 1,975 member addresses NOT synced to Firestore
- ❌ Members see no address in member portal
- ❌ Admins see no address in admin UI
- ✅ Database intact (no data loss)
- ✅ Epic #116 updates work for other fields

#### The Fix

**Change ONE line** in `/home/manager/socialism/membership/serializers.py`:

```python
# Line ~127 - CHANGE THIS:
local_address = serializers.DictField(required=False, allow_null=True)

# TO THIS:
local_address = serializers.SerializerMethodField()
```

**Why this works**:
- Restores read functionality (calls `get_local_address()`)
- Write functionality preserved (handled in `update()` method)
- No breaking changes to Epic #116

**Deployment**:
```bash
# Option 1: Automated
/tmp/apply_django_fix.sh

# Option 2: Manual
ssh root@172.105.71.207
nano /home/manager/socialism/membership/serializers.py
# (edit line 127)
sudo systemctl restart socialism
```

**Verification**:
```bash
DJANGO_API_TOKEN=$(gcloud secrets versions access latest --secret=django-api-token --project=ekklesia-prod-10-2025)

curl -s -H "Authorization: Token $DJANGO_API_TOKEN" \
  "https://starf.sosialistaflokkurinn.is/felagar/api/full/813/" \
  | python3 -c "import json, sys; print(json.load(sys.stdin)['local_address'])"

# Expected: {"street": "Laufásvegur", "number": 5, ...}
# Broken:   None
```

---

## Testing Guide

### Test 1: Database Verification

**Check members have addresses**:
```sql
SELECT COUNT(*) as total_local_addresses,
       COUNT(CASE WHEN current = true THEN 1 END) as current_addresses
FROM membership_newlocaladdress nla
JOIN membership_newcomradeaddress nca ON nla.newcomradeaddress_ptr_id = nca.id;
```

**Expected**: 1,975 addresses

---

### Test 2: Django ORM Test

**Check ORM relationships work**:
```python
# Django shell
from membership.models import Comrade
from membership.serializers import ComradeFullSerializer

comrade = Comrade.objects.prefetch_related(
    'local_addresses__address__street__postal_code',
    'local_addresses__address__street__municipality',
).get(id=813)

# Test relationship
local_addr = comrade.local_addresses.filter(current=True).first()
print(f"Address: {local_addr.address}")  # Should print "Laufásvegur 5"

# Test serializer
serializer = ComradeFullSerializer(comrade)
print(serializer.data.get('local_address'))
# Should print: {'street': 'Gullengi', 'number': 37, ...}
```

---

### Test 3: API Test

**Check API returns address**:
```bash
DJANGO_API_TOKEN=$(gcloud secrets versions access latest --secret=django-api-token --project=ekklesia-prod-10-2025)

curl -s -H "Authorization: Token $DJANGO_API_TOKEN" \
  "https://starf.sosialistaflokkurinn.is/felagar/api/full/813/" \
  | python3 -m json.tool | grep -A 10 "local_address"
```

**Expected**:
```json
"local_address": {
  "street": "Laufásvegur",
  "number": 5,
  "letter": "",
  "postal_code": 112,
  "city": "Reykjavík"
}
```

---

### Test 4: Firestore Sync Test

**After fixing Django API, test sync**:
```bash
# Run manual sync from admin portal
https://ekklesia-prod-10-2025.web.app/admin/sync-members.html

# Verify Firestore has addresses
```

**Expected**: 1,975 members now have addresses in Firestore

---

## Summary

### Key Takeaways

1. **Django uses multi-table relationships** for addresses (5 tables!)
2. **SerializerMethodField is required** for complex relationships
3. **DictField only works** for direct model attributes
4. **Always prefetch relationships** to avoid N+1 queries
5. **Epic #116 broke address sync** by changing field type
6. **Fix is simple**: One-line change back to SerializerMethodField

---

## Related Documents

- **Database Schema**: `docs/integration/DJANGO_DATABASE_SCHEMA.md`
- **API Implementation**: `docs/integration/DJANGO_API_IMPLEMENTATION.md`
- **Epic #116 Changes**: `docs/integration/DJANGO_API_UPGRADE_EPIC_116.md`
- **System Overview**: `docs/systems/DJANGO_BACKEND_SYSTEM.md`
- **Bug Analysis**: `/tmp/ADDRESS_SYNC_BUG_ANALYSIS.md`

---

**Last Updated**: 2025-10-31
**Status**: ✅ Complete - Ready for deployment
**Next Action**: Deploy Django API fix, then re-sync members to Firestore
