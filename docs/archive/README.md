# Documentation Archive

This directory contains historical documentation that has been completed, superseded, or is no longer actively relevant.

## Archive Structure

```
docs/archive/
├── features/        # Historical feature plans and completed epics
├── planning/        # Superseded planning documents
├── development/     # Completed development checklists
└── README.md       # This file
```

## Archive Policy

### When to Archive

Documents are archived when:
- **Completed features**: Epic/feature was successfully implemented and deployed
- **Superseded plans**: Planning document replaced by newer approach or structure
- **Historical checklists**: Testing/deployment checklists for completed work
- **Obsolete documents**: Information no longer relevant (canceled feature, changed approach)

### When NOT to Archive

Documents stay active when:
- **In planning**: Feature/epic is planned but not yet started
- **In progress**: Work is actively ongoing
- **Reference material**: Standards, guides, or documentation still referenced
- **Future work**: Deferred to later phase but still relevant

## Archived Documentation

### Testing Archive

**Location:** `docs/testing/archive/`

#### I18N_POST_DEPLOYMENT_TEST_2025-11-05.md
- **Archived:** 2025-11-24
- **Reason:** Epic 159 completed and deployed (PR #171)
- **TODOs removed:** 61
- **Details:** See `docs/testing/archive/README.md`

## Archive Maintenance

**Frequency:** Quarterly review (or as part of documentation cleanup initiatives)
**Owner:** Development team
**Last Review:** 2025-11-24

### Quarterly Archive Review Checklist

- [ ] Review all documents in archive for continued relevance
- [ ] Move very old documents (>2 years) to deep archive
- [ ] Update archive README with new additions
- [ ] Verify all archived documents have clear rationale documented
- [ ] Check for broken links in archived documents

## Finding Archived Documentation

**Search by epic number:**
```bash
grep -r "Epic.*123" docs/archive/
```

**Search by feature name:**
```bash
grep -r "feature.*name" docs/archive/
```

**List recently archived (last 30 days):**
```bash
find docs/archive/ -name "*.md" -mtime -30
```

## Related Documentation

- [TODO Cleanup Strategy](../standards/TODO_CLEANUP_STRATEGY.md)
- [Documentation Quality Implementation Plan](../standards/DOCUMENTATION_QUALITY_IMPLEMENTATION_PLAN.md)
- [Checklist Splitting Recommendations](../standards/CHECKLIST_SPLITTING_RECOMMENDATIONS.md)

---

**Created:** 2025-11-24
**Last Updated:** 2025-11-24
**Maintained By:** Development Team
