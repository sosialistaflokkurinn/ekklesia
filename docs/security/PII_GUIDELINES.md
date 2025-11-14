# PII Guidelines for GitHub Issues and PRs

**Last Updated**: 2025-11-10
**Related Issues**: #240 (PII Prevention System), #136 (PII Exposure Incident)

---

## What is PII?

**Personal Identifiable Information (PII)** is any data that can identify a specific individual. In Iceland and for Ekklesia, this includes:

- **Kennitalas** (Icelandic SSN format: DDMMYY-NNNN)
- **Full names** of real members
- **Email addresses** (non-example domains)
- **Phone numbers** (Icelandic format: XXX-XXXX)
- **Home addresses**
- **Database IDs** linked to real people (Django IDs, Firestore document IDs when used with kennitala)
- **Any combination** of data that could identify a person

---

## Why This Matters

### Legal Requirements
- **GDPR compliance**: Processing PII requires explicit consent
- **Icelandic privacy laws**: Kennitalas are highly protected
- **Political data sensitivity**: Party membership is sensitive information

### Security Risks
- **Public repository**: All GitHub content is world-readable
- **Search engine indexing**: Google indexes GitHub issues
- **Permanent record**: Even deleted content may be cached
- **Aggregation risk**: Combining PII with other data enables identification

### Member Trust
- **Privacy breach**: Exposing member data damages trust
- **Political sensitivity**: Party affiliation could affect employment/reputation
- **Security concerns**: PII enables social engineering and targeted attacks

---

## Rules

### 1. Never Include Real PII In:
- ❌ Issue titles or descriptions
- ❌ Pull request titles or descriptions
- ❌ Code comments or documentation
- ❌ Commit messages
- ❌ Screenshots or images
- ❌ Log examples or error messages
- ❌ Test data or seed data (unless in local-only files)
- ❌ API examples or curl commands

### 2. Always Use Fake Examples:

#### ✅ Approved Fake Data:

| Type | Fake Examples | Notes |
|------|---------------|-------|
| **Names** | "Jón Jónsson"<br>"Anna Jónsdóttir"<br>"Gunnar Gunnarsson" | Obviously generic Icelandic names |
| **Kennitalas** | "010190-0000"<br>"111111-1111"<br>"000000-2939" | Clearly invalid checksums |
| **Emails** | "email@example.com"<br>"user@example.com"<br>"member@example.org" | Only use @example.com/org/net domains |
| **Phones** | "555-1234"<br>"000-0000"<br>"999-9999" | Obviously fake patterns |
| **Addresses** | "Dæmisgata 1, 000 Dæmisbær"<br>"Prófunargata 5, 101 Prófunarbær" | Clearly fake street/postal code |
| **Django IDs** | "12345"<br>"99999" | Generic non-identifiable numbers |
| **Firebase UIDs** | "abc123XYZ789ExampleUserUID456" | Obviously fake UID pattern |

### 3. Redact PII in Screenshots:
- Use blur or pixelate tools on sensitive data
- Replace text with fake examples before screenshot
- Never screenshot production member lists
- Test environments should use fake data

---

## Enforcement

### Pre-commit Hooks
The `.git/hooks/pre-commit` hook automatically scans:
- ✅ All code files for secrets and PII
- ✅ Documentation files in `docs/` directory
- ✅ GitHub templates (`.github/`)
- ✅ Commit messages (via `commit-msg` hook)

**Blocked patterns**:
- Kennitalas (excluding fake examples like 010190-0000)
- Email addresses (excluding @example.com)
- Phone numbers (excluding 555-1234, 000-0000)
- Database passwords and API keys

### GitHub Actions
The `.github/workflows/pii-check.yml` workflow automatically:
- ✅ Scans issues when opened/edited
- ✅ Scans PRs when opened/edited
- ✅ Scans comments when created/edited
- ✅ Posts warning comment if PII detected

**Does NOT block** - only warns (to avoid false positives)

### Manual Review
Security-related issues should be reviewed by maintainers before submission.

---

## What To Do If You Find PII

### In Your Own Contribution:
1. **Do NOT commit**: Use fake examples instead
2. **Already committed?**: Amend the commit with `git commit --amend`
3. **Already pushed?**: Force push to fix: `git push --force` (only on feature branches!)

### In Someone Else's Issue/PR:
1. **Comment immediately**: "@author Please remove real PII from this issue"
2. **Notify maintainer**: Tag @gudrodur or DM on communication channels
3. **Do NOT repeat the PII**: Don't quote it in your comment
4. **Wait for author to edit**: Only maintainers should force-edit others' content

### In Old Issues (Audit Phase):
1. **Create private issue**: Report to maintainers only
2. **Provide issue number**: Link to problematic issue
3. **Do NOT describe the PII**: Just flag it
4. **Let maintainers sanitize**: They will edit/close as needed

---

## Examples

### ❌ Bad Example:
```markdown
## Bug: Email not sending

Member Sigurður Sigurðsson (kennitala 120180-5678, email siggi@gmail.com)
reports emails not arriving at phone number 895-4321.

Django ID: 42
```

**Problems**:
- Real-looking name
- Real-looking kennitala
- Real email domain
- Real-looking phone
- Potentially identifiable database ID

### ✅ Good Example:
```markdown
## Bug: Email not sending

Member "Jón Jónsson" (kennitala 010190-0000, email member@example.com)
reports emails not arriving.

**Steps to Reproduce**:
1. Log in as test member
2. Update email to test@example.com
3. Trigger email send
4. Email not received

**Expected**: Email arrives
**Actual**: Email not sent
```

**Good because**:
- Obviously fake name
- Invalid kennitala
- @example.com domain
- No phone number needed
- No database IDs
- Focus on behavior, not identity

---

## FAQ

### Q: Can I use my own email in examples?
**A**: Only if it's a throwaway address you don't mind being public. Better to use `email@example.com`.

### Q: What if I need to show a real bug with real data?
**A**: Reproduce the bug with fake data. If impossible, DM maintainers privately - never post in public issues.

### Q: Are kennitalas with invalid checksums safe to use?
**A**: Yes! Use "010190-0000" or "111111-1111" - these fail checksum validation so can't be real.

### Q: Can I mention member first names only?
**A**: Avoid it. Even "Sigurður from Reykjavik who joined in 2023" could be identifying. Use "Jón" or "Anna".

### Q: What about developers' names in commits?
**A**: Developer names in `git log` and `Co-Authored-By` are fine - developers expect public attribution. Members do not.

### Q: Can I attach database exports for debugging?
**A**: NO. Never attach exports containing member data. Create sanitized test data instead.

---

## Resources

- **Issue #240**: PII Prevention System (implementation)
- **Issue #136**: PII Exposure Incident (what NOT to do)
- **Issue #48**: Database Password Exposure (related security incident)
- **GDPR Info**: https://gdpr.eu/
- **Pre-commit Hook**: `scripts/git-hooks/pre-commit`
- **GitHub Actions**: `.github/workflows/pii-check.yml`

---

## Training Checklist

All contributors should:
- [ ] Read this document thoroughly
- [ ] Understand what PII is and why it matters
- [ ] Know the approved fake examples
- [ ] Test pre-commit hook with `git commit`
- [ ] Review Issue #136 incident (what went wrong)
- [ ] Understand when to use `--no-verify` (spoiler: almost never for PII)

---

**Remember**: When in doubt, use obviously fake data. Member privacy is non-negotiable.

🔒 **This is a public repository** - treat everything as if it will be indexed by Google and visible forever.
