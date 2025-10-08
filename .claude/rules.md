# Claude Code Rules for Ekklesia Platform

## Project Identity & Scope

### THIS Project (Ekklesia - Samstaða Internal Platform)
- **Name**: Ekklesia (Custom e-democracy platform for Samstaða party)
- **Organization**: Samstaða (Icelandic Social Democratic Party)
- **Repository**: https://github.com/sosialistaflokkurinn/ekklesia
- **Purpose**: Election administration and voting for party members
- **Focus**: Elections (officer selection, referendums, board votes)
- **Architecture**: Custom-built (Members, Events, Voting services)
- **Status**: Members ✅ Production, Events 🔨 Design, Voting 📋 Design

### NOT This Project (External Ekklesia Platform)
- **Name**: Ekklesia Platform (Open-source proposition platform)
- **Organization**: German Pirate Party and others
- **Repository**: https://github.com/edemocracy/ekklesia-portal
- **Purpose**: Proposition-based deliberative democracy
- **Focus**: Motions/propositions (policy development, argumentation)
- **Architecture**: Python/Morepath, score voting
- **License**: AGPLv3
- **Status**: ⚠️ **EVALUATED AND ARCHIVED** (Oct 7, 2025)
- **Location**: `archive/ekklesia-platform-evaluation/`

### Rule: Avoid Confusion
- ❌ **NEVER** confuse this project with the external Ekklesia Platform
- ❌ **NEVER** suggest using Ekklesia Platform features (we evaluated and rejected it)
- ✅ **ALWAYS** refer to our system as "custom Ekklesia services" or "Samstaða Ekklesia"
- ✅ **ALWAYS** check `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` for current architecture
- ✅ When discussing external Ekklesia, explicitly say "external Ekklesia Platform"

**Reason for Rejection**: External Ekklesia is designed for propositions/motions (policy development), not elections (candidate selection). This is a fundamental use case mismatch.

**See**: `archive/ekklesia-platform-evaluation/README.md` for evaluation details.

---

## Account Information

### Google/Firebase Accounts
- **firebase-manual-oauth-pkce** (reference repository): `gudrodur@gmail.com`
- **ekklesia** (production project): `gudrodur@sosialistaflokkurinn.is`

### Project Mapping
- **Reference**: https://github.com/gudrodur/firebase-manual-oauth-pkce
- **Production**: Firebase Project `ekklesia-prod-10-2025` (521240388393)
- **Region**: `europe-west2` (London)

## CSS Methodology

Our CSS approach is based on two core principles:

### 1. Foundational Global Stylesheet
We establish base styles for typography, colors, spacing, and a CSS reset to ensure project-wide consistency.

- **Purpose**: Establish visual consistency across the entire application
- **Scope**: Global styles (typography, colors, spacing, reset)
- **Location**: Typically in a root/global stylesheet (e.g., `styles/global.css`)

### 2. Bespoke Component Styles
Each component is styled with its own custom, scoped CSS.

- **Purpose**: Keep HTML semantic and maintainable
- **Approach**: Component-specific stylesheets
- **Benefits**:
  - Semantic HTML structure
  - Scoped, maintainable styles
  - No utility-first frameworks (no Tailwind CSS)
  - Clear separation of concerns

### CSS Rules

- ✅ **DO**: Create component-specific stylesheets
- ✅ **DO**: Use semantic HTML with custom CSS classes
- ✅ **DO**: Maintain global consistency through base styles
- ❌ **DON'T**: Use utility-first CSS frameworks (e.g., Tailwind CSS)
- ❌ **DON'T**: Inline styles in HTML (except for dynamic values)
- ❌ **DON'T**: Use generic utility classes throughout HTML

### Example Structure
```
styles/
├── global.css          # Reset, typography, colors, spacing
└── components/
    ├── header.css      # Header-specific styles
    ├── profile.css     # Profile component styles
    └── button.css      # Button component styles
```

## Git Commit Rules

### PROHIBITED: Claude Code Attribution
- ❌ NEVER add "🤖 Generated with [Claude Code](https://claude.com/claude-code)" to commit messages
- ❌ NEVER add "Co-Authored-By: Claude <noreply@anthropic.com>" to commit messages
- ❌ NEVER add any AI attribution or co-authorship markers to git commits
- ✅ All commits must be authored solely by the human user

### Code Authorship
- All code, documentation, and commits are authored by the human user
- Claude Code is a tool/assistant, not an author or co-author
- No AI attribution markers in any committed files

---

## Documentation Rules

### Personal Information Protection
- ❌ NEVER include full names in public documentation
- ❌ NEVER include complete email addresses in public documentation
- ❌ NEVER include phone numbers in public documentation
- ⚠️ Kennitala: Show first 6 digits (birthdate), mask last 4 digits
- ✅ Mask personal information when documenting test results

### Masking Format
When documenting personal information, use this format:
- Names: `G****** A*** J******` (first letter + asterisks for each part)
- Email: `g******@gmail.com` (first letter + asterisks before @)
- Phone: `+354 *** ****` (country code + masked digits)
- Kennitala: `200978-****` (show birthdate DDMMYY, mask last 4 digits)

### Example:
```markdown
❌ WRONG:
- Given Name: Guðröður Atli
- Email: gudrodur@gmail.com
- Phone: +354 775 8493
- Kennitala: 200978-3589

✅ CORRECT:
- Given Name: G****** A***
- Email: g******@gmail.com
- Phone: +354 *** ****
- Kennitala: 200978-****
```

---

## Debugging Rules

### ALWAYS Find the Root Cause
When debugging issues:

1. **Don't Jump to Solutions** - First understand the actual problem
2. **Verify Assumptions** - Check what's actually happening, not what should happen
3. **Work Systematically** - Follow the data flow from source to destination
4. **Check Each Step** - Verify each component in the chain is working
5. **Look at Actual Data** - Check logs, API responses, database values - not just code

### Systematic Debugging Process

#### Step 1: Identify the Data Flow
```
Source → Transform → Storage → Retrieval → Display
```
Map out where data comes from and where it should end up.

#### Step 2: Check Each Component
For each step in the flow, verify:
- ✅ Input: Is the data arriving?
- ✅ Process: Is it being transformed correctly?
- ✅ Output: Is it being passed to the next step?

#### Step 3: Use Real Data
- Check actual API responses
- Read actual log output
- Query actual database/storage
- Don't assume based on code alone

#### Step 4: Verify at the Boundary
Check data at integration points:
- External API responses
- Database queries
- Network requests
- Token/session contents

### Example: OAuth/OIDC Debugging

When user auth isn't working:

1. **Check source** (IdP):
   - What claims does Kenni.is actually send?
   - Check with API call or logs, not documentation

2. **Check bridge** (OIDC Bridge):
   - Is the claim being passed through?
   - Log the actual token contents

3. **Check middleware** (ZITADEL):
   - Is the action executing?
   - Is metadata being set?
   - Check with API query

4. **Check application** (Members app):
   - What's in the ID token?
   - Log the actual claims received

5. **Check storage** (kennitalas.txt):
   - Is the value in the file?
   - Is it being loaded correctly?

### Red Flags (Stop and Investigate)

- ❌ "Should work" but doesn't → Check actual behavior
- ❌ Multiple failed attempts with same approach → Step back, find root cause
- ❌ Works in docs but not in practice → Verify API version, permissions, config
- ❌ Intermittent failures → Check timing, caching, state management
- ❌ "It worked before" → Check what changed (version, config, data)

### Tools for Root Cause Analysis

1. **Logs**: Always check actual logs first
2. **API Calls**: Query the actual state (GET requests)
3. **Network Inspector**: See actual requests/responses
4. **Database Queries**: Check actual stored values
5. **Debug Logging**: Add logging at each step of the flow

### Testing Environment Constraints

- ❌ **NEVER test OAuth flows locally (localhost)** - OAuth providers (Kenni.is) require production URLs
- ❌ Don't test OAuth flows locally unless redirect URIs are configured
- ❌ Don't assume test data matches production data
- ✅ **ALWAYS test OAuth/authentication in production environment** (Firebase Hosting, Cloud Run)
- ✅ Test in the actual environment where configuration exists
- ✅ Check production/staging logs for real behavior
- ✅ Use Firebase Hosting preview channels for testing before production
