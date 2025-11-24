---
title: "Documentation Heading Style Guide"
created: 2025-11-24
updated: 2025-11-24
status: active
category: standards
tags: [documentation, style-guide, headings, markdown, formatting]
related:
  - ./FRONTMATTER_STANDARD.md
  - ./TODO_CLEANUP_STRATEGY.md
  - ./DOCUMENTATION_QUALITY_IMPLEMENTATION_PLAN.md
author: Development Team
next_review: 2026-02-24
---

# Documentation Heading Style Guide

**Purpose:** Establish consistent heading conventions across all Ekklesia documentation

---

## Heading Level Rules

### H1 - Document Title (One per file)
- **Format:** Title Case
- **Usage:** First heading in file, matches frontmatter `title`
- **Count:** Exactly ONE per document
- **Example:** `# Cloud Run Services Architecture`

### H2 - Major Sections
- **Format:** Sentence case
- **Usage:** Top-level sections (Overview, Architecture, Implementation, etc.)
- **Example:** `## System architecture`

### H3 - Subsections
- **Format:** Sentence case
- **Usage:** Breakdown of H2 sections
- **Example:** `### Authentication flow`

### H4 - Sub-subsections
- **Format:** Sentence case
- **Usage:** Further detail within H3 sections
- **Example:** `#### Token validation`

### H5-H6 - Rarely Used
- **Format:** Sentence case
- **Usage:** Avoid if possible; consider restructuring instead
- **Note:** Deep nesting often indicates document should be split

---

## Title Case vs Sentence Case

### Title Case (H1 Only)
Capitalize:
- First and last words
- All major words (nouns, verbs, adjectives, adverbs)
- Words of 4+ letters

Do NOT capitalize:
- Articles (a, an, the)
- Conjunctions (and, but, or, nor)
- Prepositions of <4 letters (in, on, at, to, for)

**Examples:**
- `# Cloud Run Services Architecture` ✅
- `# Django Backend System Documentation` ✅
- `# Voting Flow and Anonymity Analysis` ✅
- `# Firebase App Check for Cloud Run Services` ✅

### Sentence Case (H2-H6)
Capitalize:
- First word
- Proper nouns (Firebase, Django, PostgreSQL, Kenni.is)
- Acronyms (API, JWT, RBAC, GDPR)

**Examples:**
- `## System architecture` ✅
- `## Authentication with Kenni.is` ✅
- `## Django REST API endpoints` ✅
- `## RBAC authorization flow` ✅

---

## Common Patterns

### Technical Terms
Preserve proper capitalization for:
- **Product names:** Firebase, Django, PostgreSQL, Google Cloud Run
- **Acronyms:** API, JWT, RBAC, GDPR, eID, OAuth, PKCE
- **File formats:** JSON, YAML, CSV, PDF
- **Protocols:** HTTP, HTTPS, WebSocket

**Examples:**
- `## Firebase authentication` ✅ (not "firebase authentication")
- `## JWT token structure` ✅ (not "jwt token structure")
- `## GDPR compliance analysis` ✅

### Code References
Use backticks for code elements in headings when necessary:
- `## The \`member_uid\` field` ✅
- `## Using \`git log\` for dates` ✅
- `## The \`/api/elections\` endpoint` ✅

### Question Headings
Use sentence case for question headings:
- `## What is Firebase App Check?` ✅
- `## How does voting anonymity work?` ✅
- `## Why use microservices?` ✅

---

## Document Structure Patterns

### Standard Documentation Structure

```markdown
---
[frontmatter]
---

# Document Title

**Document Type:** [Type]
**Last Updated:** YYYY-MM-DD
**Status:** [Status]

---

## Overview

[High-level summary]

## Architecture

[System design]

### Component diagram
### Data flow

## Implementation

[Technical details]

### Setup
### Configuration
### Usage

## Testing

[Test strategies]

## Troubleshooting

[Common issues]

## Related documentation

- [Link 1]
- [Link 2]
```

### Feature Documentation Structure

```markdown
---
[frontmatter]
---

# Feature Name

**Status:** [Planned/In Progress/Completed]
**GitHub Issue:** #XXX
**Epic:** [Epic name]

---

## Overview

[Feature description]

## Requirements

[User stories]

## Design

[Technical approach]

### Frontend
### Backend
### Database

## Implementation checklist

- [ ] Task 1
- [ ] Task 2

## Testing plan

[Test scenarios]

## Deployment

[Rollout strategy]
```

### Security Documentation Structure

```markdown
---
[frontmatter]
---

# Security Policy Name

**Last Reviewed:** YYYY-MM-DD
**Reviewers:** [List]
**Status:** Active

---

## Executive summary

[High-level overview]

## Threat model

[Security threats]

## Security controls

[Mitigations]

### Authentication
### Authorization
### Data protection

## Compliance

[GDPR, etc.]

## Incident response

[What to do if compromised]

## Audit trail

[Review history]
```

---

## Anti-Patterns (Avoid These)

### ❌ All Caps Headings
```markdown
## AUTHENTICATION FLOW  ❌
## Authentication flow  ✅
```

### ❌ Inconsistent Capitalization
```markdown
## System Architecture  ❌ (H2 should be sentence case)
## system architecture  ✅
```

### ❌ Trailing Punctuation
```markdown
## How does it work?  ❌ (remove question mark for consistency)
## How does it work   ✅
```
**Exception:** Keep question marks if document is Q&A format

### ❌ Overly Long Headings
```markdown
## This is a very detailed heading that explains the entire concept in one long sentence which makes navigation difficult  ❌

## Detailed concept explanation  ✅
[Paragraph text with full explanation]
```

### ❌ Using Bold Instead of Headings
```markdown
**Implementation Details**  ❌

## Implementation details  ✅
```

### ❌ Skipping Heading Levels
```markdown
## Major section
#### Sub-subsection  ❌ (skipped H3)

## Major section
### Subsection  ✅
```

---

## Emoji Usage in Headings

**General Rule:** Avoid emojis in headings unless:
1. Status indicators in front of titles
2. Consistent across document type
3. Clear meaning without emoji

**Acceptable:**
- `## ✅ Phase 5 complete` (status indicator)
- `## ⚠️ Breaking changes` (warning)
- `## 🔒 Security considerations` (icon category)

**Avoid:**
- `## This is super cool 🎉` (unnecessary flair)
- Random emojis without clear semantic meaning

---

## Table of Contents

For long documents (>500 lines), add a table of contents after the overview:

```markdown
## Table of Contents

1. [Introduction](#introduction)
2. [Architecture](#architecture)
   1. [Component diagram](#component-diagram)
   2. [Data flow](#data-flow)
3. [Implementation](#implementation)
```

**Note:** GitHub auto-generates heading anchors (lowercase, hyphens for spaces)

---

## Updating Existing Documentation

### Step-by-Step Process

1. **Read document** to understand content
2. **Check H1** - Should be Title Case, matches frontmatter
3. **Check H2-H6** - Should be Sentence case
4. **Fix capitalization:**
   - H1: Title Case
   - H2-H6: Sentence case (except proper nouns/acronyms)
5. **Remove trailing punctuation** (unless Q&A format)
6. **Check heading levels** - No skipped levels
7. **Test navigation** - Ensure headings are clear

### Automation Tool (Future)

Create `scripts/maintenance/fix-heading-case.py`:
```python
#!/usr/bin/env python3
"""Fix heading capitalization in markdown files."""

import re
import sys
from pathlib import Path

def fix_h1_title_case(line):
    """Convert H1 to Title Case."""
    # Implementation...
    pass

def fix_h2_h6_sentence_case(line):
    """Convert H2-H6 to Sentence case."""
    # Implementation...
    pass

if __name__ == '__main__':
    # Process docs/*.md files
    pass
```

---

## Examples from Existing Docs

### Before (Inconsistent)

```markdown
# CLOUD RUN SERVICES ARCHITECTURE  ❌

## SYSTEM OVERVIEW  ❌

### Authentication Flow  ❌ (Title Case for H3)

#### the /api/elections Endpoint  ❌ (lowercase first word)
```

### After (Consistent)

```markdown
# Cloud Run Services Architecture  ✅

## System overview  ✅

### Authentication flow  ✅

#### The `/api/elections` endpoint  ✅
```

---

## Priority Files for Heading Fixes

Apply this style guide to:

1. **Priority 1:** All 30 frontmatter Priority 1 files
2. **Priority 2:** High-traffic documentation (50+ files)
3. **Priority 3:** Remaining documentation (227 files)

**Estimated Time:**
- Automated: 1-2 hours (with script)
- Manual: 10-15 hours (top 30 files only)

---

## Questions & Support

**Q: What about non-documentation markdown (READMEs in code)?**
A: Focus on `docs/` directory first. READMEs in app code can follow looser conventions.

**Q: Should I fix heading case during other edits?**
A: Yes, if you're editing a file, fix heading case at the same time.

**Q: What about existing incorrect capitalizations?**
A: Fix during next edit, or batch-fix with automation script.

**Q: How strict should we be?**
A: H1 Title Case is critical. H2-H6 sentence case is important but less critical. Proper nouns/acronyms must always be correct.

---

## Checklist for New Documentation

When creating new documentation:

- [ ] H1 is Title Case and matches frontmatter `title`
- [ ] H2-H6 use Sentence case
- [ ] Proper nouns capitalized (Firebase, Django, PostgreSQL)
- [ ] Acronyms capitalized (API, JWT, RBAC, GDPR)
- [ ] No trailing punctuation in headings
- [ ] No skipped heading levels (H2 → H3 → H4)
- [ ] Maximum depth of H4 (consider splitting if deeper)
- [ ] Code elements use backticks in headings if needed
- [ ] Table of contents added if >500 lines

---

**Created:** 2025-11-24
**Author:** Development Team
**Status:** Active
**Next Review:** 2026-02-24
