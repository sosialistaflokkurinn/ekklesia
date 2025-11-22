#!/bin/bash
################################################################################
# link-subissues.sh
#
# Ensure a parent tracking issue owns a set of follow-up issues, keeping
# metadata (milestone, type, project status/priority) aligned.
#
# Usage:
#   ./scripts/link-subissues.sh [options] <parent-issue> <child-issue> [more...]
#
# Examples:
#   # Link issues #54, #57, #62 under parent #86 and sync metadata
#   ./scripts/link-subissues.sh 86 54 57 62
#
#   # Link issues but skip project synchronisation
#   ./scripts/link-subissues.sh --no-project 86 54 57 62
#
# Options:
#   --owner <org>            Repository owner (default: sosialistaflokkurinn)
#   --repo <repo>            Repository name (default: ekklesia)
#   --project-number <n>     Project number for project item syncing (default: 1)
#   --status <name>          Status to apply (backlog|ready|in_progress|in_review|done).
#                             Default: in_progress. Ignored if --no-project.
#   --priority <name>        Priority to apply (p0|p1|p2). Default: p1. Ignored if
#                             --no-project.
#   --no-project             Skip project membership/status/priority updates.
#   --no-milestone           Skip milestone synchronisation.
#   --no-type                Skip issue type synchronisation.
#   --dry-run                Show planned actions without mutating GitHub.
#   -h, --help               Show this help text.
################################################################################

set -euo pipefail

# Colour helpers (ASCII only)
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
  sed -n '1,40p' "$0" | sed 's/^# //'
}

OWNER="sosialistaflokkurinn"
REPO="ekklesia"
PROJECT_NUMBER="1"
PROJECT_ID="PVT_kwDOAiQNe84BC_tu"
SYNC_PROJECT=true
SYNC_MILESTONE=true
SYNC_TYPE=true
DRY_RUN=false
STATUS_NAME="in_progress"
PRIORITY_NAME="p1"

# Project field IDs gathered from docs/guides/GITHUB_ISSUE_LABEL_MANAGEMENT.md
declare -A STATUS_IDS=(
  [backlog]="f75ad846"
  [ready]="61e4505c"
  [in_progress]="47fc9ee4"
  [in_review]="df73e18b"
  [done]="98236657"
)

declare -A PRIORITY_IDS=(
  [p0]="79628723"
  [p1]="0a877460"
  [p2]="da944a9c"
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner)
      OWNER="$2"; shift 2 ;;
    --repo)
      REPO="$2"; shift 2 ;;
    --project-number)
      PROJECT_NUMBER="$2"; shift 2 ;;
    --status)
      STATUS_NAME="$2"; shift 2 ;;
    --priority)
      PRIORITY_NAME="$2"; shift 2 ;;
    --no-project)
      SYNC_PROJECT=false; shift ;;
    --no-milestone)
      SYNC_MILESTONE=false; shift ;;
    --no-type)
      SYNC_TYPE=false; shift ;;
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

if [[ $# -lt 2 ]]; then
  log_error "Expected <parent> and at least one <child> issue number"
  usage
  exit 1
fi

PARENT_NUMBER="$1"
shift
CHILD_NUMBERS=($(printf '%s\n' "$@" | sort -u))

if $SYNC_PROJECT; then
  if [[ -z "${STATUS_IDS[$STATUS_NAME]:-}" ]]; then
    log_error "Unknown status '$STATUS_NAME' (expected: ${!STATUS_IDS[*]})"
    exit 1
  fi
  if [[ -z "${PRIORITY_IDS[$PRIORITY_NAME]:-}" ]]; then
    log_error "Unknown priority '$PRIORITY_NAME' (expected: ${!PRIORITY_IDS[*]})"
    exit 1
  fi
fi

command -v gh >/dev/null || { log_error "gh CLI is required"; exit 1; }
command -v jq >/dev/null || { log_error "jq is required"; exit 1; }

if ! gh auth status >/dev/null 2>&1; then
  log_error "gh CLI must be authenticated"
  exit 1
fi

fetch_issue() {
  local number="$1"
  gh api graphql -f query='query($owner:String!, $repo:String!, $number:Int!){repository(owner:$owner,name:$repo){issue(number:$number){id title issueType{id name} milestone{title} parent{number} projectItems(first:20){nodes{id project{id title} status:fieldValueByName(name:"Status"){...on ProjectV2ItemFieldSingleSelectValue{optionId name}} priority:fieldValueByName(name:"Priority"){...on ProjectV2ItemFieldSingleSelectValue{optionId name}}}}}}}' \
    -F owner="$OWNER" -F repo="$REPO" -F number="$number"
}

get_project_item_id() {
  local json="$1"
  echo "$json" | jq -r --arg pid "$PROJECT_ID" '.data.repository.issue.projectItems.nodes[]? | select(.project.id==$pid) | .id' | head -n1
}

get_project_item_field() {
  local json="$1" field="$2"
  echo "$json" | jq -r --arg pid "$PROJECT_ID" --arg field "$field" '.data.repository.issue.projectItems.nodes[]? | select(.project.id==$pid) | .[$field] | if . == null then "" else .optionId end' | head -n1
}

get_project_item_name() {
  local json="$1" field="$2"
  echo "$json" | jq -r --arg pid "$PROJECT_ID" --arg field "$field" '.data.repository.issue.projectItems.nodes[]? | select(.project.id==$pid) | .[$field] | if . == null then "" else .name end' | head -n1
}

get_issue_field() {
  local json="$1" field="$2"
  case "$field" in
    id)
      echo "$json" | jq -r '.data.repository.issue.id'
      ;;
    title)
      echo "$json" | jq -r '.data.repository.issue.title'
      ;;
    issueTypeId)
      echo "$json" | jq -r '.data.repository.issue.issueType.id // ""'
      ;;
    issueTypeName)
      echo "$json" | jq -r '.data.repository.issue.issueType.name // ""'
      ;;
    milestone)
      echo "$json" | jq -r '.data.repository.issue.milestone.title // ""'
      ;;
    parentNumber)
      echo "$json" | jq -r '.data.repository.issue.parent.number // ""'
      ;;
    *)
      echo ""
      ;;
  esac
}

parent_json=$(fetch_issue "$PARENT_NUMBER")
parent_id=$(get_issue_field "$parent_json" id)
parent_title=$(get_issue_field "$parent_json" title)
parent_type_id=$(get_issue_field "$parent_json" issueTypeId)
parent_type_name=$(get_issue_field "$parent_json" issueTypeName)
parent_milestone=$(get_issue_field "$parent_json" milestone)
parent_status_option=""
parent_priority_option=""

if $SYNC_PROJECT; then
  parent_status_option=$(get_project_item_field "$parent_json" status)
  parent_priority_option=$(get_project_item_field "$parent_json" priority)
  parent_status_name=$(get_project_item_name "$parent_json" status)
  parent_priority_name=$(get_project_item_name "$parent_json" priority)
  if [[ -z "$parent_status_option" ]]; then
    log_warn "Parent issue #$PARENT_NUMBER is not in project ID $PROJECT_ID; project sync will be skipped"
    SYNC_PROJECT=false
  else
    log_info "Parent project status: ${parent_status_name:-unknown} (option $parent_status_option)"
    log_info "Parent project priority: ${parent_priority_name:-unknown} (option $parent_priority_option)"
  fi
fi

log_info "Parent #$PARENT_NUMBER — $parent_title"

for child in "${CHILD_NUMBERS[@]}"; do
  log_info "Processing child #$child"
  child_json=$(fetch_issue "$child")
  child_id=$(get_issue_field "$child_json" id)
  child_title=$(get_issue_field "$child_json" title)
  child_type_id=$(get_issue_field "$child_json" issueTypeId)
  child_type_name=$(get_issue_field "$child_json" issueTypeName)
  child_milestone=$(get_issue_field "$child_json" milestone)
  current_parent=$(get_issue_field "$child_json" parentNumber)

  if [[ "$current_parent" == "$PARENT_NUMBER" ]]; then
    log_info "  Already linked to parent #$PARENT_NUMBER"
  else
    if $DRY_RUN; then
      log_info "  [dry-run] Would add sub-issue link to parent"
    else
      if output=$(gh api graphql -f query="mutation { addSubIssue(input: { issueId: \"$parent_id\", subIssueId: \"$child_id\" }) { subIssue { number } } }" 2>&1); then
        log_success "  Linked as sub-issue"
      else
        if grep -q "already tracked" <<<"$output"; then
          log_warn "  Already tracked: $output"
        else
          log_error "  Failed to link sub-issue: $output"
        fi
      fi
    fi
  fi

  if $SYNC_TYPE && [[ -n "$parent_type_id" ]]; then
    if [[ "$child_type_id" != "$parent_type_id" ]]; then
      if $DRY_RUN; then
        log_info "  [dry-run] Would change type from ${child_type_name:-unset} to ${parent_type_name:-unknown}"
      else
        gh api graphql -f query="mutation { updateIssueIssueType(input: { issueId: \"$child_id\", issueTypeId: \"$parent_type_id\" }) { issue { number issueType { name } } } }" >/dev/null
        log_success "  Issue type set to ${parent_type_name:-unknown}"
      fi
    fi
  fi

  if $SYNC_MILESTONE && [[ -n "$parent_milestone" ]]; then
    if [[ "$child_milestone" != "$parent_milestone" ]]; then
      if $DRY_RUN; then
        log_info "  [dry-run] Would set milestone '$parent_milestone' (current: ${child_milestone:-none})"
      else
        gh issue edit "$child" --repo "$OWNER/$REPO" --milestone "$parent_milestone" >/dev/null
        log_success "  Milestone set to '$parent_milestone'"
      fi
    fi
  fi

  if $SYNC_PROJECT; then
    child_project_item=$(get_project_item_id "$child_json")
    if [[ -z "$child_project_item" ]]; then
      if $DRY_RUN; then
        log_info "  [dry-run] Would add to project $PROJECT_NUMBER"
      else
        gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "https://github.com/$OWNER/$REPO/issues/$child" >/dev/null
        log_success "  Added to project $PROJECT_NUMBER"
      fi
      child_json=$(fetch_issue "$child")
      child_project_item=$(get_project_item_id "$child_json")
    fi

    if [[ -n "$child_project_item" ]]; then
      target_status=${parent_status_option:-${STATUS_IDS[$STATUS_NAME]}}
      if [[ -n "$target_status" ]]; then
        if $DRY_RUN; then
          log_info "  [dry-run] Would set project status to option $target_status"
        else
          gh api graphql -f query="mutation { updateProjectV2ItemFieldValue(input: { projectId: \"$PROJECT_ID\", itemId: \"$child_project_item\", fieldId: \"PVTSSF_lADOAiQNe84BC_tuzg1C03s\", value: { singleSelectOptionId: \"$target_status\" } }) { projectV2Item { id } } }" >/dev/null
          log_success "  Project status set"
        fi
      fi

      target_priority=${parent_priority_option:-${PRIORITY_IDS[$PRIORITY_NAME]}}
      if [[ -n "$target_priority" ]]; then
        if $DRY_RUN; then
          log_info "  [dry-run] Would set project priority to option $target_priority"
        else
          gh api graphql -f query="mutation { updateProjectV2ItemFieldValue(input: { projectId: \"$PROJECT_ID\", itemId: \"$child_project_item\", fieldId: \"PVTSSF_lADOAiQNe84BC_tuzg1C1F8\", value: { singleSelectOptionId: \"$target_priority\" } }) { projectV2Item { id } } }" >/dev/null
          log_success "  Project priority set"
        fi
      fi
    else
      log_warn "  Unable to locate project item after add; skipping status/priority"
    fi
  fi

done

log_success "Completed linking for ${#CHILD_NUMBERS[@]} issue(s)"
