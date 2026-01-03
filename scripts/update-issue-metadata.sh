#!/bin/bash
################################################################################
# update-issue-metadata.sh
#
# Bulk-update GitHub issue titles and/or bodies using the gh CLI. Handy for
# applying historical write-ups or cleanup on migration issues.
#
# Usage:
#   ./scripts/update-issue-metadata.sh [options] <issue> [more issues...]
#
# Examples:
#   # Replace the body from a markdown file and set a new title on issue #2
#   ./scripts/update-issue-metadata.sh --title "Task: ZITADEL tenant (superseded)" \
#       --body-file docs/snippets/issue-2.md 2
#
#   # Apply the same narrative body to several issues without changing titles
#   ./scripts/update-issue-metadata.sh --body-file notes/epic-history.md 1 24 86
#
#   # Preview changes without mutating GitHub
#   ./scripts/update-issue-metadata.sh --dry-run --title "Example" 50
#
# Options:
#   --owner <org>        Repository owner (default: sosialistaflokkurinn)
#   --repo <repo>        Repository name (default: ekklesia)
#   --title <text>       New issue title
#   --body <text>        New issue body (mutually exclusive with --body-file)
#   --body-file <path>   File containing the full markdown body
#   --dry-run            Show the gh commands instead of executing them
#   -h, --help           Show this help text
################################################################################

set -euo pipefail

# Colour helpers (ASCII sequences; safe on most terminals)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERR]${NC} $1"; }

usage() {
  sed -n '1,60p' "$0" | sed 's/^# //'
}

OWNER="sosialistaflokkurinn"
REPO="ekklesia"
NEW_TITLE=""
BODY_TEXT=""
BODY_FILE=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner)
      OWNER="$2"; shift 2 ;;
    --repo)
      REPO="$2"; shift 2 ;;
    --title)
      NEW_TITLE="$2"; shift 2 ;;
    --body)
      BODY_TEXT="$2"; shift 2 ;;
    --body-file)
      BODY_FILE="$2"; shift 2 ;;
    --dry-run)
      DRY_RUN=true; shift ;;
    -h|--help)
      usage; exit 0 ;;
    --)
      shift; break ;;
    -* )
      log_error "Unknown option: $1"; usage; exit 1 ;;
    * )
      break ;;
  esac
done

if [[ $# -lt 1 ]]; then
  log_error "Expected at least one issue number"
  usage
  exit 1
fi

if [[ -z "$NEW_TITLE" && -z "$BODY_TEXT" && -z "$BODY_FILE" ]]; then
  log_error "Nothing to update: supply --title, --body, or --body-file"
  exit 1
fi

if [[ -n "$BODY_TEXT" && -n "$BODY_FILE" ]]; then
  log_error "--body and --body-file cannot be used together"
  exit 1
fi

if [[ -n "$BODY_FILE" && ! -f "$BODY_FILE" ]]; then
  log_error "Body file not found: $BODY_FILE"
  exit 1
fi

command -v gh >/dev/null || { log_error "gh CLI is required"; exit 1; }

if ! gh auth status >/dev/null 2>&1; then
  log_error "gh CLI must be authenticated"
  exit 1
fi

ISSUES=($(printf '%s\n' "$@" | tr -d '#' | sort -u))

for issue in "${ISSUES[@]}"; do
  log_info "Updating issue #$issue in $OWNER/$REPO"
  cmd=(gh issue edit "$issue" --repo "$OWNER/$REPO")

  if [[ -n "$NEW_TITLE" ]]; then
    log_info "  new title: $NEW_TITLE"
    cmd+=(--title "$NEW_TITLE")
  fi

  if [[ -n "$BODY_FILE" ]]; then
    log_info "  body from file: $BODY_FILE"
    cmd+=(--body-file "$BODY_FILE")
  elif [[ -n "$BODY_TEXT" ]]; then
    preview=$(printf '%s' "$BODY_TEXT" | head -n 3)
    log_info "  body text preview:\n$(printf '    %s\n' "$preview")"
    cmd+=(--body "$BODY_TEXT")
  fi

  if $DRY_RUN; then
    log_warn "  [dry-run] ${cmd[*]}"
  else
    if "${cmd[@]}" >/dev/null; then
      log_success "  Issue #$issue updated"
    else
      log_error "  Failed to update issue #$issue"
    fi
  fi
done

if $DRY_RUN; then
  log_warn "Dry-run complete; no changes applied"
else
  log_success "Finished updating ${#ISSUES[@]} issue(s)"
fi
