# Claude Code Configuration

This directory contains all Claude Code rules and settings for the Ekklesia project.

## Configuration Files

- **`rules.md`**: Project-specific rules for Claude Code
  - Project identity and scope (avoid confusion with external Ekklesia platform)
  - Git commit rules (no AI attribution)
  - Documentation rules (PII masking)
  - Debugging methodology
  - CSS methodology
  - Account information

- **`settings.local.json`**: Claude Code settings (gitignored)
  - Tool auto-approvals
  - Local preferences
  - This file is not committed to git

## Consolidation (Oct 8, 2025)

Previously, this project had multiple `.claude` directories:
- `/home/gudro/Development/projects/ekklesia/.claude` (root)
- `/home/gudro/Development/projects/ekklesia/gcp/.claude` (removed)
- `/home/gudro/Development/projects/ekklesia/members/.claude` (removed)

And a separate `.code-rules` file in the root.

**All rules have been consolidated into `.claude/rules.md` in the project root.**

This ensures:
- Single source of truth for project rules
- No conflicting configurations
- Easier maintenance
- Clearer project structure

## Usage

Claude Code automatically loads `rules.md` from the `.claude` directory in the project root.

No action needed - rules are applied automatically when working in this project.
