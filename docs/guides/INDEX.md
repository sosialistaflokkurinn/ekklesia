# INDEX.md – Guides Overview

This index provides a quick reference and summary for all documentation in `docs/guides`. Each entry includes a one-liner summary and a direct link to the guide.

| Guide | Summary |
|-------|---------|
| **Development & Integration** | |
| [MCP_SERVERS.md](MCP_SERVERS.md) | Connect Claude Code to external tools and data sources via Model Context Protocol (MCP): GitHub, Sentry, databases, project management tools, and hundreds more integrations. |
| **GitHub Management** | |
| [github/GITHUB_ISSUE_LABEL_MANAGEMENT.md](github/GITHUB_ISSUE_LABEL_MANAGEMENT.md) | Best practices for managing GitHub issues and labels using CLI, MCP tools, and direct API approaches. |
| [github/GITHUB_PR_MANAGEMENT.md](github/GITHUB_PR_MANAGEMENT.md) | Comprehensive guide to managing GitHub PRs with the `gh` CLI, including review, labels, milestones, merging, automation, and best practices. |
| [github/GITHUB_PR_QUICK_REFERENCE.md](github/GITHUB_PR_QUICK_REFERENCE.md) | One-page cheat sheet for the most common GitHub PR commands and metadata updates using the `gh` CLI. |
| [github/GITHUB_PR_REVIEW_REPLY_WORKFLOW.md](github/GITHUB_PR_REVIEW_REPLY_WORKFLOW.md) | Technical guide for responding to PR review comments using GitHub GraphQL API, with methods for threaded replies and batch processing. |
| [github/GITHUB_PROJECT_MANAGEMENT.md](github/GITHUB_PROJECT_MANAGEMENT.md) | Complete, production-tested reference for managing the Kosningakerfi Sósíalistaflokksins project board: real field/option IDs, working GraphQL/CLI examples, automation scripts, and current board state. |
| [github/GITHUB_PROJECT_MANAGEMENT.SUMMARY.md](github/GITHUB_PROJECT_MANAGEMENT.SUMMARY.md) | Quick summary of the GITHUB_PROJECT_MANAGEMENT guide with key takeaways and production data highlights. |
| [PR29_CAMPAIGN_LEARNINGS.md](PR29_CAMPAIGN_LEARNINGS.md) | Real-world learnings from PR#29 review response campaign: 74 responses, 8 issues created, 100% accuracy in 3 hours. Production-tested best practices. |
| **Security & Operations** | |
| [ADMIN_ALERTS.md](ADMIN_ALERTS.md) | Configure Cloud Logging alerts for destructive admin operations (e.g., scope=all reset). |
| [AUDIT_LOGGING.md](AUDIT_LOGGING.md) | Standardized audit logging format for all admin actions: structured fields for correlation, accountability, and compliance. |
| [MFA_ENFORCEMENT.md](MFA_ENFORCEMENT.md) | Audit and enforce Multi-Factor Authentication (MFA) for users with elevated roles (developer, election_manager, event_manager). |
| [OAUTH_TROUBLESHOOTING.md](OAUTH_TROUBLESHOOTING.md) | Diagnose and fix OAuth login issues with Kenni.is using correlation IDs and health check endpoints. |
| [PRIVATE_OPS_REPO.md](PRIVATE_OPS_REPO.md) | Maintain sensitive operational assets (runbooks, credentials, admin scripts) in a private repository outside the public codebase. |
| **Access Control** | |
| [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) | RBAC matrix for developers, election managers, and members; feeds the upcoming `/roles` page (Epic #87) and Phase 5 admin tooling. |

---

_Last updated: 2025-10-19_
_Guide index created Oct 14, 2025_
