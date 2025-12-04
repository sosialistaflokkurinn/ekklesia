# Git Hooks for Ekklesia

This directory contains custom Git hooks to enforce code quality and security standards.

## Available Hooks

### `pre-commit` - Secret Detection & Code Quality

**Purpose:** Prevent committing sensitive data (passwords, API keys, tokens) to the repository.

**Features:**
1. **Secret Scanning:** Detects patterns that might be credentials:
   - Database passwords (20+ character base64 strings)
   - API keys and tokens
   - GCP private keys
   - Connection strings with embedded passwords

2. **Political Identity Check:** Ensures Sósíalistaflokk/Socialist identity in code files

3. **Smart Exclusions:** Skips documentation, tests, and config files

**What it blocks:**
```python
# ❌ BLOCKED - Hardcoded password
PASSWORD = "***REMOVED***"

# ❌ BLOCKED - API key in code
API_KEY = "AIzaSyBcdefghijklmnopqrstuvwxyz1234567890"

# ❌ BLOCKED - Private key
PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg..."
```

**What it allows:**
```python
# ✅ ALLOWED - Environment variable reference
PASSWORD = os.getenv('DATABASE_PASSWORD')

# ✅ ALLOWED - Secret Manager reference
API_KEY = get_secret('api-key')

# ✅ ALLOWED - Placeholder in documentation
# Example: PASSWORD="your-password-here"
```

---

## Installation

### Option 1: Automatic Installation (Recommended)

```bash
# Install hooks
./scripts/setup/install-git-hooks.sh
```

### Option 2: Manual Installation

```bash
# Copy pre-commit hook
cp git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Test installation
.git/hooks/pre-commit
```

---

## Usage

### Normal Workflow

The hook runs automatically on `git commit`:

```bash
# Stage your changes
git add file.py

# Commit (hook runs automatically)
git commit -m "fix: update configuration"

# Output:
# 🔍 Running Ekklesia pre-commit checks...
# 🏴 Checking political identity in staged files...
# ✅ Pre-commit checks passed
# 🔐 Scanning for exposed secrets...
# ✅ No secrets detected in staged files
```

### If Secrets Detected

```bash
git commit -m "add: database configuration"

# Output:
# 🔍 Running Ekklesia pre-commit checks...
# 🔐 Scanning for exposed secrets...
#
# ⚠️ Potential secret detected in: config.py
#    Pattern: password.*=.*[A-Za-z0-9+/]{20,}
#    Line 5: PASSWORD = "***REMOVED***"
#
# ❌ Commit blocked: Potential secrets detected!
#
# Please review the matched lines above.
#
# If these are NOT secrets:
#   - Move to environment variables (Secret Manager)
#   - Use placeholder values in examples
#   - Document in comments why this is safe
#
# If you're SURE these are safe:
#   git commit --no-verify
```

### Bypass Hook (Use Carefully!)

If you're absolutely sure the flagged content is safe:

```bash
git commit --no-verify -m "docs: add password example"
```

**⚠️ Warning:** Only use `--no-verify` for:
- Documentation examples with fake credentials
- Test fixtures with dummy data
- Configuration templates with placeholders

**Never** bypass for actual production credentials!

---

## Testing the Hook

### Test 1: Detect Hardcoded Password

```bash
# Create test file with hardcoded password
echo 'PASSWORD = "***REMOVED***"' > test_secret.py

# Try to commit (should be blocked)
git add test_secret.py
git commit -m "test: secret detection"

# Expected: ❌ Commit blocked
```

### Test 2: Allow Environment Variable

```bash
# Create test file with env var
echo 'PASSWORD = os.getenv("DATABASE_PASSWORD")' > test_env.py

# Try to commit (should succeed)
git add test_env.py
git commit -m "test: env var usage"

# Expected: ✅ Commit successful
```

### Test 3: Skip Documentation

```bash
# Create markdown with example password
echo '```bash\nPASSWORD="example-password-here"\n```' > README.md

# Try to commit (should succeed - docs are excluded)
git add README.md
git commit -m "docs: add example"

# Expected: ✅ Commit successful (markdown excluded from secret scanning)
```

---

## Customization

### Add New Secret Patterns

Edit `git-hooks/pre-commit` and add to `SECRET_PATTERNS` array:

```bash
SECRET_PATTERNS=(
  # ... existing patterns ...
  
  # Your custom pattern
  'custom_secret.*=.*[A-Za-z0-9]{32,}'
)
```

### Exclude Additional Files

Add to `EXCLUDE_PATTERNS` array:

```bash
EXCLUDE_PATTERNS=(
  # ... existing patterns ...
  
  # Your exclusion
  'examples/.*'   # Exclude examples directory
)
```

---

## Troubleshooting

### Hook Not Running

```bash
# Check if hook is executable
ls -la .git/hooks/pre-commit

# Should show: -rwxr-xr-x (executable)

# If not executable:
chmod +x .git/hooks/pre-commit
```

### Hook Always Blocks Commits

```bash
# Test hook manually to see output
.git/hooks/pre-commit

# Check which files are staged
git diff --cached --name-only

# Review the flagged patterns
```

### Need to Commit Despite Warning

```bash
# Use --no-verify for emergency commits
git commit --no-verify -m "emergency: hotfix"

# But NEVER for production secrets!
```

---

## Related

- **Issue #48:** Database password exposure incident (root cause for this hook)
- **Security Documentation:** `docs/SECURITY.md`
- **Guidelines:** `.github/GITHUB_AUTOMATION_GUIDE.md`

---

## Maintenance

### Update Hook

```bash
# Pull latest changes
git pull origin main

# Reinstall hooks
./scripts/setup/install-git-hooks.sh
```

### Check Hook Version

```bash
# View hook file
cat .git/hooks/pre-commit

# Look for version comment at top
```

---

## Best Practices

1. **Always use Secret Manager** for production credentials
2. **Use environment variables** in code (`os.getenv()`, `process.env`)
3. **Use placeholders** in documentation (`your-password-here`)
4. **Test hooks** before committing sensitive changes
5. **Never bypass** for real credentials (even in development)

---

**Last Updated:** December 4, 2025
**Related Incident:** Issue #48 (Database password exposure)
**Status:** Active
