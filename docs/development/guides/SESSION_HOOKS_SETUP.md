# Session Hooks Setup for Claude Code

This document explains how to set up session hooks in Claude Code to remind you of important considerations at the start of each session.

---

## 🎯 Purpose

Session hooks automatically run commands or display reminders when a new Claude Code session starts. This is useful for:
- Reminding about security rules
- Referencing checklists for common operations
- Ensuring necessary configurations are in place

---

## ⚙️ Setup

### 1. Create settings file

Claude Code uses `.claude/settings.local.json` for local settings (not tracked in Git).

```bash
# From project root directory
mkdir -p .claude
```

### 2. Create or update settings.local.json

Create the file `.claude/settings.local.json` with the following content:

```json
{
  "hooks": {
    "SessionStart": "cat docs/SESSION_START_REMINDER.md"
  }
}
```

Or if you want a simpler version that displays just a brief reminder:

```json
{
  "hooks": {
    "SessionStart": "echo '🔔 Reminder: See docs/SESSION_START_REMINDER.md for important information about PII, login reports, and security rules.'"
  }
}
```

### 3. Verify setup

Restart Claude Code or begin a new session. You should see the reminder automatically.

---

## 📝 Other hooks examples

### Display a brief reminder about checklists

```json
{
  "hooks": {
    "SessionStart": "echo '\n🔔 Session Start Reminder:\n  • Login reports: docs/checklists/CHECK_USER_LOGINS.md\n  • NEVER commit PII scripts (check-user-logins.js)\n  • See docs/SESSION_START_REMINDER.md for more\n'"
  }
}
```

### Run script that checks authentication

```json
{
  "hooks": {
    "SessionStart": "bash -c 'echo \"Checking GCP authentication:\" && gcloud auth list && echo \"\" && echo \"See SESSION_START_REMINDER.md for more information\"'"
  }
}
```

### Run multiple commands

```json
{
  "hooks": {
    "SessionStart": "bash -c 'cat docs/SESSION_START_REMINDER.md && echo \"\" && echo \"✅ Ready to begin!\"'"
  }
}
```

---

## 🔒 Security Considerations

**Important:**
- `.claude/settings.local.json` is already in `.gitignore`
- NEVER put passwords or tokens in hooks
- Hooks should only reference documents or run safe commands

---

## 📁 File Locations

| File | Location | Purpose |
|------|----------|---------|
| **Claude settings** | `.claude/settings.local.json` | Session hooks and local settings |
| **Session reminder** | `docs/SESSION_START_REMINDER.md` | Main reminder document |
| **Checklist directory** | `docs/checklists/` | All checklists |
| **Gitignore** | `.gitignore` | Protects sensitive data |

---

## ✅ Checklist

- [ ] Created `.claude/` directory
- [ ] Created `.claude/settings.local.json`
- [ ] Added `SessionStart` hook
- [ ] Tested with new session
- [ ] Verified reminder appears

---

## 🔄 Maintenance

When new reminders are added:
1. Update `docs/SESSION_START_REMINDER.md`
2. Session hooks don't need updating (they reference the document)
3. If you want to change hook implementation, update `.claude/settings.local.json`

---

## 📚 Further Information

- [Claude Code Documentation](https://docs.claude.com/claude-code)
- Session Start Reminder: `docs/SESSION_START_REMINDER.md`
- Checklists: `docs/checklists/README.md`

---

**Last Updated**: 2025-11-14
