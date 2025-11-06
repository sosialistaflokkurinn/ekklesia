#!/usr/bin/env python3
"""
Fix all broken links in DOCUMENTATION_MAP.md
This script:
1. Fixes service paths (add services/ prefix)
2. Updates moved doc paths (based on actual file locations)
3. Removes dead links to non-existent files
"""

import os
import re
from pathlib import Path

# Repository root
REPO_ROOT = Path(__file__).parent.parent.parent
DOC_MAP = REPO_ROOT / "DOCUMENTATION_MAP.md"

# Path mappings for moved files
PATH_MAPPINGS = {
    # Archive paths that don't exist - remove these
    'archive/README.md': None,
    'archive/docs/docs-2025-10-13/docs/DATABASE_REFERENCE.md': None,
    'archive/docs/docs-2025-10-13/docs/design/ELECTIONS_SERVICE_MVP.md': None,
    'archive/docs/docs-2025-10-13/docs/design/EVENTS_SERVICE_MVP.md': None,
    'archive/docs/docs-2025-10-13/docs/guides/BRANCH_STRATEGY.md': None,
    'archive/docs/docs-2025-10-13/docs/guides/DATABASE_QUICK_REFERENCE.md': None,
    'archive/docs/docs-2025-10-13/docs/guides/GITHUB_MCP_GUIDE.md': None,
    'archive/docs/docs-2025-10-13/docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md': None,
    'archive/docs/docs-2025-10-13/docs/guides/SECRET_MANAGER.md': None,
    'archive/docs/docs-2025-10-13/docs/guides/VSCODE_DATABASE_SETUP.md': None,
    'archive/docs/docs-2025-10-13/docs/plans/GOOGLE_AUTH_LINKING_PLAN.md': None,
    'archive/docs/docs-2025-10-13/docs/specifications/MEMBERS_OIDC_SPEC.md': None,
    'archive/docs/docs-2025-10-13/docs/specifications/members-oidc-v1.0.md': None,
    'archive/docs/docs-2025-10-13/docs/status/AUDIT_SUMMARY.md': None,
    'archive/docs/docs-2025-10-13/docs/status/CLEANUP_PLAN.md': None,
    'archive/docs/docs-2025-10-13/docs/status/CLOUDFLARE_SETUP_PLAN.md': None,
    'archive/docs/docs-2025-10-13/docs/status/CODE_AUDIT_2025-10-11_REVISED.md': None,
    'archive/docs/docs-2025-10-13/docs/status/DEBUGGING_2025-10-13_CORS_AND_TOKEN_ERRORS.md': None,
    'archive/docs/docs-2025-10-13/docs/status/PHASE_5_INTEGRATION_COMPLETE.md': None,
    'archive/docs/docs-2025-10-13/docs/status/PR28_AGUST_COMPLETE_REVIEW.md': None,
    'archive/docs/docs-2025-10-13/docs/status/SECURITY_HARDENING_PLAN.md': None,
    'archive/docs/docs-2025-10-13/legacy-docs-2025-10-03/GCP_MIGRATION_PLAN.md': None,
    'archive/docs/docs-2025-10-13/legacy-docs-2025-10-03/HYBRID_ARCHITECTURE.md': None,
    'archive/docs/docs-2025-10-13/legacy-docs-2025-10-03/TECHNICAL_SOLUTION.md': None,
    'archive/ops/audits/CODE_AUDIT_2025-10-11.md': None,
    'archive/ops/deployments/DATABASE_SECURITY_HARDENING.md': None,
    'archive/ops/deployments/ELECTIONS_SERVICE_DEPLOYMENT.md': None,
    'archive/ops/migrations/FIREBASE_MIGRATION_STATUS.md': None,
    'archive/ops/testing-logs/EVENTS_SERVICE_TESTING_LOG.md': None,
    'archive/projects/ekklesia-platform-evaluation/README.md': None,
    'archive/projects/members-service/documentation/FIREBASE_KENNI_SETUP.md': None,
    'archive/research/security/CLOUDFLARE_SETUP.md': None,

    # Docs moved to new structure
    'docs/ARCHITECTURE_DESIGN_PHASE6.md': 'docs/design/ARCHITECTURE_DESIGN_PHASE6.md',
    'docs/ARCHITECTURE_RECOMMENDATIONS.md': 'docs/design/ARCHITECTURE_RECOMMENDATIONS.md',
    'docs/AUDIT_2025-10-20.md': 'docs/audits/historical/ARCHIVE-INFLATED-CLAIMS/AUDIT_2025-10-20.md',
    'docs/AUDIT_2025-10-20_DETAILED.md': 'docs/audits/historical/ARCHIVE-INFLATED-CLAIMS/AUDIT_2025-10-20_DETAILED.md',
    'docs/CRITICAL_REVIEW_RESPONSE.md': 'docs/audits/workflows/reviews/CRITICAL_REVIEW_RESPONSE.md',
    'docs/DATABASE_REFERENCE.md': None,  # Removed - no longer exists
    'docs/DOCUMENTATION_CHANGELOG.md': 'docs/operations/DOCUMENTATION_CHANGELOG.md',
    'docs/LINK_VALIDATION_REPORT_2025-10-20.md': 'docs/audits/historical/ARCHIVE-INFLATED-CLAIMS/LINK_VALIDATION_REPORT_2025-10-20.md',
    'docs/MEMBERS_DEPLOYMENT_GUIDE.md': 'docs/setup/MEMBERS_DEPLOYMENT_GUIDE.md',
    'docs/OPERATIONAL_PROCEDURES.md': 'docs/operations/OPERATIONAL_PROCEDURES.md',
    'docs/SYSTEM_ARCHITECTURE_OVERVIEW.md': 'docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md',
    'docs/USAGE_CONTEXT.md': 'docs/development/guides/workflows/USAGE_CONTEXT.md',

    # Design docs
    'docs/design/CSS_DESIGN_SYSTEM.md': 'docs/architecture/CSS_DESIGN_SYSTEM.md',

    # Guides moved
    'docs/guides/INDEX.md': 'docs/development/guides/INDEX.md',
    'docs/guides/PR29_CAMPAIGN_LEARNINGS.md': 'docs/development/guides/workflows/PR29_CAMPAIGN_LEARNINGS.md',
    'docs/guides/ADMIN_ALERTS.md': 'docs/development/guides/admin/ADMIN_ALERTS.md',
    'docs/guides/AUDIT_LOGGING.md': 'docs/development/guides/admin/AUDIT_LOGGING.md',
    'docs/guides/MFA_ENFORCEMENT.md': 'docs/development/guides/admin/MFA_ENFORCEMENT.md',
    'docs/guides/OAUTH_TROUBLESHOOTING.md': 'docs/development/guides/troubleshooting/OAUTH_TROUBLESHOOTING.md',
    'docs/guides/PRIVATE_OPS_REPO.md': 'docs/development/guides/infrastructure/PRIVATE_OPS_REPO.md',
    'docs/guides/ROLES_AND_PERMISSIONS.md': 'docs/development/guides/admin/ROLES_AND_PERMISSIONS.md',
    'docs/guides/github/GITHUB_ISSUE_LABEL_MANAGEMENT.md': 'docs/development/guides/github/GITHUB_ISSUE_LABEL_MANAGEMENT.md',
    'docs/guides/github/GITHUB_PROJECT_MANAGEMENT.SUMMARY.md': 'docs/development/guides/github/GITHUB_PROJECT_MANAGEMENT.SUMMARY.md',
    'docs/guides/github/GITHUB_PROJECT_MANAGEMENT.md': 'docs/development/guides/github/GITHUB_PROJECT_MANAGEMENT.md',
    'docs/guides/github/GITHUB_PR_MANAGEMENT.md': 'docs/development/guides/github/GITHUB_PR_MANAGEMENT.md',
    'docs/guides/github/GITHUB_PR_QUICK_REFERENCE.md': 'docs/development/guides/github/GITHUB_PR_QUICK_REFERENCE.md',
    'docs/guides/github/GITHUB_PR_REVIEW_REPLY_WORKFLOW.md': 'docs/development/guides/github/GITHUB_PR_REVIEW_REPLY_WORKFLOW.md',
    'docs/guides/summarize-guides.sh': None,  # Script, not markdown

    # Integration docs - DO exist, keep as is
    # 'docs/integration/DJANGO_TO_EKKLESIA_MIGRATION.md': exists
    # 'docs/integration/DJANGO_SYNC_IMPLEMENTATION.md': exists

    # Prompts - don't exist
    'docs/prompts/BRANCH_DIFF_DOCUMENTATION_AUDIT.md': None,
    'docs/prompts/COMPARE_FIREBASE_TO_SECURITY_BRANCHES.md': None,

    # Reviews - don't exist
    'docs/reviews/PR28_AUDIT_REPORT.md': None,
    'docs/reviews/PR29_AUDIT_REPORT.md': None,
    'docs/reviews/PR29_REVIEW_INDEX.md': None,

    # Security docs
    'docs/security/CREDENTIAL_MIGRATION_PLAN.md': 'docs/security/policies/CREDENTIAL_MIGRATION_PLAN.md',
    'docs/security/CRITICAL_ACTIONS_LOG.md': 'docs/security/current/CRITICAL_ACTIONS_LOG.md',
    'docs/security/CRITICAL_SECURITY_RESPONSE.md': 'docs/security/historical/2025-10-16/CRITICAL_SECURITY_RESPONSE.md',
    'docs/security/FIREBASE_APP_CHECK_RESEARCH.md': 'docs/security/current/FIREBASE_APP_CHECK_RESEARCH.md',
    'docs/security/FUNCTIONS_AUDIT_2025-10-16.md': 'docs/security/historical/2025-10-16/FUNCTIONS_AUDIT.md',
    'docs/security/HISTORY_PURGE_PLAN.md': 'docs/security/policies/HISTORY_PURGE_PLAN.md',
    'docs/security/ISSUES_31-40_SECURITY_REVIEW_RESPONSE.md': 'docs/security/responses/ISSUES_31-40_SECURITY_REVIEW_RESPONSE.md',
    'docs/security/ISSUES_41-50_CRITICAL_REVIEW.md': 'docs/security/responses/ISSUES_41-50_CRITICAL_REVIEW.md',

    # Status docs
    'docs/status/CURRENT_PRODUCTION_STATUS.md': 'docs/status/CURRENT_DEVELOPMENT_STATUS.md',
    'docs/status/ELECTIONS_SCHEMA_MIGRATION_CHECKLIST.md': 'docs/status/ongoing/ELECTIONS_SCHEMA_MIGRATION_CHECKLIST.md',
    'docs/status/LOGIN_INCIDENT_2025-10-16.md': 'docs/status/historical/2025-10-16/LOGIN_INCIDENT.md',
    'docs/status/SESSION_2025-10-19_Phase5_Validation_Prep.md': 'docs/status/historical/2025-10-19/SESSION_Phase5_Validation_Prep.md',

    # Testing docs
    'docs/testing/ADMIN_RESET_CHECKLIST.md': None,
    'docs/testing/ADMIN_RESET_TEST_REPORT.md': None,
    'docs/testing/END_TO_END_VOTING_FLOW_TEST.md': None,

    # Roadmap
    'docs/roadmap/EPIC_24_IMPLEMENTATION_PLAN.md': 'docs/roadmap/EPIC_24_IMPLEMENTATION_PLAN.md',

    # Elections service (add services/ prefix)
    'elections/README.md': 'services/elections/README.md',
    'elections/deploy.sh': 'services/elections/deploy.sh',
    'elections/migrations/README.md': 'services/elections/migrations/README.md',
    'elections/src/config/database.js': 'services/elections/src/config/database.js',
    'elections/src/index.js': 'services/elections/src/index.js',
    'elections/src/middleware/appCheck.js': 'services/elections/src/middleware/appCheck.js',
    'elections/src/middleware/s2sAuth.js': 'services/elections/src/middleware/s2sAuth.js',
    'elections/src/routes/elections.js': 'services/elections/src/routes/elections.js',
    'elections/src/services/auditService.js': 'services/elections/src/services/auditService.js',

    # Events service (add services/ prefix)
    'events/README.md': 'services/events/README.md',
    'events/deploy.sh': 'services/events/deploy.sh',
    'events/migrations/README.md': 'services/events/migrations/README.md',
    'events/migrations/run-migration.sh': 'services/events/migrations/run-migration.sh',
    'events/src/config/database.js': 'services/events/src/config/database.js',
    'events/src/config/firebase.js': 'services/events/src/config/firebase.js',
    'events/src/index.js': 'services/events/src/index.js',
    'events/src/middleware/auth.js': 'services/events/src/middleware/auth.js',
    'events/src/routes/election.js': 'services/events/src/routes/election.js',
    'events/src/services/electionsClient.js': 'services/events/src/services/electionsClient.js',
    'events/src/services/tokenService.js': 'services/events/src/services/tokenService.js',

    # Members service (add services/ prefix)
    'members/README.md': 'services/members/README.md',
    'members/data/kennitalas.txt': 'services/members/data/kennitalas.txt',
    'members/firebase.json': 'services/members/firebase.json',
    'members/functions/main.py': 'services/members/functions/main.py',
    'members/functions/requirements.txt': 'services/members/functions/requirements.txt',
    'members/functions/test_security.sh': 'services/members/functions/test_security.sh',
    'members/public/ARCHITECTURE_REFACTOR.md': 'apps/members-portal/archive/ARCHITECTURE_REFACTOR.md',
    'members/public/CRITICAL_FIXES.md': 'apps/members-portal/archive/CRITICAL_FIXES.md',
    'members/public/FRONTEND_AUDIT_2025-10-15.md': 'apps/members-portal/archive/FRONTEND_AUDIT_2025-10-15.md',
    'members/public/TESTING_GUIDE.md': 'apps/members-portal/archive/TESTING_GUIDE.md',
    'apps/members-portal/ARCHITECTURE_REFACTOR.md': 'apps/members-portal/archive/ARCHITECTURE_REFACTOR.md',
    'apps/members-portal/FRONTEND_AUDIT_2025-10-15.md': 'apps/members-portal/archive/FRONTEND_AUDIT_2025-10-15.md',
    'members/public/firebase/app.js': 'apps/members-portal/firebase/app.js',
    'members/public/i18n/README.md': 'apps/members-portal/i18n/README.md',
    'members/public/js/dashboard.js': 'apps/members-portal/js/dashboard.js',
    'members/public/js/login.js': 'apps/members-portal/js/login.js',
    'members/public/js/profile.js': 'apps/members-portal/js/profile.js',
    'members/public/js/test-events.js': 'apps/members-portal/js/test-events.js',
    'members/scripts/README.md': 'services/members/scripts/README.md',
    'members/scripts/assign-role-to-me.sh': 'services/members/scripts/assign-role-to-me.sh',
    'members/setup-scripts/README.md': None,  # Doesn't exist
}

def fix_documentation_map() -> Any:
    """Fix all broken links in DOCUMENTATION_MAP.md"""

    print(f"Reading {DOC_MAP}")
    with open(DOC_MAP, 'r') as f:
        content = f.read()

    original_content = content
    fixes_made = 0
    links_removed = 0

    # Sort mappings by length (longest first) to avoid partial replacements
    sorted_mappings = sorted(PATH_MAPPINGS.items(), key=lambda x: len(x[0]), reverse=True)

    for old_path, new_path in sorted_mappings:
        # Escape special regex characters
        old_path_escaped = re.escape(old_path)

        if new_path is None:
            # Remove dead links - need to be careful here
            # Look for markdown links like: [text](old_path)
            pattern = r'\[([^\]]+)\]\(' + old_path_escaped + r'\)'
            matches = re.findall(pattern, content)
            if matches:
                # Remove the entire link, keeping just the text
                content = re.sub(pattern, r'\1', content)
                links_removed += len(matches)
                print(f"  Removed {len(matches)} dead link(s) to: {old_path}")

            # Also look for plain references (like in tables or lists)
            # Example: `archive/README.md` or archive/README.md
            pattern2 = r'`?' + old_path_escaped + r'`?'
            if old_path in content and new_path is None:
                # Check if it's not already in a link we removed
                remaining = re.findall(pattern2, content)
                if remaining and '[' not in str(remaining):
                    print(f"  Warning: Plain reference to {old_path} still exists")
        else:
            # Replace old path with new path
            count = content.count(old_path)
            if count > 0:
                content = content.replace(old_path, new_path)
                fixes_made += count
                print(f"  Fixed {count} reference(s): {old_path} → {new_path}")

    if content != original_content:
        print(f"\nWriting updated content to {DOC_MAP}")
        with open(DOC_MAP, 'w') as f:
            f.write(content)

        print(f"\n✅ COMPLETE")
        print(f"   - Fixed: {fixes_made} path updates")
        print(f"   - Removed: {links_removed} dead links")
    else:
        print("\n⚠️  No changes made")

    return fixes_made, links_removed

if __name__ == '__main__':
    fixes, removed = fix_documentation_map()
    print(f"\nTotal changes: {fixes + removed}")
