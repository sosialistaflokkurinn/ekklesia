# Django Backend Requirements: Foreign Address & Phone Support

**Epic**: Foreign Address Management
**Created**: 2025-11-02
**Status**: 🔴 Required for Ekklesia foreign address feature
**Priority**: High
**Estimated Effort**: 3-4 hours

---

## Overview

Ekklesia member portal needs to support members living abroad with separate foreign addresses and phone numbers. The Django backend already has `foreign_addresses` model, but is missing `foreign_phone` field and CRUD API endpoints.

**Requirements**:
1. ✅ Add `foreign_phone` field to ContactInfo model
2. ✅ Create/Update/Delete API endpoints for foreign addresses
3. ✅ Update API serializers to include new fields
4. ✅ Database migration

---

## 1. Database Schema Changes

### 1.1 Add `foreign_phone` to ContactInfo Model

**File**: `felagar/models.py` (ContactInfo class)

**Current**:
```python
class ContactInfo(models.Model):
    comrade = models.OneToOneField(Comrade, on_delete=models.CASCADE, related_name='contact_info')
    phone = models.CharField(max_length=32, blank=True, null=True, verbose_name="Sími")
    email = models.EmailField(max_length=124, blank=True, null=True, verbose_name="Netfang")
    facebook = models.CharField(max_length=255, blank=True, null=True, verbose_name="Facebook slóð")
```

**Add field**:
```python
class ContactInfo(models.Model):
    comrade = models.OneToOneField(Comrade, on_delete=models.CASCADE, related_name='contact_info')
    phone = models.CharField(max_length=32, blank=True, null=True, verbose_name="Sími")
    foreign_phone = models.CharField(max_length=32, blank=True, null=True, verbose_name="Erlent símanúmer")  # ← NEW
    email = models.EmailField(max_length=124, blank=True, null=True, verbose_name="Netfang")
    facebook = models.CharField(max_length=255, blank=True, null=True, verbose_name="Facebook slóð")
```

**Migration**:
```bash
python manage.py makemigrations felagar
python manage.py migrate
```

**Validation**: Accept international phone format (E.164):
- Examples: `+354 775-8492`, `+45 12345678`, `+1 (555) 123-4567`
- Regex: `^\+[0-9]{1,3}\s?[0-9\s()-]{6,20}$`

---

## 2. API Serializer Updates

### 2.1 Update ContactInfoSerializer

**File**: `felagar/serializers.py` (ContactInfoSerializer class)

**Current**:
```python
class ContactInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactInfo
        fields = ['pk', 'phone', 'email', 'facebook']
```

**Add field**:
```python
class ContactInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactInfo
        fields = ['pk', 'phone', 'foreign_phone', 'email', 'facebook']  # ← Add foreign_phone
```

---

## 3. API Endpoint Requirements

### 3.1 Foreign Address CRUD Endpoints

#### Option A: Nested Endpoint (Recommended)

**Create Foreign Address**:
```
POST /felagar/api/full/{member_id}/foreign-address/
Content-Type: application/json
Authorization: Token YOUR_TOKEN

{
  "country": "DK",          // ISO country code or ID
  "address": "Nørrebrogade 10A",
  "postal_code": "2100",
  "municipality": "Copenhagen",
  "current": true           // Set as current address
}

Response:
{
  "id": 123,
  "country": "DK",
  "address": "Nørrebrogade 10A",
  "postal_code": "2100",
  "municipality": "Copenhagen",
  "current": true
}
```

**Update Foreign Address**:
```
PUT /felagar/api/full/{member_id}/foreign-address/{address_id}/
Content-Type: application/json
Authorization: Token YOUR_TOKEN

{
  "address": "Nørrebrogade 12B",
  "current": true
}

Response: Updated address object
```

**Delete Foreign Address**:
```
DELETE /felagar/api/full/{member_id}/foreign-address/{address_id}/
Authorization: Token YOUR_TOKEN

Response: 204 No Content
```

#### Option B: Use Existing Update Endpoint

If creating new endpoints is too complex, update existing `/felagar/api/full/{member_id}/` to accept `foreign_addresses` array:

```
PATCH /felagar/api/full/{member_id}/
Content-Type: application/json
Authorization: Token YOUR_TOKEN

{
  "foreign_addresses": [
    {
      "country": "DK",
      "address": "Nørrebrogade 10A",
      "postal_code": "2100",
      "municipality": "Copenhagen",
      "current": true
    }
  ],
  "contact_info": {
    "foreign_phone": "+45 12345678"
  }
}
```

**Recommendation**: Option A (nested endpoints) is cleaner and more RESTful.

---

## 4. Business Logic Requirements

### 4.1 `current` Flag Logic

When a foreign address is set to `current=true`:
1. ✅ Set all other foreign addresses for this member to `current=false`
2. ✅ This indicates member is living abroad
3. ✅ Ekklesia UI will hide Icelandic address when foreign is current

**Implementation**:
```python
def save(self, *args, **kwargs):
    if self.current:
        # Set all other foreign addresses for this member to current=False
        ForeignAddress.objects.filter(
            comrade=self.comrade,
            current=True
        ).exclude(pk=self.pk).update(current=False)
    super().save(*args, **kwargs)
```

### 4.2 Country Field

**Current**: ForeignKey to Country model

**Required format in API response**:
- **Option 1**: ISO code string: `"DK"` (preferred - simplest for Ekklesia)
- **Option 2**: Country object: `{"id": 1, "code": "DK", "name": "Danmark"}`

**Question**: What does Django API currently return for `country` field?

**Test command**:
```bash
curl -H "Authorization: Token YOUR_TOKEN" \
     https://starf.sosialistaflokkurinn.is/felagar/api/full/813/ | \
     jq '.foreign_addresses[0].country'
```

**Recommendation**: Return ISO code string in API response for simplicity.

---

## 5. API Response Example

### 5.1 Expected Full Member Response

```json
{
  "id": 813,
  "name": "Jón Jónsson",
  "ssn": "010190-1234",
  "birthday": "1990-01-01",
  "contact_info": {
    "pk": 813,
    "phone": "7758492",
    "foreign_phone": "+45 12345678",  // ← NEW
    "email": "jon@example.is",
    "facebook": null
  },
  "local_address": {
    "street": "Laugavegur",
    "number": 123,
    "letter": "",
    "postal_code": 101,
    "city": "Reykjavík"
  },
  "foreign_addresses": [
    {
      "pk": 456,
      "country": "DK",  // ← ISO code (preferred)
      "address": "Nørrebrogade 10A",
      "postal_code": "2100",
      "municipality": "Copenhagen",
      "current": true
    }
  ],
  // ... other fields
}
```

---

## 6. Database Migration Checklist

- [ ] Add `foreign_phone` field to ContactInfo model
- [ ] Create migration: `python manage.py makemigrations felagar`
- [ ] Review migration file
- [ ] Run migration: `python manage.py migrate`
- [ ] Verify field exists: `python manage.py dbshell` → `\d felagar_contactinfo`

---

## 7. API Endpoint Checklist

### If using Option A (Nested endpoints):
- [ ] Create `ForeignAddressViewSet`
- [ ] Add URL routes:
  - `/felagar/api/full/<member_id>/foreign-address/` (POST)
  - `/felagar/api/full/<member_id>/foreign-address/<address_id>/` (PUT, DELETE)
- [ ] Add permissions (member can only edit own foreign address, admins can edit all)
- [ ] Test CRUD operations

### If using Option B (Existing endpoint):
- [ ] Update existing serializer to accept `foreign_addresses` array
- [ ] Add validation logic
- [ ] Test PATCH endpoint

---

## 8. Testing Checklist

### Backend Tests:
- [ ] Create foreign address via API
- [ ] Update foreign address via API
- [ ] Delete foreign address via API
- [ ] Verify `current` flag logic (only one current at a time)
- [ ] Verify `foreign_phone` saves correctly
- [ ] Test API response includes new fields

### Integration Tests:
- [ ] Ekklesia sync_members.py can read new fields
- [ ] Ekklesia UI can display foreign address
- [ ] Ekklesia UI can edit foreign address (after Ekklesia implementation)

---

## 9. Security Considerations

### Permissions:
- ✅ Members can only edit their own foreign address
- ✅ Admins can edit any member's foreign address
- ✅ Foreign addresses are NOT public (same privacy as local addresses)

### Validation:
- ✅ Validate `foreign_phone` format (E.164)
- ✅ Validate `postal_code` (3-16 alphanumeric chars)
- ✅ Validate `country` (must be valid Country object)
- ✅ Validate `current` flag logic

---

## 10. API Documentation

Update Django API documentation:
- [ ] Document new `foreign_phone` field
- [ ] Document foreign address CRUD endpoints
- [ ] Add examples
- [ ] Update OPTIONS response for `/felagar/api/full/`

---

## 11. Deployment Plan

### Step 1: Deploy Django Changes
```bash
# On production server
cd /path/to/django/app
git pull origin main
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn  # or uwsgi
```

### Step 2: Verify API
```bash
# Test new field exists
curl -H "Authorization: Token TOKEN" \
     https://starf.sosialistaflokkurinn.is/felagar/api/full/813/ | \
     jq '.contact_info.foreign_phone'

# Test foreign addresses
curl -H "Authorization: Token TOKEN" \
     https://starf.sosialistaflokkurinn.is/felagar/api/full/813/ | \
     jq '.foreign_addresses'
```

### Step 3: Notify Ekklesia Team
Once deployed, notify Ekklesia team so they can:
1. Update `sync_members.py` to sync new fields
2. Run full member sync
3. Implement UI changes

---

## 12. Open Questions

1. **Country format**: Does Django API return ISO code ("DK") or country object?
2. **Endpoint preference**: Option A (nested) or Option B (existing endpoint)?
3. **Validation rules**: Any specific validation for foreign addresses?
4. **Migration timing**: When can this be deployed to production?

---

## 13. Contact & Coordination

**Django Admin Contact**: [Name/Email]
**Ekklesia Lead**: Guðröður
**Timeline**: Target deployment date?

**Next Steps**:
1. Django admin implements changes (this document)
2. Django admin deploys to production
3. Ekklesia team implements UI changes
4. End-to-end testing

---

## Appendix A: Example Country Codes

Common countries for Icelandic members living abroad:

| Code | Country (Icelandic) | Country (English) |
|------|---------------------|-------------------|
| IS | Ísland | Iceland |
| DK | Danmörk | Denmark |
| NO | Noregur | Norway |
| SE | Svíþjóð | Sweden |
| FI | Finnland | Finland |
| US | Bandaríkin | United States |
| GB | Bretland | United Kingdom |
| DE | Þýskaland | Germany |
| FR | Frakkland | France |
| ES | Spánn | Spain |
| IT | Ítalía | Italy |
| NL | Holland | Netherlands |

---

**Status**: ⏳ Awaiting Django implementation
**Last Updated**: 2025-11-02
**Version**: 1.0
