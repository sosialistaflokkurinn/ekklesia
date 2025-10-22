# Ekklesia Security Policy

## PII and Secrets Policy for Open Repos

**Never commit or push any of the following to the repository:**

- Kennitala, national IDs, personal names, emails, phone numbers, addresses
- API keys, secrets, passwords, OAuth client secrets
- Service account credentials, private keys, certificates
- Sensitive config (e.g. database URLs, internal endpoints)

**How to enforce:**

- Use `.gitignore` for local secrets/config
- Use Secret Manager for all production secrets
- Review all PRs for accidental PII or secrets
- Use automated scanning (see below)

**Automated scanning:**

- Enable GitHub secret scanning (repo settings)
- Use pre-commit hooks to scan for secrets before commits:
  - Installation: `cp scripts/git-hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
  - Scans for: database passwords, API keys, GCP credentials, tokens, connection strings
  - Blocks commits if secrets are detected (can bypass with `--no-verify` if needed)
- Weekly security hygiene checks via GitHub Actions (`.github/workflows/security-hygiene.yml`)

**Reporting:**

- If you find PII or secrets in the repo, report immediately to platform maintainers and remove via force-push if needed.

**References:**
- [GitHub secret scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
- [Gitleaks](https://github.com/gitleaks/gitleaks)

---
Last updated: 2025-10-16# Security Policy

## Classification
- This repository is public. Do not commit sensitive data (PII, secrets, destructive runbooks).
- Internal operational procedures and destructive scripts are maintained in a private repository.

## Reporting a Vulnerability
- Email: security@sosialistaflokkurinn.is
- Expected response time: 48 hours
- Coordinated disclosure: 90 days from report unless extended by mutual agreement

## Scope
- Production services: Members (Cloud Functions), Events (Cloud Run), Elections (Cloud Run)
- Public endpoints and infrastructure code in this repository

## Out of Scope
- DoS/volume-based attacks (accepted risk for periodic meetings)
- Social engineering

## Operational Safety
- Admin/destructive operations are gated by roles and environment flags; do not document or store runbooks publicly.
- Use MFA for all accounts with elevated roles.
- All admin actions must be auditable via structured logs (UID, timestamps, before/after counts).

## Contact
- For urgent incidents, include “[SECURITY]” in the subject and provide reproduction details and impacted components.
