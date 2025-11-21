# Ekklesia Documentation Philosophy

**Last Updated**: 2025-11-07
**Status**: ✅ Active - Defines documentation organization and hierarchy
**Purpose**: Establishes the 3-level hierarchical documentation system

---

## Overview

The Ekklesia documentation follows a **3-level hierarchical structure** where information becomes progressively more detailed as you navigate deeper into the hierarchy.

### Core Principle

> **"Því neðar stigveldinu sem þú kemst, eru nákvæmari og nákvæmari upplýsingar"**
>
> *(The lower you go in the hierarchy, the more detailed and specific the information)*

This principle ensures:
- **Quick navigation** for those who need high-level overview
- **Progressive disclosure** of complexity
- **Clear information architecture** that scales with project growth
- **Reduced cognitive load** by separating concerns by detail level

---

## The 3-Level Hierarchy

### Level 1: Navigation Hub (DOCUMENTATION_MAP.md)

**Location**: `/DOCUMENTATION_MAP.md` (repository root)

**Purpose**: Top-level navigation that binds everything together

**Content**:
- Project overview and quick start
- Technology stack summary
- Current production status
- **Links to Level 2 category maps only**
- Quick links by role (developer, PM, DevOps)

**What NOT to include**:
- Detailed technical information
- Complete feature documentation
- Step-by-step guides
- Deep implementation details

**Example Structure**:
```markdown
# Documentation Map

## Quick Navigation
- [Code Standards](CODE_STANDARDS_MAP.md)
- [Development Guides](DEVELOPMENT_MAP.md)
- [Architecture](ARCHITECTURE_MAP.md)
- [Testing](TESTING_MAP.md)

## Technology Stack
Brief 1-2 sentence overview of each component

## Current Status
Production services and recent milestones (high-level only)
```

---

### Level 2: Category Maps (*_MAP.md)

**Location**: `/docs/*_MAP.md`

**Purpose**: Category-level navigation with overview and links to detailed guides

**Naming Convention**: `{CATEGORY}_MAP.md`
- `CODE_STANDARDS_MAP.md` - All code standards and style guides
- `DEVELOPMENT_MAP.md` - Developer guides and workflows
- `ARCHITECTURE_MAP.md` - System design and architecture
- `TESTING_MAP.md` - Testing guides and QA processes
- `OPERATIONS_MAP.md` - DevOps, deployment, and operations
- `FEATURES_MAP.md` - Feature-specific documentation

**Content**:
- **Brief category overview** (2-5 paragraphs max)
- **Quick reference table** (TL;DR for common needs)
- **Organized links to Level 3 guides**
- **Cross-references to related categories**
- **NO detailed implementation** - only summaries and pointers

**Example Structure** (CODE_STANDARDS_MAP.md):
```markdown
# Code Standards Category Map

## Overview
Brief explanation of our code standards philosophy (consistency, clarity, etc.)

## Quick Reference (TL;DR)
| Standard | Key Rule | Link |
|----------|----------|------|
| CSS | BEM methodology | [CSS Guide](standards/CSS_BEM_GUIDE.md) |
| JavaScript | ES6+ modules | [JS Guide](standards/JAVASCRIPT_GUIDE.md) |

## Standards by Technology

### Frontend Standards
- [CSS & BEM Guide](standards/CSS_BEM_GUIDE.md) - Brief 1-sentence description
- [HTML Guide](standards/HTML_GUIDE.md) - Brief 1-sentence description
- [JavaScript Guide](standards/JAVASCRIPT_GUIDE.md) - Brief 1-sentence description

### Cross-Cutting Standards
- [i18n Guide](standards/I18N_GUIDE.md) - Brief 1-sentence description
- [Documentation Guide](standards/DOCUMENTATION_GUIDE.md) - Brief 1-sentence description

## Related Categories
- [Development Guides](DEVELOPMENT_MAP.md) - For workflow and process
- [Testing](TESTING_MAP.md) - For quality assurance
```

---

### Level 3+: Detailed Guides

**Location**: `/docs/{category}/{subcategory}/GUIDE_NAME.md`

**Purpose**: Comprehensive implementation details, step-by-step guides, technical specifications

**Naming Convention**: Descriptive names indicating content
- `CSS_BEM_GUIDE.md` - Complete CSS/BEM documentation
- `JAVASCRIPT_GUIDE.md` - Complete JavaScript standards
- `ELECTION_VOTING_IMPLEMENTATION.md` - Full feature implementation
- `CLOUD_SQL_CONNECTION_GUIDE.md` - Detailed technical guide

**Content**:
- **Complete technical details**
- **Code examples and snippets**
- **Step-by-step instructions**
- **Implementation patterns**
- **Troubleshooting guides**
- **API references**
- **Architecture diagrams**

**Structure Freedom**: These documents can be as long and detailed as needed. They are the "deep dive" documentation where all the technical detail lives.

**Example Topics**:
- Specific coding standards (CSS, JavaScript, Python)
- Feature implementation guides
- Architecture deep dives
- API documentation
- Deployment procedures
- Troubleshooting guides

---

## Navigation Best Practices

### For Document Authors

1. **Start at the right level**:
   - Creating overview? → Level 2 (category map)
   - Documenting a feature? → Level 3 (detailed guide)
   - Never add detail to Level 1 (DOCUMENTATION_MAP.md)

2. **Link hierarchically**:
   - Level 1 links to Level 2 only
   - Level 2 links to Level 3 (and occasionally to other Level 2)
   - Level 3 can link anywhere (Level 3, Level 2, external)

3. **Keep category maps lean**:
   - Maximum 200-300 lines
   - More summaries, fewer details
   - When it grows too large, split Level 3 into subcategories

4. **Use consistent structure**:
   - All category maps follow same pattern
   - All detailed guides use similar sections (Overview, Prerequisites, Steps, etc.)

### For Document Readers

1. **Always start at Level 1** (DOCUMENTATION_MAP.md)
   - Understand what categories exist
   - Navigate to relevant category map

2. **Use Level 2 to find what you need**
   - Quick reference for common tasks
   - Browse available guides
   - Understand category scope

3. **Deep dive into Level 3 when needed**
   - Follow links from category map
   - Read full implementation details
   - Use as reference during development

---

## Directory Structure

```
/
├── DOCUMENTATION_MAP.md                    # LEVEL 1: Navigation hub
│
├── docs/
│   ├── CODE_STANDARDS_MAP.md              # LEVEL 2: Code standards category
│   ├── DEVELOPMENT_MAP.md                 # LEVEL 2: Development category
│   ├── ARCHITECTURE_MAP.md                # LEVEL 2: Architecture category
│   ├── TESTING_MAP.md                     # LEVEL 2: Testing category
│   ├── OPERATIONS_MAP.md                  # LEVEL 2: Operations category
│   ├── FEATURES_MAP.md                    # LEVEL 2: Features category
│   │
│   ├── standards/                         # LEVEL 3: Detailed standard guides
│   │   ├── CSS_BEM_GUIDE.md
│   │   ├── JAVASCRIPT_GUIDE.md
│   │   ├── HTML_GUIDE.md
│   │   ├── I18N_GUIDE.md
│   │   └── ...
│   │
│   ├── development/                       # LEVEL 3: Detailed development guides
│   │   ├── guides/
│   │   ├── workflows/
│   │   └── ...
│   │
│   ├── architecture/                      # LEVEL 3: Detailed architecture docs
│   │   ├── SYSTEM_DESIGN.md
│   │   ├── DATABASE_SCHEMA.md
│   │   └── ...
│   │
│   ├── features/                          # LEVEL 3: Detailed feature docs
│   │   ├── election-voting/
│   │   ├── member-portal/
│   │   └── ...
│   │
│   └── ...
│
├── apps/                                   # App-specific docs (often Level 3)
│   └── members-portal/
│       └── README.md
│
├── services/                               # Service-specific docs (often Level 3)
│   ├── events/
│   │   └── README.md
│   └── elections/
│       └── README.md
│
└── scripts/                                # Script-specific docs (often Level 3)
    ├── admin/
    │   └── README.md
    └── database/
        └── README.md
```

---

## Excluded Directories

The following directories are **excluded from the hierarchical documentation system**:

1. **`/docs/audits/`** - Historical audits and analysis (archival only)
2. **`/archive/`** - Deprecated code and documentation (historical reference)

These directories:
- Are not linked from category maps
- Are not validated for link integrity
- Are preserved for historical reference only
- Should not be referenced in active documentation

---

## Maintenance Guidelines

### When Creating New Documentation

1. **Determine the appropriate level**:
   - Is this a new category? → Create `{CATEGORY}_MAP.md` at Level 2
   - Is this a detailed guide? → Create in appropriate `/docs/{category}/` at Level 3
   - Never add to DOCUMENTATION_MAP.md except for new categories

2. **Update the category map**:
   - Add link to new Level 3 guide from appropriate Level 2 map
   - Update quick reference if applicable
   - Keep descriptions brief (1 sentence)

3. **Link from Level 1 if new category**:
   - Only add to DOCUMENTATION_MAP.md if creating entirely new category
   - Must be significant enough to warrant top-level navigation

### When Updating Existing Documentation

1. **Update at the appropriate level**:
   - Technical changes → Update Level 3 guide
   - New guide in category → Update Level 2 map
   - New category → Update Level 1 hub

2. **Maintain consistency**:
   - Use same structure as similar documents
   - Follow naming conventions
   - Keep category maps lean

3. **Validate links**:
   - Run `python3 scripts/admin/validate-links.py --exclude audits archive`
   - Fix any broken links
   - Ensure all new Level 3 docs are linked from Level 2

### When Reorganizing

1. **Preserve hierarchy**:
   - Don't mix levels (e.g., don't link Level 1 directly to Level 3)
   - Maintain clear category boundaries
   - Use git mv to preserve history

2. **Update all references**:
   - Search for old paths: `grep -r "old/path" docs/`
   - Update using sed or manual edits
   - Validate with link checker

3. **Document changes**:
   - Update category map with "Last Updated" date
   - Commit with clear message explaining reorganization
   - Consider creating GitHub issue for large changes

---

## Examples

### ✅ Good: Following the Hierarchy

**Level 1 (DOCUMENTATION_MAP.md)**:
```markdown
## Code Standards
- [Code Standards Category Map](CODE_STANDARDS_MAP.md) - All coding conventions and style guides
```

**Level 2 (CODE_STANDARDS_MAP.md)**:
```markdown
## Frontend Standards
- [CSS & BEM Guide](standards/CSS_BEM_GUIDE.md) - CSS methodology with BEM naming
- [JavaScript Guide](standards/JAVASCRIPT_GUIDE.md) - ES6+ standards and async patterns
```

**Level 3 (CSS_BEM_GUIDE.md)**:
```markdown
# CSS & BEM Guide

## BEM Naming Convention

### Block
A standalone component that is meaningful on its own.

.card {
  /* block styles */
}

### Element
Parts of a block that have no standalone meaning...
(continues with full implementation details)
```

### ❌ Bad: Violating the Hierarchy

**Level 1 (DOCUMENTATION_MAP.md)** - TOO MUCH DETAIL:
```markdown
## CSS Standards

Our CSS uses BEM methodology. Here are the naming rules:

### Block
.card { }

### Element
.card__title { }
...
(No! This detail belongs in Level 3, not Level 1)
```

**Level 2 (CODE_STANDARDS_MAP.md)** - WRONG LINKS:
```markdown
## Quick Links
- [Specific CSS rule on line 45](standards/CSS_BEM_GUIDE.md)
- Implementation detail link removed (example only, not a real file)
(No! Level 2 should link to guides, not specific implementation)
```

---

## Benefits of This System

1. **Scalability**: Can grow indefinitely without becoming overwhelming
2. **Findability**: Clear path to any information (Level 1 → Level 2 → Level 3)
3. **Maintainability**: Changes isolated to appropriate level
4. **Onboarding**: New developers start at Level 1, drill down as needed
5. **Reduced duplication**: Clear home for each piece of information
6. **Progressive disclosure**: Complexity revealed only when needed

---

## Related Documentation

- [DOCUMENTATION_MAP.md](/DOCUMENTATION_MAP.md) - Level 1 navigation hub
- [CODE_STANDARDS_MAP.md](CODE_STANDARDS_MAP.md) - Example Level 2 category map
- [Documentation Guide](standards/DOCUMENTATION_GUIDE.md) - Writing standards (Level 3)
- [scripts/admin/README.md](/scripts/admin/README.md) - Validation tools

---

**Document Status**: ✅ Active
**Last Reviewed**: 2025-11-07
**Next Review**: 2026-02-07 (Quarterly)
