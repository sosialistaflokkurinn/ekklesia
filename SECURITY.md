# Ekklesia Security Policy

**Last Updated**: 2025-11-14

---

## Classification

This repository is **public**. Never commit:
- Personal Identifiable Information (PII): kennitala, names, emails, phone numbers, addresses
- Secrets: API keys, passwords, OAuth secrets, tokens, certificates
- Service account credentials or private keys
- Sensitive configuration: database URLs, internal endpoints, connection strings
- Destructive operational procedures or runbooks

**Internal operational procedures** are maintained in a private repository.

---

## Reporting a Vulnerability

- **Email**: xj@xj.is
- **Response Time**: 48 hours
- **Coordinated Disclosure**: 90 days from report unless extended by mutual agreement
- **Urgent Incidents**: Include "[SECURITY]" in subject with reproduction details and impacted components

---

## Scope

### In Scope
- Production services:
  - Members portal (Cloud Functions)
  - Events service (Cloud Run)
  - Elections service (Cloud Run)
- Public endpoints and infrastructure code in this repository
- Web applications and APIs

### Out of Scope
- DoS/volume-based attacks (accepted risk for periodic meetings)
- Social engineering attacks

---

## Security Enforcement

### 1. Pre-commit Hooks

**Location**: `scripts/git-hooks/pre-commit`

**Installation**:
```bash
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Checks performed**:
- ✅ **Secrets scanning**: Database passwords, API keys, GCP credentials, tokens, connection strings
- ✅ **PII detection**: Kennitala, email addresses, phone numbers in code/docs
- ✅ **Political identity**: Blocks party affiliation references per neutrality policy
- ✅ **.gitignore safeguards**: Ensures critical files remain ignored

**Bypass** (use carefully): `git commit --no-verify`

---

### 2. GitHub Secret Scanning

**Status**: ✅ Enabled

Enable in repository settings → Code security and analysis → Secret scanning

Automatically detects and alerts on:
- GitHub tokens
- Cloud provider credentials (GCP, AWS, Azure)
- Third-party API keys

**Reference**: [GitHub secret scanning docs](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)

---

### 3. Weekly Security Hygiene Checks

**GitHub Actions workflow**: `.github/workflows/security-hygiene.yml`

Automated weekly scans for:
- Exposed secrets in codebase
- PII in documentation
- Dependency vulnerabilities
- Outdated security policies

---

## Secrets Management

### Google Cloud Secret Manager

**All production secrets** are stored in GCP Secret Manager:
- Database passwords (PostgreSQL)
- API keys (Google AI, third-party services)
- OAuth client secrets
- Service account keys
- **Sudo passwords for automated maintenance**

**Access secrets**:
```bash
gcloud secrets versions access latest --secret="secret-name" --project="project-id"
```

**Security practices**:
- ✅ Never log or print actual secrets
- ✅ Always mask passwords as `***********` in logs
- ✅ Clear sensitive variables from memory: `unset PASSWORD`
- ✅ Use service accounts for automated systems (JSON keys, never expire)
- ✅ Redirect password test output to `/dev/null`

**Example** (password masking):
```bash
# Good - masked output
SUDO_PASSWORD=$(gcloud secrets versions access latest --secret="sudo-password")
log_status "Password retrieved from Secret Manager (***********)"
echo "$SUDO_PASSWORD" | sudo -S command 2>/dev/null

# Bad - exposes password
echo "Password: $SUDO_PASSWORD"  # ❌ NEVER DO THIS
```

**Documentation**: `/home/gudro/fedora-setup/documentation/tools/GOOGLE_SECRET_MANAGER_SUDO.md`

---

### Service Account Authentication

**For automated systems** (systemd services, cron jobs):
- Use service account JSON keys
- Store keys in `/etc/systemd/system/` with `600` permissions
- Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- Never commit JSON keys to git

**Activate service account**:
```bash
gcloud auth activate-service-account --key-file=/path/to/key.json
```

---

## Operational Safety

### Admin Operations

- All admin/destructive operations are gated by:
  - Role-based access control (RBAC)
  - Environment flags (production vs staging)
  - Multi-factor authentication (MFA) required
- Do not document or store destructive runbooks publicly
- All admin actions must be auditable via structured logs:
  - User ID (UID)
  - Timestamp (ISO 8601)
  - Action type (create/update/delete)
  - Before/after counts or states

### Password Handling in Scripts

**Requirements**:
1. **Never echo or log actual passwords**
   - Always mask as `***********` in output
   - Use `2>/dev/null` to suppress error output containing passwords

2. **Clear passwords from memory**
   ```bash
   unset SUDO_PASSWORD
   ```

3. **No debug mode with passwords**
   - Never use `set -x` or `bash -x` when handling passwords
   - Debug output reveals all variable values

4. **Test sudo access safely**
   ```bash
   echo "$PASSWORD" | sudo -S true 2>/dev/null
   ```

**See**: `/usr/local/bin/fedora-automated-maintenance.sh` for reference implementation

---

## Documentation Language Policy

**All security documentation must be in English** per project documentation policy.

**Exception**: User-facing security notices in UI can be in target language (Icelandic).

**Rationale**:
- Security policies must be accessible to all developers
- Industry best practice for security documentation
- Enables external security audits

**Reference**: `docs/standards/DOCUMENTATION_GUIDE.md` - Language Policy section

---

## .gitignore Policy

**Critical files that must NEVER be committed**:

```gitignore
# Secrets and credentials
.env
.env.local
*.pem
*.key
*-key.json
service-account*.json
credentials.json
secrets.yml

# PII and sensitive data
check-user-logins.js
*-logins.js
user-data.json
member-data.json

# Local configuration
.gitignore.local
.claude/
*.draft.md
*.notes.md

# Operational data
logs/*.log
reports/*-report.md
archive/
```

**Enforcement**: Pre-commit hook checks `.gitignore` safeguards

---

## Security Best Practices Checklist

### For All Developers

- [ ] Never commit PII, secrets, or credentials
- [ ] Use `.gitignore.local` for personal ignore rules
- [ ] Review all `git diff` before committing
- [ ] Enable GitHub secret scanning on all repos
- [ ] Use MFA for all accounts with elevated roles
- [ ] Store all secrets in GCP Secret Manager
- [ ] Mask passwords as `***********` in all logs and output
- [ ] Write all documentation in English
- [ ] Test pre-commit hooks before push

### For Admin Operations

- [ ] Use service accounts for automated systems
- [ ] Audit all admin actions with structured logs
- [ ] Clear passwords from memory after use (`unset`)
- [ ] Never use `set -x` when handling passwords
- [ ] Redirect password output to `/dev/null`
- [ ] Document operational procedures in private repo only
- [ ] Use environment flags to gate destructive operations

### For Code Review

- [ ] Scan for PII (names, kennitala, email, phone)
- [ ] Scan for secrets (API keys, passwords, tokens)
- [ ] Verify `.gitignore` entries for new files
- [ ] Check that passwords are masked in logs
- [ ] Ensure documentation is in English
- [ ] Verify MFA required for elevated operations

---

## Incident Response

If you discover **PII or secrets** in the repository:

1. **Report immediately** to platform maintainers
2. **Do not attempt to fix alone** - coordinate response
3. **For committed secrets**:
   - Rotate/revoke the exposed secret immediately
   - Use `git filter-repo` or BFG Repo-Cleaner to remove from history
   - Force-push cleaned history (requires coordination)
4. **For PII**:
   - Document what was exposed and for how long
   - Notify affected individuals if required by GDPR
   - Review and strengthen PII detection in pre-commit hooks

**Never use** `git revert` for secrets - they remain in history. Must use `git filter-repo`.

---

## Related Documentation

- **Google Secret Manager Setup**: `/home/gudro/fedora-setup/documentation/tools/GOOGLE_SECRET_MANAGER_SUDO.md`
- **Documentation Language Policy**: `docs/standards/DOCUMENTATION_GUIDE.md`
- **Pre-commit Hooks**: `scripts/git-hooks/README.md`
- **Automated Maintenance**: `documentation/maintenance/AUTOMATED_MAINTENANCE.md`
- **RBAC Policy**: `services/elections/docs/RBAC.md`

---

## Contact

- **Security Issues**: xj@xj.is
- **Urgent Incidents**: Include "[SECURITY]" in subject
- **Platform Maintainers**: File issue with `security` label

---

**Maintained By**: Platform Team
**Status**: ✅ Active - Required for all contributors
