# Checklist: Check User Logins

This checklist explains how to view who has logged into the Ekklesia system.

---

## ⚠️ Important: Data Structure

**Login data is in Firestore, NOT PostgreSQL**

- **Firestore**: `/users/` collection with `lastLogin` timestamp
- **PostgreSQL**: Contains only voting data (voting_tokens, audit_log)

---

## 📋 Step-by-Step Instructions

### 1. ✅ Verify Authentication

```bash
# Login to Google Cloud
gcloud auth login

# Login to Firebase
firebase login --reauth

# Set up Application Default Credentials (for Cloud SQL Proxy)
gcloud auth application-default login
```

**Verification**: You should see `Credentials saved to file:` message

---

### 2. ✅ Navigate to Scripts Directory

```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
```

Or from project root:
```bash
cd services/members/scripts
```

---

### 3. ✅ Run Login Report

**View today's logins**:
```bash
node check-user-logins.js
```

**Other options**:
```bash
# Last 7 days
node check-user-logins.js --days 7

# Latest 20 logins
node check-user-logins.js --latest 20

# Specific date
node check-user-logins.js --date 2025-11-01

# Show help
node check-user-logins.js --help
```

---

### 4. ✅ Interpret Results

The script displays for each user:
- **Name**: Full name
- **Kennitala**: Icelandic national ID
- **Login**: Exact login timestamp
- **Email**: Email address (if available)
- **Phone**: Phone number (if available)
- **Member**: Yes/No - whether user is a registered member
- **Role**: Admin role (if any)

**Example output**:
```
1. Jón Jónsson (0101901234)
   Login: 2025-11-08, 12:19:21
   Email: jon.jonsson@example.com
   Phone: 555-1234
   Member: Yes
```

---

## 🔧 Troubleshooting

### Error: "Cannot find module 'firebase-admin'"

**Solution**: You're in the wrong directory. Navigate to `services/members/scripts`:
```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
```

---

### Error: "auth: cannot fetch token"

**Solution**: You need to set up Application Default Credentials:
```bash
gcloud auth application-default login
```

---

### Error: "Failed to get instance metadata"

**Reason**: This is only an issue if you're trying to connect to PostgreSQL (which you DON'T need for login data).

**Solution for PostgreSQL** (if needed):
1. Verify you have proper access
2. Run: `gcloud auth application-default login`
3. Start Cloud SQL Proxy:
   ```bash
   cd /home/gudro/Development/projects/ekklesia
   source scripts/deployment/set-env.sh
   cloud-sql-proxy $DB_CONNECTION_NAME --port 5433 &
   ```
4. Connect with:
   ```bash
   ./scripts/database/psql-cloud.sh
   ```

---

### Error: "Permission denied" or "Index not found"

**Solution**: If Firestore index is missing, run:
```bash
firebase deploy --only firestore:indexes
```

---

## 📊 PostgreSQL Database (Voting Data)

If you need to view voting data (not logins):

### Start Cloud SQL Proxy

```bash
# From project root
source scripts/deployment/set-env.sh
cloud-sql-proxy $DB_CONNECTION_NAME --port 5433 &
```

### Connect to PostgreSQL

```bash
./scripts/database/psql-cloud.sh
```

### Useful Queries

```sql
-- View recent admin actions
SELECT id, action_type, performed_by, election_title, timestamp
FROM elections.admin_audit_log
ORDER BY timestamp DESC
LIMIT 20;

-- View voting tokens
SELECT COUNT(*) as total_tokens,
       COUNT(*) FILTER (WHERE used = true) as used_tokens,
       MIN(registered_at) as first_token,
       MAX(registered_at) as last_token
FROM elections.voting_tokens;

-- View tokens from specific date
SELECT * FROM elections.voting_tokens
WHERE registered_at >= '2025-11-01'
ORDER BY registered_at DESC;
```

### Close Connection

```bash
# Find and kill proxy process
pkill cloud-sql-proxy
```

---

## 📁 File Locations

| File | Location | Purpose |
|------|----------|---------|
| **Login script** | `services/members/scripts/check-user-logins.js` | Main script to check logins |
| **Today's logins** | `services/members/scripts/check-logins-today.js` | Simpler script for today only |
| **README** | `services/members/scripts/README.md` | Documentation for all scripts |
| **Proxy script** | `scripts/database/start-proxy.sh` | Starts Cloud SQL Proxy |
| **PostgreSQL script** | `scripts/database/psql-cloud.sh` | Connects to PostgreSQL |
| **Environment vars** | `scripts/deployment/set-env.sh` | GCP configuration |

---

## 🔐 Security Considerations

- ⚠️ **Login scripts must NOT be in Git remote**
  - They are in `.gitignore`
  - They contain sensitive user data

- ⚠️ **NEVER store passwords in Git**
  - All passwords are in GCP Secret Manager
  - Retrieve with: `gcloud secrets versions access latest --secret=postgres-password`

- ⚠️ **Always use Cloud SQL Proxy for PostgreSQL**
  - Never connect directly (except in emergencies)
  - Proxy creates secure encrypted connection

---

## ✅ Checklist

Check off when you've completed each step:

- [ ] Logged in with `gcloud auth login`
- [ ] Logged in with `firebase login`
- [ ] Set up `gcloud auth application-default login`
- [ ] Navigated to `services/members/scripts` directory
- [ ] Ran `node check-user-logins.js` with appropriate options
- [ ] Received and interpreted results
- [ ] (Optional) Closed Cloud SQL Proxy if used

---

## 🔄 Quick Commands for Future Reference

**All-in-one command for today's logins**:
```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts && node check-user-logins.js
```

**Latest 10 logins**:
```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts && node check-user-logins.js --latest 10
```

---

## 📞 Getting Help

If you encounter issues:

1. Verify you're in the correct directory: `pwd` should show `...ekklesia/services/members/scripts`
2. Verify you're authenticated: `gcloud auth list` and `firebase projects:list`
3. Read error messages carefully - they often indicate the solution
4. See `services/members/scripts/README.md` for more details

---

**Last Updated**: 2025-11-14
