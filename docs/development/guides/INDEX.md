# Guides Index

**Last Updated:** 2025-10-21  
**Status:** ✅ Current

Comprehensive reference for all operational guides organized by category.

## Guide Categories

- **[Admin Guides](admin/)** - Administrative operations (alerts, logging, MFA, permissions)
- **[Infrastructure](infrastructure/)** - Infrastructure and ops documentation
- **[Troubleshooting](troubleshooting/)** - Debugging and issue resolution
- **[Workflows](workflows/)** - Processes and workflow documentation
- **[Git Guides](git/)** - Git workflows and development
- **[GitHub Guides](github/)** - GitHub management and integration

## Table of Contents

1. [Administrative Operations](#administrative-operations)
2. [Infrastructure & Operations](#infrastructure--operations)
3. [Troubleshooting & Support](#troubleshooting--support)
4. [Workflow & Process Documentation](#workflow--process-documentation)
5. [Developer Guides](#developer-guides)

---

## Administrative Operations

### Admin Alerts
**Location:** [admin/ADMIN_ALERTS.md](admin/ADMIN_ALERTS.md)  
**Summary:** Alert configuration and monitoring for administrators

- Alert setup and configuration
- Referenced alert definitions in [admin/alerts/](admin/alerts/)

### Audit Logging
**Location:** [admin/AUDIT_LOGGING.md](admin/AUDIT_LOGGING.md)  
**Summary:** Audit logging setup and procedures

### MFA Enforcement
**Location:** [admin/MFA_ENFORCEMENT.md](admin/MFA_ENFORCEMENT.md)  
**Summary:** Multi-factor authentication enforcement policies

### Roles and Permissions
**Location:** [admin/ROLES_AND_PERMISSIONS.md](admin/ROLES_AND_PERMISSIONS.md)  
**Summary:** System roles and permission structure

---

## Infrastructure & Operations

### Private Operations Repository
**Location:** [infrastructure/PRIVATE_OPS_REPO.md](infrastructure/PRIVATE_OPS_REPO.md)  
**Summary:** Guide to the private operations repository setup and usage

---

## Troubleshooting & Support

### OAuth Troubleshooting
**Location:** [troubleshooting/OAUTH_TROUBLESHOOTING.md](troubleshooting/OAUTH_TROUBLESHOOTING.md)  
**Summary:** Common OAuth issues and resolution procedures

---

## Workflow & Process Documentation

### Usage Context
**Location:** [workflows/USAGE_CONTEXT.md](workflows/USAGE_CONTEXT.md)  
**Summary:** Context for system usage and integration patterns

### Campaign Learnings (PR29)
**Location:** [workflows/PR29_CAMPAIGN_LEARNINGS.md](workflows/PR29_CAMPAIGN_LEARNINGS.md)  
**Summary:** Learnings and best practices from PR29 campaign

---

## Developer Guides

### Git Guides
**Location:** [git/](git/)  
Available guides in this directory for git workflows

### GitHub Guides
**Location:** [github/](github/)  
Available guides for GitHub management and integration

---

## Development & Integration

### MCP_SERVERS.md
**Summary:** Connect Claude Code to external tools and data sources via Model Context Protocol (MCP)

- Integrations with GitHub, Sentry, databases, project management tools
- Hundreds of available MCP integrations
- Setup instructions and best practices
- Use when: Building AI-assisted workflows or external tool integrations
- **Related:** GITHUB_* guides for GitHub-specific MCP usage

---

## GitHub Management

### github/GITHUB_ISSUE_LABEL_MANAGEMENT.md
**Summary:** Best practices for managing GitHub issues and labels using CLI, MCP tools, and direct API

- Label naming conventions and taxonomy
- Bulk operations with `gh` CLI
- MCP-powered label management
- API approaches for programmatic updates
- Use when: Organizing issues, standardizing labels, automating label workflows

### github/GITHUB_PR_MANAGEMENT.md
**Summary:** Comprehensive guide to managing GitHub PRs with the `gh` CLI

- PR lifecycle: create, update, review, merge
- Label, milestone, and assignee management
- Review request automation
- Merging strategies and conflict resolution
- Best practices from real production workflows
- Use when: Managing pull requests, automating PR workflows, standardizing PR processes

### github/GITHUB_PR_QUICK_REFERENCE.md
**Summary:** One-page cheat sheet for the most common GitHub PR commands

- Quick syntax for common PR operations
- All essential `gh` CLI commands
- Metadata updates (labels, assignees, milestones)
- Perfect for terminal reference
- Use when: You need a quick command lookup without reading the full guide

### github/GITHUB_PR_REVIEW_REPLY_WORKFLOW.md
**Summary:** Technical guide for responding to PR review comments using GitHub GraphQL API

- Threaded reply techniques
- Batch processing review responses
- GraphQL query patterns for PR reviews
- Advanced automation examples
- Use when: Building PR review automation or batch reply systems

### github/GITHUB_PROJECT_MANAGEMENT.md
**Summary:** Complete, production-tested reference for managing the Kosningakerfi Sósíalistaflokksins project board

- Real field and option IDs from production
- Working GraphQL mutations with examples (PR #29, PR #34)
- Production automation scripts
- Current board state and priority breakdowns
- CLI vs Web Interface recommendations
- Use when: Managing the project board, automating board operations, or setting up project automation

### github/GITHUB_PROJECT_MANAGEMENT.SUMMARY.md
**Summary:** Quick summary of the GITHUB_PROJECT_MANAGEMENT guide with key takeaways

- Condensed version of the full guide
- Key production data highlights
- Quick reference for common board operations
- Use when: You need a quick overview without the full reference details

### PR29_CAMPAIGN_LEARNINGS.md
**Summary:** Real-world learnings from PR#29 review response campaign

- 74 responses in production
- 8 issues created from review feedback
- 100% accuracy in 3 hours
- Lessons learned and best practices
- Workflow optimization insights
- Use when: Planning large PR review operations or learning from production workflows

---

## Security & Operations

### ADMIN_ALERTS.md
**Summary:** Configure Cloud Logging alerts for destructive admin operations

- Alert setup for admin reset operations
- Log pattern configuration
- Cloud Logging best practices
- Email and Slack notification setup
- Use when: Setting up monitoring for destructive operations or creating security alerts

### AUDIT_LOGGING.md
**Summary:** Standardized audit logging format for all admin actions

- Audit log schema and structure
- Correlation ID usage for tracing
- Accountability and compliance fields
- Implementation examples
- Use when: Implementing audit trails or ensuring compliance logging

### MFA_ENFORCEMENT.md
**Summary:** Audit and enforce Multi-Factor Authentication (MFA) for users with elevated roles

- Monthly audit process
- MFA compliance verification
- Role-based MFA requirements
- Remediation and escalation workflows
- Firebase integration details
- Use when: Running security audits or enforcing MFA policies

### OAUTH_TROUBLESHOOTING.md
**Summary:** Diagnose and fix OAuth login issues with Kenni.is using correlation IDs

- Common OAuth authentication issues
- Troubleshooting workflow with correlation IDs
- Health check endpoints
- Configuration validation
- Secret management verification
- Use when: Debugging login failures or setting up OAuth integrations

### PRIVATE_OPS_REPO.md
**Summary:** Maintain sensitive operational assets outside the public repository

- Private repository structure and setup
- Runbook organization
- Production scripts and credentials
- Access control and team responsibilities
- Use when: Setting up operational infrastructure or managing sensitive assets

---

## Access Control

### ROLES_AND_PERMISSIONS.md
**Summary:** RBAC (Role-Based Access Control) matrix for the platform

- Developer role permissions
- Election manager capabilities
- Member role restrictions
- Permission matrix table
- Epic #87 integration (upcoming `/roles` page)
- Phase 5 admin tooling foundation
- Use when: Implementing role-based access, understanding permissions, or planning admin features

---

## Quick Navigation

| Task | Guide | Time |
|------|-------|------|
| Set up OAuth login | [OAUTH_TROUBLESHOOTING.md](troubleshooting/OAUTH_TROUBLESHOOTING.md) | 5-10 min |
| Manage a PR | [GITHUB_PR_MANAGEMENT.md](github/GITHUB_PR_MANAGEMENT.md) | 10-15 min |
| Quick PR command | [GITHUB_PR_QUICK_REFERENCE.md](github/GITHUB_PR_QUICK_REFERENCE.md) | 1-2 min |
| Update project board | [GITHUB_PROJECT_MANAGEMENT.md](github/GITHUB_PROJECT_MANAGEMENT.md) | 15-20 min |
| Audit MFA compliance | [MFA_ENFORCEMENT.md](admin/MFA_ENFORCEMENT.md) | 30-45 min |
| Configure alerts | [ADMIN_ALERTS.md](admin/ADMIN_ALERTS.md) | 10-15 min |
| Set up private ops | [PRIVATE_OPS_REPO.md](PRIVATE_OPS_REPO.md) | 20-30 min |
| Understand roles | [ROLES_AND_PERMISSIONS.md](admin/ROLES_AND_PERMISSIONS.md) | 10 min |

---

## Guide Statistics

- **Total guides:** 15 files
- **Total documentation:** ~12,000 lines
- **Categories:** Development, GitHub, Security, Operations, Access Control
- **Last audit:** 2025-10-20
- **Maintenance:** Monthly review of links and examples

---

_Last updated: 2025-10-20_
_Next review: 2025-10-27_

```
