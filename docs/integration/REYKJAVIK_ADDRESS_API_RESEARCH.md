# Reykjavík Address API Research

**Document Type**: Technical Research
**Last Updated**: 2025-10-26
**Status**: 📋 Research Complete
**Purpose**: Document address lookup options for Epic #43 Member Management System

---

## Overview

Member management kerfið þarf að geta flett upp heimilisföngum fyrir íslenska ríkisborgara. Við rannsökuðum tvær leiðir:

1. **rvkdata/stadfangaskra_extra** (GitHub) - Reykjavík enriched address data
2. **HMS (Hönnunar- og Mannvirkjastofnun)** - Official government source

---

## Option 1: rvkdata/stadfangaskra_extra (GitHub)

**Source**: https://github.com/rvkdata/stadfangaskra_extra

### What It Provides

Enriched version of Iceland's National Registry address database for **Reykjavík only**:

- Standard address fields (street name, house number, postal code)
- Geographic coordinates (ISN93 and WGS84 formats)
- Administrative subdivisions (LUKR):
  - School districts (skólahverfi)
  - Electoral precincts (kjördæmi)
  - Administrative neighborhoods (skipulagshverfi)
  - Waste collection areas (sorpflokkunarsvæði)
- 30+ attributes per address record

### Data Format

**Format**: CSV files (comma-delimited)

**Files Available**:
- `stadfangaskra_extra.csv` - Complete dataset with all enrichments
- `stadfangaskra_extra_complete.csv` - Alternative version
- Specialized files for specific divisions

**Example Fields**:
- `HNITNUM` - Address ID
- `HEITI_NF` - Street name (nominative case)
- `HUSNR` - House number
- `POSTNR` - Postal code
- `N_HNIT_WGS84` - Latitude (WGS84)
- `E_HNIT_WGS84` - Longitude (WGS84)

### Access Method

**Type**: File download (no API)

**URL**: https://github.com/rvkdata/stadfangaskra_extra/raw/main/stadfangaskra_extra.csv

**Authentication**: None required (public repository)

**Rate Limits**: None (direct file download)

### Update Schedule

**Frequency**: Weekly (every Sunday at 22:15 UTC)

**Automation**: Could be automated with weekly download + import to Firestore

### Limitations

⚠️ **MAJOR LIMITATION**: **Reykjavík only!**

This dataset only covers Reykjavík addresses. For members outside Reykjavík (rest of Iceland), this will not work.

**Repository Status**: Archived (read-only) as of January 16, 2025

### License/Terms

Data sourced from Iceland's National Registry (Þjóðskrá Íslands). Public data, free to use.

---

## Option 2: HMS (Hönnunar- og Mannvirkjastofnun)

**Source**: https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra

### What It Is

HMS (Iceland Construction Authority) is the **official government source** for address data in Iceland.

### Coverage

**All of Iceland** (not just Reykjavík)

### Access Method

**Research needed**: Could not access HMS website due to rate limiting. Need to investigate:
- API availability
- File download format
- Authentication requirements
- Update frequency
- Terms of use

**Action Item**: Visit HMS website manually or contact them for API documentation.

---

## Option 3: Þjóðskrá Íslands (National Registry) API

**Source**: https://www.skra.is/ (official national registry)

### What It Is

The ultimate source of truth for all address data in Iceland. Both HMS and rvkdata derive their data from Þjóðskrá.

### Access Method

**Research needed**: Check if Þjóðskrá provides:
- Public API for address lookup
- Bulk download
- Integration options for organizations

**Benefit**: Would cover all of Iceland, not just Reykjavík.

---

## Recommendation for Epic #43

### Phase 1 (MVP): Manual Address Entry

**For now**: Don't implement automatic address lookup

**Reason**:
- rvkdata only covers Reykjavík (~40% of Iceland population)
- Many members likely live outside Reykjavík
- HMS/Þjóðskrá research incomplete

**Implementation**:
- Admin manually enters/edits addresses in member management UI
- Sync addresses from Django as-is (no validation)

**Benefits**:
- Faster MVP delivery (no API integration needed)
- Works for all of Iceland
- Simpler architecture

### Phase 2 (Future Enhancement): Address Validation

Once research complete, add address lookup/validation:

**Option A**: HMS API (if available)
- Covers all of Iceland
- Official government source
- Best option if API exists

**Option B**: Þjóðskrá API (if accessible)
- Ultimate source of truth
- Requires formal agreement/access

**Option C**: rvkdata CSV + Manual for rest
- Download rvkdata weekly
- Import to Firestore
- Use for Reykjavík addresses only
- Manual entry for outside Reykjavík

---

## Implementation Plan (If We Implement Address Lookup)

### Option C (rvkdata + Manual) - Most Realistic for MVP

#### 1. Weekly CSV Download

```javascript
// Cloud Function: importReykjavikAddresses
// Triggered: Weekly (Sunday 23:00 Iceland time, after rvkdata updates)

exports.importReykjavikAddresses = functions
  .pubsub.schedule('0 23 * * 0')  // Sunday 23:00
  .timeZone('Atlantic/Reykjavik')
  .onRun(async () => {
    // 1. Download CSV from GitHub
    const response = await fetch(
      'https://github.com/rvkdata/stadfangaskra_extra/raw/main/stadfangaskra_extra.csv'
    );
    const csvText = await response.text();

    // 2. Parse CSV
    const addresses = parseCSV(csvText);

    // 3. Batch write to Firestore
    const batch = db.batch();
    addresses.forEach(addr => {
      const docRef = db.collection('addresses_reykjavik').doc(addr.HNITNUM);
      batch.set(docRef, {
        street: addr.HEITI_NF,
        houseNumber: addr.HUSNR,
        postalCode: addr.POSTNR,
        city: 'Reykjavík',
        latitude: addr.N_HNIT_WGS84,
        longitude: addr.E_HNIT_WGS84,
        district: addr.HVERFI,
        lastUpdated: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`Imported ${addresses.length} Reykjavík addresses`);
  });
```

#### 2. Address Lookup in Admin UI

```javascript
// In admin UI: addressLookup.js

async function lookupAddress(street, houseNumber) {
  // Query Firestore for Reykjavík addresses
  const snapshot = await db.collection('addresses_reykjavik')
    .where('street', '==', street)
    .where('houseNumber', '==', houseNumber)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      found: false,
      message: 'Address not found in Reykjavík database. Please enter manually.'
    };
  }

  const address = snapshot.docs[0].data();
  return {
    found: true,
    address: {
      street: address.street,
      houseNumber: address.houseNumber,
      postalCode: address.postalCode,
      city: address.city
    }
  };
}
```

#### 3. Admin UI Integration

```html
<!-- In member-detail.html -->

<div class="address-lookup">
  <label>Street Name:</label>
  <input type="text" id="street-input" placeholder="Túngata">

  <label>House Number:</label>
  <input type="text" id="house-number-input" placeholder="14">

  <button id="lookup-btn">🔍 Lookup Address (Reykjavík only)</button>

  <div id="lookup-result"></div>

  <label>Full Address:</label>
  <textarea id="full-address" placeholder="Enter full address if not in Reykjavík"></textarea>
</div>
```

---

## Cost Estimate (If Implemented)

### Option C (rvkdata CSV)

| Component | Cost | Notes |
|-----------|------|-------|
| Cloud Function (weekly import) | $0.00 | Free tier (52 runs/year) |
| Firestore storage | ~$0.50/month | ~30,000 Reykjavík addresses × 0.18 USD/GB |
| Firestore reads (address lookup) | ~$0.10/month | Assume 100 lookups/month |
| **Total** | **~$0.60/month** | **~$7/year** |

**Conclusion**: Very cheap, but limited to Reykjavík.

---

## Next Steps

### Immediate (Epic #43 MVP)

1. ✅ **Skip address lookup for MVP**
   - Manual address entry in admin UI
   - Sync addresses from Django as-is
   - Faster delivery, works everywhere

2. **Document research findings** (this file)

3. **Note in Epic #43 spec**: Address lookup is future enhancement

### Future (Post-MVP)

1. **Research HMS API**
   - Visit https://hms.is manually
   - Check for API documentation
   - Contact HMS if needed (info@hms.is?)

2. **Research Þjóðskrá API**
   - Visit https://www.skra.is
   - Check developer documentation
   - May require formal access agreement

3. **Implement address validation** (once research complete)
   - If HMS/Þjóðskrá API available: Use that (best option)
   - If not: Use rvkdata for Reykjavík + manual for rest

---

## Questions for User

1. **How many members live in Reykjavík vs. rest of Iceland?**
   - If 80%+ in Reykjavík: rvkdata might be good enough
   - If distributed: Need HMS/Þjóðskrá solution

2. **Is address validation critical for MVP?**
   - If not: Skip for now (faster delivery)
   - If yes: Need to finish HMS/Þjóðskrá research first

3. **Does Django already have addresses for members?**
   - If yes: Sync from Django, no lookup needed for MVP
   - If no: Need address entry solution

---

## Related Documentation

- [EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md](../features/election-voting/EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md) - Main Epic #43 specification
- [DJANGO_TO_EKKLESIA_MIGRATION.md](DJANGO_TO_EKKLESIA_MIGRATION.md) - Long-term migration plan

---

## External Resources

- **rvkdata GitHub**: https://github.com/rvkdata/stadfangaskra_extra
- **HMS**: https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra
- **Þjóðskrá**: https://www.skra.is
- **Iceland Open Data Portal**: https://opingogn.is (may have address datasets)

---

**Last Updated**: 2025-10-26
**Author**: Research for Epic #43
**Status**: 📋 Research Complete - Recommend skipping for MVP
**Next Review**: After MVP complete, before Phase 2
