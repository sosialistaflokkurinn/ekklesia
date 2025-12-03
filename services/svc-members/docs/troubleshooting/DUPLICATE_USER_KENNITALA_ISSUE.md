# Duplicate User Creation Due to Kennitala Normalization

## 🚨 Issue Summary

**Problem**: Users created before October 30, 2025 have kennitölur stored WITH hyphens in Firestore, causing duplicate user creation on subsequent logins.

**Root Cause**: Database normalization pattern violation - kennitölur should be stored WITHOUT hyphens in database, but old users have hyphens.

**Solution**: Data migration script + merge duplicates

## 📋 Design Pattern

✅ **Correct**:
- UI Display: `"010192-2779"` (user-friendly)
- Database: `"0101922779"` (normalized, no hyphen)

❌ **Old Bug**:
- Database had: `"010192-2779"` (with hyphen)
- Query looked for: `"0101922779"` (normalized)
- Result: NO MATCH → duplicate created

## 🔧 Solution

```bash
cd services/members

# 1. Dry run (no changes)
node scripts/migrate-kennitala-normalization.js --dry-run

# 2. Execute migration
node scripts/migrate-kennitala-normalization.js --execute

# 3. Verify
node scripts/check-kennitala-format.js
```

## 📊 Example

**Before**:
- User 1 (Oct 8): kennitala="010192-2779", roles=["member","admin","superuser"]
- User 2 (Nov 13): kennitala="0101922779", roles=["member"] ← DUPLICATE!

**After**:
- User 1: kennitala="0101922779", roles=["member","admin","superuser"] ← MERGED
- User 2: DELETED

## 📚 Files

- Migration: `services/members/scripts/migrate-kennitala-normalization.js`
- Check: `services/members/scripts/check-kennitala-format.js`
- Auth: `services/members/functions/auth/kenni_flow.py`
- Validators: `services/members/functions/shared/validators.py`

## 🔗 Related

- Commit `f9cbc9d` (Oct 30): Added normalization to sync functions

---

**Last Updated**: 2025-11-14
