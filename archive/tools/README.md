# Legacy Code Archive

**Purpose**: This directory contains legacy code that is no longer used in production but preserved for reference.

---

## Files

### `server.js` - Legacy Fastify Server

**Status**: ❌ Not used in production

**Original Purpose**:
- Node.js/Fastify HTTP server for Members service
- Was part of an earlier design iteration

**Why Archived**:
- Members service migrated to **Firebase Hosting** (static files) + **Cloud Functions** (Python)
- This server was replaced by serverless architecture
- No longer referenced in deployment configuration

**Production Architecture** (current):
```
Firebase Hosting (static HTML/CSS/JS)
  → Cloud Functions (Python 3.11)
    - handleKenniAuth (OAuth flow)
    - verifyMembership (kennitala verification)
  → Firebase Authentication
```

**When to Use**:
- Reference only
- Do NOT deploy to production
- If needed for local testing, run with: `node tools/legacy/server.js`

---

**Last Updated**: 2025-10-15
**Archived From**: `members/server.js` (PR#28 review feedback)
