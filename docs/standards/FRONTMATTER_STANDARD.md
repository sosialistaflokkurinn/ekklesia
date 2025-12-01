# Documentation Frontmatter Standard

**Created:** 2025-11-24
**Status:** Active
**Category:** Standards

---

## Purpose

This standard defines a consistent YAML frontmatter structure for all documentation files in the Ekklesia project. Frontmatter enables:

- **Automated tooling** - Scripts can parse metadata for freshness checks, indexing, navigation
- **Better navigation** - Cross-references and related documents
- **Lifecycle tracking** - Creation dates, update dates, status
- **Categorization** - Consistent taxonomy across 327+ markdown files
- **Search & discovery** - Tags enable content discovery

---

## Standard Frontmatter Schema

### Required Fields

```yaml
---
title: "Document Title"
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active | archived | deprecated | draft
category: category-name
---
```

### Optional Fields

```yaml
---
# Required fields...
tags: [tag1, tag2, tag3]
related:
  - path/to/related-doc.md
  - path/to/other-doc.md
author: Team Name | Individual
reviewers: [reviewer1, reviewer2]
next_review: YYYY-MM-DD
---
```

---

## Field Definitions

### title (required)
- **Type:** String
- **Format:** Title Case or Sentence case
- **Purpose:** Human-readable document title
- **Example:** `"Cloud Run Services Architecture"`
- **Note:** Should match the first H1 heading in the document

### created (required)
- **Type:** Date
- **Format:** `YYYY-MM-DD` (ISO 8601)
- **Purpose:** Track document age for freshness checks
- **Example:** `2025-11-24`
- **Note:** Use git log to determine creation date: `git log --follow --format=%ad --date=short <file> | tail -1`

### updated (required)
- **Type:** Date
- **Format:** `YYYY-MM-DD` (ISO 8601)
- **Purpose:** Track last meaningful update (not typo fixes)
- **Example:** `2025-11-24`
- **Note:** Update when content changes significantly

### status (required)
- **Type:** Enum
- **Values:**
  - `active` - Current, maintained documentation
  - `draft` - Work in progress, not ready for production
  - `archived` - Historical reference, no longer maintained
  - `deprecated` - Superseded by newer documentation
- **Purpose:** Lifecycle management
- **Example:** `active`

### category (required)
- **Type:** Enum (see Categories section)
- **Purpose:** Primary classification for organization
- **Example:** `infrastructure`
- **Note:** Choose ONE primary category

### tags (optional)
- **Type:** Array of strings
- **Format:** Lowercase, hyphen-separated
- **Purpose:** Multi-dimensional classification, search
- **Example:** `[authentication, firebase, oauth, kenni-is]`
- **Guidelines:**
  - Use 3-7 tags per document
  - Be specific (prefer `kenni-is` over generic `auth`)
  - Reuse existing tags when possible

### related (optional)
- **Type:** Array of relative file paths
- **Purpose:** Cross-document navigation
- **Example:**
  ```yaml
  related:
    - ../infrastructure/CLOUD_RUN_SERVICES.md
    - ./DJANGO_BACKEND_SYSTEM.md
  ```
- **Note:** Use relative paths from document location

### author (optional)
- **Type:** String
- **Purpose:** Document ownership/contact
- **Example:** `Development Team` or `Infrastructure Team`

### reviewers (optional)
- **Type:** Array of strings
- **Purpose:** Who reviewed this document
- **Example:** `[team-lead, senior-dev]`

### next_review (optional)
- **Type:** Date
- **Format:** `YYYY-MM-DD`
- **Purpose:** Schedule documentation freshness reviews
- **Example:** `2026-02-24`
- **Note:** Typically 3-6 months after last update

---

## Categories

### Standard Categories

| Category | Description | Example Files |
|----------|-------------|---------------|
| `architecture` | System design, high-level structure | CLOUD_RUN_SERVICES.md, FIRESTORE_SCHEMA.md |
| `development` | Development guides, coding standards | DEVELOPMENT_MAP.md, CODE_QUALITY_*.md |
| `features` | Feature specifications, epics | EPIC_87_ELECTION_DISCOVERY.md, EPIC_24_*.md |
| `infrastructure` | Deployment, hosting, infrastructure | DEPLOYMENT.md, GOOGLE_CLOUD_SETUP.md |
| `integration` | API integration, external services | DJANGO_API_IMPLEMENTATION.md, KENNI_IS_OAUTH.md |
| `security` | Security policies, authentication | VOTING_ANONYMITY_MODEL.md, FIREBASE_APP_CHECK.md |
| `standards` | Documentation standards, policies | FRONTMATTER_STANDARD.md, TODO_CLEANUP_STRATEGY.md |
| `systems` | Backend systems documentation | DJANGO_BACKEND_SYSTEM.md, ELECTIONS_SERVICE.md |
| `testing` | Test plans, QA documentation | I18N_POST_DEPLOYMENT_TEST.md, E2E_TESTING.md |
| `audits` | Audit reports, findings | AUDIT_REPORT_2025-11-05.md |
| `status` | Project status, roadmaps | CURRENT_DEVELOPMENT_STATUS.md, PHASE_5_OVERVIEW.md |

---

## Implementation Guidelines

### Priority 1 Files (Apply First)

Add frontmatter to these 30 high-priority files:

**Architecture (7 files):**
1. docs/infrastructure/CLOUD_RUN_SERVICES.md
2. docs/infrastructure/FIRESTORE_SCHEMA.md
3. docs/infrastructure/ARCHITECTURE.md
4. docs/systems/DJANGO_BACKEND_SYSTEM.md
5. docs/systems/ELECTIONS_SERVICE.md
6. docs/systems/EVENTS_SERVICE.md
7. docs/integration/ARCHITECTURE.md

**Security (5 files):**
1. docs/security/current/FIREBASE_APP_CHECK_RESEARCH.md
2. docs/security/policies/VOTING_ANONYMITY_MODEL.md
3. docs/security/policies/GDPR_VOTING_ANONYMITY_ANALYSIS.md
4. docs/security/policies/RBAC_AUTHORIZATION.md
5. docs/security/current/SECURITY_BEST_PRACTICES.md

**Development (8 files):**
1. docs/status/CURRENT_DEVELOPMENT_STATUS.md
2. docs/development/guides/DEVELOPMENT_MAP.md
3. docs/development/CODE_QUALITY_IMPROVEMENT_PLAN.md
4. docs/development/guides/election-feature/OVERVIEW.md
5. docs/standards/FRONTMATTER_STANDARD.md
6. docs/standards/TODO_CLEANUP_STRATEGY.md
7. docs/standards/CHECKLIST_SPLITTING_RECOMMENDATIONS.md
8. docs/standards/DIAGRAM_RECOMMENDATIONS.md

**Features (5 files):**
1. docs/features/election-voting/EPIC_87_ELECTION_DISCOVERY.md
2. docs/features/election-voting/EPIC_24_ADMIN_LIFECYCLE.md
3. docs/features/authentication/KENNI_IS_OAUTH.md
4. docs/features/member-management/MEMBER_SYNC.md
5. docs/features/events/EVENTS_FEATURE_OVERVIEW.md

**Integration (5 files):**
1. docs/integration/DJANGO_API_IMPLEMENTATION.md
2. docs/integration/DJANGO_BACKEND.md
3. docs/integration/API_REFERENCE.md
4. docs/integration/BIDIRECTIONAL_SYNC.md
5. docs/integration/DJANGO_ADDRESS_SYSTEM_DEEP_DIVE.md

### How to Add Frontmatter

1. **Read existing file** to understand content
2. **Determine creation date:**
   ```bash
   git log --follow --format=%ad --date=short <file> | tail -1
   ```
3. **Determine last update:**
   ```bash
   git log -1 --format=%ad --date=short <file>
   ```
4. **Choose appropriate category** from table above
5. **Add 3-7 relevant tags** (specific, reusable)
6. **Add related documents** if cross-references exist
7. **Insert frontmatter at top of file** (before title)

### Example Implementation

**Before:**
```markdown
# Cloud Run Services Architecture

This document describes the Cloud Run microservices...
```

**After:**
```markdown
---
title: "Cloud Run Services Architecture"
created: 2025-10-15
updated: 2025-11-24
status: active
category: infrastructure
tags: [cloud-run, microservices, firebase, architecture, gcp]
related:
  - ../systems/DJANGO_BACKEND_SYSTEM.md
  - ../integration/ARCHITECTURE.md
  - ./FIRESTORE_SCHEMA.md
---

# Cloud Run Services Architecture

This document describes the Cloud Run microservices...
```

---

## Tooling

### Automated Frontmatter Validation

Create script: `scripts/maintenance/validate-frontmatter.py`

```python
#!/usr/bin/env python3
"""Validate frontmatter in markdown files."""

import yaml
import sys
from pathlib import Path

REQUIRED_FIELDS = ['title', 'created', 'updated', 'status', 'category']
VALID_STATUSES = ['active', 'draft', 'archived', 'deprecated']
VALID_CATEGORIES = [
    'architecture', 'development', 'features', 'infrastructure',
    'integration', 'security', 'standards', 'systems', 'testing',
    'audits', 'status'
]

def validate_frontmatter(file_path):
    """Validate frontmatter in a markdown file."""
    # Implementation...
    pass

if __name__ == '__main__':
    # Validate all docs/*.md files
    pass
```

### Freshness Check Integration

Update `scripts/maintenance/check-docs-freshness.sh` to:
- Parse frontmatter `updated` field
- Alert on documents >90 days old with `status: active`
- Check if `next_review` date has passed

---

## Migration Plan

### Week 4 Day 1-2 (2025-11-24 to 2025-11-25)

1. **Create this standard** ✅
2. **Add frontmatter to Priority 1 files** (30 files)
   - Architecture: 7 files
   - Security: 5 files
   - Development: 8 files
   - Features: 5 files
   - Integration: 5 files
3. **Create validation script**
4. **Test with 5 files, iterate on standard if needed**

### Week 4 Day 3 (2025-11-26)

5. **Apply to remaining high-traffic files** (~20 more files)
6. **Add frontmatter parsing to freshness check script**

### Future Work

- Add frontmatter to all 327 markdown files (gradual)
- Generate documentation index from frontmatter
- Build automated cross-reference checker
- Create documentation dashboard (by category, status, age)

---

## Benefits

### Immediate
- Consistent metadata across all documentation
- Easy to identify outdated documentation
- Better search and discovery
- Clear ownership and review cycles

### Long-term
- Automated documentation health monitoring
- Generated navigation/index pages
- Broken link detection (via `related` field)
- Documentation coverage by category
- Automated archival workflows

---

## Examples

### Architecture Document

```yaml
---
title: "Cloud Run Services Architecture"
created: 2025-10-15
updated: 2025-11-24
status: active
category: infrastructure
tags: [cloud-run, microservices, firebase, architecture, gcp]
related:
  - ../systems/DJANGO_BACKEND_SYSTEM.md
  - ../integration/ARCHITECTURE.md
author: Infrastructure Team
next_review: 2026-02-24
---
```

### Security Policy

```yaml
---
title: "Voting Anonymity Model"
created: 2025-10-20
updated: 2025-11-24
status: active
category: security
tags: [voting, anonymity, privacy, elections, tokens]
related:
  - ./GDPR_VOTING_ANONYMITY_ANALYSIS.md
  - ../../features/election-voting/EPIC_87_ELECTION_DISCOVERY.md
author: Security Team
reviewers: [legal-advisor, privacy-officer]
next_review: 2026-05-24
---
```

### Feature Epic

```yaml
---
title: "Epic 87: Election Discovery & Browse UI"
created: 2025-11-10
updated: 2025-11-24
status: draft
category: features
tags: [epic, elections, ui, discovery, phase-6]
related:
  - ./EPIC_24_ADMIN_LIFECYCLE.md
  - ../../systems/ELECTIONS_SERVICE.md
author: Frontend Team
---
```

### Archived Document

```yaml
---
title: "Phase 4 Implementation Plan"
created: 2025-08-15
updated: 2025-10-30
status: archived
category: status
tags: [roadmap, phase-4, completed]
related:
  - ../CURRENT_DEVELOPMENT_STATUS.md
---
```

---

## Questions & Support

**Q: What if a document fits multiple categories?**
A: Choose the PRIMARY category. Use `tags` for secondary classification.

**Q: How do I determine creation date for old files?**
A: Use `git log --follow --format=%ad --date=short <file> | tail -1`

**Q: Should I update the `updated` field for typo fixes?**
A: No. Only update for meaningful content changes.

**Q: Can I add custom fields?**
A: Yes, but stick to the standard for consistency. Propose additions to this standard first.

**Q: What about non-documentation markdown files (like READMEs)?**
A: Focus on `docs/` directory first. READMEs in source code may skip frontmatter.

---

**Created:** 2025-11-24
**Author:** Development Team
**Status:** Active
**Next Review:** 2026-02-24
