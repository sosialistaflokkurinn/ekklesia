# Infrastructure Category Map

**Last Updated**: 2025-11-14
**Status**: ✅ Level 2 Category Map
**Purpose**: Cloud infrastructure, services, deployment pipelines, and documentation maintenance

---

## Overview

This category map provides navigation to all infrastructure documentation including Cloud Run services, GitHub workflows, database management, deployment automation, and documentation maintenance tools.

---

## Quick Links

- [Cloud Run Services](../docs/infrastructure/CLOUD_RUN_SERVICES.md) - Service configuration reference
- [GitHub Workflows](../docs/operations/GITHUB_WORKFLOWS_STATUS.md) - CI/CD workflows
- [Database Scripts](../scripts/database/) - Cloud SQL management
- [Documentation Maintenance](../scripts/admin/documentation-maintenance/) - Validation and audit tools

---

## Infrastructure Documentation

### Cloud Services
- [Cloud Run Services](../docs/infrastructure/CLOUD_RUN_SERVICES.md) - Comprehensive service documentation
- [Google Cloud Platform](https://cloud.google.com/) - Cloud provider
- [Firebase](https://firebase.google.com/) - Platform services
- [Cloud SQL PostgreSQL](https://cloud.google.com/sql/docs/postgres) - Database service

### CI/CD
- [GitHub Workflows Status](../docs/operations/GITHUB_WORKFLOWS_STATUS.md) - GitHub Actions workflows
- [GitHub Actions](https://docs.github.com/en/actions) - CI/CD platform

### Database Management
- [Database Scripts README](../scripts/database/README.md) - Cloud SQL tools and scripts
- [Cloud SQL Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy) - Secure database connections

### Deployment
- [Deployment Scripts README](../scripts/deployment/README.md) - Deployment automation tools
- [Firebase CLI](https://firebase.google.com/docs/cli) - Deployment tooling
- [gcloud CLI](https://cloud.google.com/sdk/gcloud) - Cloud deployment

### Documentation Maintenance
- [Admin Scripts README](../scripts/admin/README.md) - Administrative tools overview
- [Documentation Maintenance Scripts](../scripts/admin/documentation-maintenance/README.md) - Validation and audit tools
  - `validate-all.sh` - Master validation script (runs all checks)
  - `check-docs-freshness.sh` - Monitors documentation freshness
  - `validate-links.py` - Validates markdown links
  - `audit-docs.py` - Comprehensive documentation audit against codebase
  - `validate_documentation_map.py` - Validates DOCUMENTATION_MAP.md structure

---

## Related Categories

- [Operations](../docs/OPERATIONS_MAP.md) - Operational procedures
- [Architecture](../docs/ARCHITECTURE_MAP.md) - System architecture

---

**See**: [Documentation Philosophy](../docs/DOCUMENTATION_PHILOSOPHY.md) for hierarchy explanation
