#!/bin/bash
# Script to identify and move used scripts to archive

echo "======================================"
echo "Archiving Used Scripts"
echo "======================================"
echo ""

# Scripts that were confirmed used based on conversation
USED_SCRIPTS=(
    "gcp/install_gcloud_now.sh"        # Used to install gcloud CLI
    "gcp/quick_setup.sh"                # Used for gcloud setup
    "gcp/enable_apis.sh"                # Used to enable APIs
    "gcp/quick_ping.sh"                 # Used to test latency
    "gcp/test_regions.sh"               # Used for region testing
    "gcp/install_gcloud_fedora.sh"     # Installation guide used
    "gcp/install_manual.sh"             # Alternative install method
    "commit_auth_work.sh"               # Git helper (created, likely not used)
    "setup_git_and_commit.sh"           # Git setup (created, likely not used)
)

# One-time setup scripts that can be archived
echo "Moving used/one-time setup scripts to arch_scripts/:"
echo ""

for script in "${USED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        echo "  Moving $script"
        mv "$script" arch_scripts/
    fi
done

# Scripts to KEEP (still needed)
echo ""
echo "Keeping these scripts (still needed):"
echo "  - gcp/setup_secrets.sh (needed after billing)"
echo "  - gcp/setup_gcp_project.sh (needed for deployment)"
echo "  - auth/test_auth_flow.sh (for testing)"
echo "  - commit_gcp.sh (for committing GCP work)"
echo "  - portal/run-tests.sh (for testing)"
echo "  - portal/test-setup.sh (for testing)"
echo "  - voting/scripts/test-setup.sh (for testing)"
echo ""

echo "Done! Used scripts moved to arch_scripts/"