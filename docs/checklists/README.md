# 📋 Ekklesia Checklists

This directory contains checklists for common administrative operations in the Ekklesia system.

---

## 📑 Available Checklists

| Checklist | File | Description |
|-----------|------|-------------|
| **User Logins** | [`CHECK_USER_LOGINS.md`](./CHECK_USER_LOGINS.md) | How to view who has logged into the system |

---

## 🎯 Purpose

Checklists are designed to:
- Make common operations repeatable and reliable
- Help new administrators learn the system
- Ensure security rules are followed
- Document best practices

---

## 🔐 Security Considerations

Many checklists deal with sensitive data. **Always:**
- Follow security rules in each file
- NEVER commit sensitive data to Git
- Use only in test environment when applicable
- Ensure you have permission to access the data

---

## 🆕 Creating a New Checklist

When creating a new checklist:

1. **Name the file**: Use `CHECK_ACTION_NAME.md` (e.g., `CHECK_USER_LOGINS.md`)
2. **Structure**:
   - Start with clear description of purpose
   - List prerequisites (authentication, access, etc.)
   - Provide step-by-step instructions with bash examples
   - Add troubleshooting section
   - Document all file locations
3. **Security**: If checklist deals with PII or sensitive data:
   - Mark it clearly at the top of the document
   - Add to `.gitignore` if applicable
   - Reference in `SESSION_START_REMINDER.md`
4. **Update this README**: Add new checklist to table above

---

## 📚 Related Documentation

- **Session reminder**: [`../../.claude/SESSION_START_REMINDER.md`](../../.claude/SESSION_START_REMINDER.md) - Read at start of new session
- **Script directories**:
  - Members scripts: `services/members/scripts/`
  - Database scripts: `scripts/database/`
  - Deployment: `scripts/deployment/`

---

## 🔄 Maintenance

**Update checklists when:**
- New procedures are added
- Old procedures change or become obsolete
- A bug is found in a process
- Security rules change

**Responsible**: All developers and administrators can update checklists

---

**Last Updated**: 2025-11-19
