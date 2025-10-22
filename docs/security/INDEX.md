# Security Documentation Index

Comprehensive security documentation covering policies, incidents, research, and responses.

## Quick Links

| Category | Purpose | Location |
|----------|---------|----------|
| **Policies** | Long-term security strategies | [policies/](policies/) |
| **Current Work** | Active research and logs | [current/](current/) |
| **Incidents** | Dated security incidents | [historical/](historical/) |
| **Issue Reviews** | GitHub issue security responses | [responses/](responses/) |

## Policies (Long-term)

### Credential Management
- [CREDENTIAL_MIGRATION_PLAN.md](policies/CREDENTIAL_MIGRATION_PLAN.md) - Plan for credential migration strategy

### Data Protection
- [HISTORY_PURGE_PLAN.md](policies/HISTORY_PURGE_PLAN.md) - Strategy for history data purging

## Current Work (Active)

### Logs & Monitoring
- [CRITICAL_ACTIONS_LOG.md](current/CRITICAL_ACTIONS_LOG.md) - Active critical actions log

### Research
- [FIREBASE_APP_CHECK_RESEARCH.md](current/FIREBASE_APP_CHECK_RESEARCH.md) - Firebase App Check research and findings

## Incident History (Dated)

### October 2025 Incidents
- [2025-10-16/FUNCTIONS_AUDIT.md](historical/2025-10-16/FUNCTIONS_AUDIT.md) - Cloud Functions security audit
- [2025-10-16/CRITICAL_SECURITY_RESPONSE.md](historical/2025-10-16/CRITICAL_SECURITY_RESPONSE.md) - Critical security response

## GitHub Issue Security Reviews

### PR Review Security Responses
- [ISSUES_31-40_SECURITY_REVIEW_RESPONSE.md](responses/ISSUES_31-40_SECURITY_REVIEW_RESPONSE.md) - Security review for issues #31-40
- [ISSUES_41-50_CRITICAL_REVIEW.md](responses/ISSUES_41-50_CRITICAL_REVIEW.md) - Critical security review for issues #41-50

## Incident Response Procedures

When a security incident occurs:
1. Document in `current/CRITICAL_ACTIONS_LOG.md`
2. Assess scope and impact
3. Create response document in `historical/YYYY-MM-DD/`
4. Archive once resolved

See relevant incident documents in `historical/` for response examples.
