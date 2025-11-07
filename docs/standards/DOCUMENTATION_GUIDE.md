# Ekklesia Documentation Guide

**Last Updated**: 2025-11-07
**Status**: ✅ Active - Documentation Standards
**Purpose**: Standards for writing clear, maintainable documentation

---

## 📝 Documentation Language Policy

**CRITICAL RULE: All documentation MUST be written in English.**

This includes:
- ✅ All `.md` files in `/docs/`
- ✅ Code comments (JSDoc, Python docstrings, inline comments)
- ✅ Git commit messages
- ✅ GitHub issues, PRs, and comments
- ✅ API documentation
- ✅ README files at all levels
- ✅ Architecture Decision Records (ADRs)
- ✅ Test descriptions and assertions

**Exception**: User-facing text in i18n files (`strings.xml`) should be in the target language (Icelandic/English/etc.)

**Rationale**:
- Enables international collaboration
- Follows industry best practices
- Makes code accessible to AI assistants and tools
- Ensures consistency across the codebase

**Enforcement**: Code reviews should reject PRs with non-English documentation.

---

## Overview

Good documentation is as important as good code. This guide defines standards for:
- JSDoc comments (inline code documentation)
- README files (directory/project overviews)
- Architecture Decision Records (ADRs - why decisions were made)
- Guide documents (like this one)
- API documentation

### Core Principles

1. **Documentation Lives Close to Code** - Keep docs near what they describe
2. **Why, Not What** - Explain decisions and rationale, not just functionality
3. **Examples Over Abstractions** - Show real code, not just concepts
4. **Keep It Updated** - Update docs when code changes
5. **Write for Future You** - You'll forget why you made this choice

---

## JSDoc Standards

### Required for All Functions

**Every function must have JSDoc**:

```javascript
/**
 * Save phone numbers to Firestore
 *
 * Updates the current user's phone_numbers field in Firestore.
 * Validates that user is authenticated before saving.
 *
 * @param {Array<{country: string, number: string, default: boolean}>} phoneNumbers - Array of phone number objects
 * @returns {Promise<void>}
 * @throws {Error} If user is not authenticated
 *
 * @example
 * await savePhoneNumbers([
 *   { country: 'IS', number: '1234567', default: true },
 *   { country: 'DK', number: '9876543', default: false }
 * ]);
 */
async function savePhoneNumbers(phoneNumbers) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const docRef = doc(db, 'members', user.uid);
  await updateDoc(docRef, {
    phone_numbers: phoneNumbers
  });

  console.log('✅ Phone numbers saved');
}
```

### Required JSDoc Tags

| Tag | Required | Purpose |
|-----|----------|---------|
| Description | ✅ Always | First paragraph - what the function does |
| Context paragraph | ⚠️ For complex functions | Additional context, edge cases, or important notes |
| `@param` | ✅ For all parameters | Parameter type, name, description |
| `@returns` | ✅ For all functions | Return type and what it represents |
| `@throws` | ⚠️ If function throws | Error type and when it's thrown |
| `@example` | ⚠️ If not obvious | Usage example (especially for utilities) |
| `@deprecated` | ⚠️ If deprecated | Mark old functions that shouldn't be used |

### JSDoc Examples

**Simple Function**:
```javascript
/**
 * Get country name from ISO code
 *
 * @param {string} code - ISO 3166-1 alpha-2 code (e.g., "IS")
 * @returns {string} Localized country name (e.g., "Ísland")
 */
function getCountryName(code) {
  return COUNTRIES[code]?.nameIs || code;
}
```

**Complex Function with Edge Cases**:
```javascript
/**
 * Search countries by query (flexible matching)
 *
 * Searches by Icelandic name, English name, or ISO code.
 * Case-insensitive partial matching. Returns top 10 results.
 *
 * @param {string} query - Search string (e.g., "Banda", "United", "US")
 * @param {number} [limit=10] - Maximum results to return
 * @returns {Array<{code: string, nameIs: string, nameEn: string}>} Matching countries
 *
 * @example
 * // Search by Icelandic name
 * searchCountries("Banda")  // => [{ code: "US", nameIs: "Bandaríkin", nameEn: "United States" }]
 *
 * // Search by country code
 * searchCountries("DK")  // => [{ code: "DK", nameIs: "Danmörk", nameEn: "Denmark" }]
 */
function searchCountries(query, limit = 10) {
  const lowerQuery = query.toLowerCase();

  return Object.entries(COUNTRIES)
    .filter(([code, country]) =>
      country.nameIs.toLowerCase().includes(lowerQuery) ||
      country.nameEn.toLowerCase().includes(lowerQuery) ||
      code.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit)
    .map(([code, country]) => ({ code, ...country }));
}
```

**Deprecated Function**:
```javascript
/**
 * Get user data from localStorage (deprecated)
 *
 * @deprecated Since v2.0 - Use Firestore instead. Will be removed in v3.0.
 * @see {@link getUserFromFirestore}
 *
 * @param {string} userId - User ID
 * @returns {Object|null} User object or null if not found
 */
function getUserFromLocalStorage(userId) {
  const data = localStorage.getItem(`user_${userId}`);
  return data ? JSON.parse(data) : null;
}
```

---

## README Files

### When to Create a README

Create a README.md in a directory when:
- Directory contains a standalone component/service
- Directory has complex structure that needs explanation
- Directory has setup/installation requirements
- Directory contains multiple related files

**Example locations**:
- `services/elections/README.md` - Elections service overview
- `apps/members-portal/README.md` - Members portal structure
- `docs/standards/README.md` - Index of all standards (this file's location)

### README Template

```markdown
# [Component/Service Name]

**Purpose**: [One sentence description]
**Status**: [✅ Active | 🚧 In Development | ⚠️ Deprecated]
**Last Updated**: [YYYY-MM-DD]

---

## Overview

[2-3 paragraph overview of what this component does and why it exists]

## Quick Start

[Minimal steps to get started - 5 steps or less]

bash
# Clone
git clone [repo-url]

# Install
npm install

# Run
npm run dev


## Structure

[File/directory structure with explanations]

directory/
├── src/
│   ├── index.js       # Entry point
│   └── utils/         # Utility functions
├── tests/             # Test files
└── README.md          # This file


## Usage

[Common use cases with code examples]

## Configuration

[Required environment variables, config files]

## Development

[How to develop/test locally]

## Deployment

[How to deploy this component]

## Related Documentation

- [Link to design doc]
- [Link to API doc]

---

**Maintained By**: [Team/Person]
**Questions**: File issue with label `component-name`
```

---

## Architecture Decision Records (ADRs)

### When to Write an ADR

Create an ADR when making architectural decisions:
- Choosing a technology/library (React vs Vue, PostgreSQL vs MongoDB)
- Defining a system pattern (REST vs GraphQL, monolith vs microservices)
- Making a trade-off (performance vs maintainability)
- Changing existing architecture (migration paths)

**ADRs document WHY, not WHAT** - The code shows what you built, ADR shows why you built it that way.

### ADR Template

```markdown
# ADR-[NUMBER]: [Short Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Decision Makers**: [Names/Roles]
**Consulted**: [Names/Roles if applicable]

---

## Context

[What is the issue we're facing? What problem are we trying to solve?]

## Decision

[What did we decide to do?]

## Rationale

[Why did we choose this option? What were the alternatives?]

## Consequences

### Positive

- [Benefit 1]
- [Benefit 2]

### Negative

- [Trade-off 1]
- [Trade-off 2]

### Neutral

- [Impact that's neither good nor bad]

## Alternatives Considered

### Alternative 1: [Name]

- **Pros**: [List]
- **Cons**: [List]
- **Why rejected**: [Reason]

### Alternative 2: [Name]

- **Pros**: [List]
- **Cons**: [List]
- **Why rejected**: [Reason]

## Implementation Notes

[Any important details about implementing this decision]

## Related Documents

- [Link to design docs]
- [Link to related ADRs]

---

**Review Date**: [When to revisit this decision]
```

### ADR Example

```markdown
# ADR-003: Use XML for i18n Strings

**Date**: 2025-10-12
**Status**: Accepted
**Decision Makers**: Frontend Team

---

## Context

We need an internationalization (i18n) system for the Ekklesia members portal. The system must:
- Support multiple languages (Icelandic, English, future: Danish, Norwegian)
- Be easy for translators to work with (non-developers)
- Have no build step (runtime loading)
- Work in browser without Node.js

## Decision

Use XML files (Android `strings.xml` pattern) with JavaScript loader.

## Rationale

XML is:
- Familiar to translators (used by Android, iOS)
- Tool-compatible (CAT tools, translation management systems)
- Human-readable (can be edited in any text editor)
- Structured (enforces key-value pairs)

JavaScript loader provides:
- Runtime loading (no build step)
- Browser-compatible (fetch + DOMParser)
- Developer experience (R.string.key_name pattern)

## Consequences

### Positive

- Translators can use existing tools (POEditor, Crowdin, etc.)
- No build step means faster iteration
- Easy to add new languages (just create values-xx/strings.xml)
- Clear separation of code and content

### Negative

- Slightly slower first load (fetch + parse XML)
- XML is verbose compared to JSON
- No type safety (keys are strings, not TypeScript types)

### Neutral

- Non-standard for web (most use JSON), but standard for mobile

## Alternatives Considered

### Alternative 1: JSON files

- **Pros**: Native JavaScript, smaller file size, easier parsing
- **Cons**: No tool support for translators, easy to mess up structure
- **Why rejected**: Translation tools don't support JSON well

### Alternative 2: gettext (.po files)

- **Pros**: Industry standard, great tool support
- **Cons**: Requires build step, complex format, not browser-friendly
- **Why rejected**: Adds build complexity we want to avoid

### Alternative 3: i18next library

- **Pros**: Popular library, lots of features
- **Cons**: 50KB bundle size, overkill for our needs
- **Why rejected**: We only need key-value lookup, don't need all features

## Implementation Notes

- Loader: `apps/members-portal/i18n/strings-loader.js`
- Strings: `apps/members-portal/i18n/values-{locale}/strings.xml`
- Usage: `await R.load('is')` then `R.string.key_name`

## Related Documents

- `/docs/standards/I18N_GUIDE.md` - Full usage guide
- `/apps/members-portal/i18n/README.md` - Technical details

---

**Review Date**: 2026-01-01 (after 6 months of use)
```

---

## Guide Documents (Like This One)

### Structure of Guide Documents

All guide documents should follow this structure:

1. **Header** (metadata)
   - Last Updated date
   - Status (Active/Deprecated)
   - Purpose (one sentence)

2. **Overview** (context)
   - What this guide covers
   - Core principles (3-5 bullet points)

3. **Detailed Sections**
   - Organized by topic
   - Examples for each concept
   - ✅ Do / ❌ Don't comparisons

4. **Best Practices** (summary)
   - Quick reference checklist

5. **Related Documentation** (links)
   - Internal docs
   - External resources

6. **Footer** (maintenance info)
   - Last updated date
   - Maintained by
   - Status

### Writing Style for Guides

**Be Direct**:
```
✅ Good: "Use const by default, let when reassignment needed"
❌ Bad: "It is generally recommended that developers should consider using..."
```

**Use Examples**:
```
✅ Good: Show code example with explanation
❌ Bad: Describe concept abstractly without examples
```

**Use Comparisons**:
```
✅ Good: Show good vs bad side by side
❌ Bad: Only show the right way
```

**Be Specific**:
```
✅ Good: "Run `npm run lint` to check for issues"
❌ Bad: "Check code quality using available tools"
```

---

## API Documentation

### REST API Documentation

For REST APIs, document:

1. **Endpoint** (HTTP method + path)
2. **Purpose** (what it does)
3. **Authentication** (required auth)
4. **Request** (body schema)
5. **Response** (success schema)
6. **Errors** (error codes and meanings)
7. **Example** (curl or JavaScript)

**API Doc Template**:

```markdown
### POST /api/elections/:id/vote

Submit a vote for an election.

**Authentication**: Required (voting token in Authorization header)

**Path Parameters**:
- `id` (string) - Election ID (UUID)

**Request Body**:
json
{
  "answer": "yes" | "no"
}


**Success Response** (200 OK):
json
{
  "success": true,
  "ballot_id": "uuid-here"
}


**Error Responses**:
- `401 Unauthorized` - Invalid or missing voting token
- `403 Forbidden` - Token already used
- `404 Not Found` - Election not found
- `400 Bad Request` - Invalid answer value

**Example**:
javascript
const response = await fetch('/api/elections/abc-123/vote', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${votingToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ answer: 'yes' })
});

const data = await response.json();
console.log('Ballot ID:', data.ballot_id);

```

---

## Comments in Code

### When to Write Comments

**Write comments for**:
- Complex algorithms (explain the approach)
- Non-obvious code (why, not what)
- Workarounds (link to issue explaining why)
- TODOs (what needs to be done)

**Don't write comments for**:
- Self-explanatory code (let code speak for itself)
- Repeating what code says (redundant)
- Old code you commented out (delete it instead)

### Good vs Bad Comments

✅ **Good** (explains WHY):
```javascript
// Use NOWAIT to fail fast instead of queuing
// (voting spike can cause lock contention)
const result = await db.query(
  'SELECT used FROM voting_tokens WHERE token_hash = $1 FOR UPDATE NOWAIT',
  [tokenHash]
);
```

❌ **Bad** (repeats WHAT):
```javascript
// Select used from voting_tokens where token_hash equals tokenHash
const result = await db.query(
  'SELECT used FROM voting_tokens WHERE token_hash = $1 FOR UPDATE NOWAIT',
  [tokenHash]
);
```

✅ **Good** (documents workaround):
```javascript
// WORKAROUND: Cloud Run requires min-instances=1 for cold start
// See issue #42 for details on fixing this properly
const minInstances = process.env.NODE_ENV === 'production' ? 1 : 0;
```

✅ **Good** (TODO with context):
```javascript
// TODO(#87): Add retry logic for 503 errors
// Currently users must manually retry if vote fails
async function submitVote(electionId, answer) {
  // ...
}
```

❌ **Bad** (vague TODO):
```javascript
// TODO: fix this
async function submitVote(electionId, answer) {
  // ...
}
```

---

## Documentation Locations

### Directory Structure

```
docs/
├── CODE_STANDARDS.md              # Master index (this file's parent)
├── standards/                      # All coding standards
│   ├── CSS_BEM_GUIDE.md
│   ├── HTML_GUIDE.md
│   ├── JAVASCRIPT_GUIDE.md
│   ├── I18N_GUIDE.md
│   ├── DATA_QUALITY_UX.md
│   ├── DOCUMENTATION_GUIDE.md     # This file
│   ├── GIT_WORKFLOW_GUIDE.md
│   └── QUALITY_TESTING_GUIDE.md
├── architecture/                   # ADRs and architecture docs
│   ├── decisions/                  # Architecture Decision Records
│   │   ├── ADR-001-use-firebase.md
│   │   ├── ADR-002-use-postgresql.md
│   │   └── ADR-003-use-xml-i18n.md
│   └── diagrams/                   # Architecture diagrams
├── development/                    # Development guides
│   ├── guides/                     # How-to guides
│   └── workflows/                  # Workflow docs
└── api/                            # API documentation
    ├── elections-api.md
    ├── events-api.md
    └── members-api.md
```

---

## Best Practices

### ✅ Do

- Write JSDoc for every function
- Update documentation when code changes
- Include examples in documentation
- Explain WHY, not just WHAT
- Keep documentation close to code
- Use markdown for formatting
- Link to related documentation
- Add "Last Updated" date to docs
- Review documentation in code review

### ❌ Don't

- Write documentation after the fact (do it as you code)
- Repeat code in comments (let code be self-documenting)
- Write vague TODO comments (be specific)
- Create documentation that gets stale (keep it updated)
- Over-document (focus on non-obvious parts)
- Use abbreviations in documentation (write full words)
- Forget to document error cases
- Skip examples for complex functions

---

## Documentation Checklist

Before merging code, verify:

**Code Documentation**:
- [ ] All functions have JSDoc comments
- [ ] Complex algorithms explained with comments
- [ ] TODOs link to GitHub issues
- [ ] No commented-out code (deleted instead)

**External Documentation**:
- [ ] README updated if directory structure changed
- [ ] API docs updated if endpoints changed
- [ ] ADR created for architectural decisions
- [ ] Related guides updated

**Examples**:
- [ ] Usage examples provided for complex functions
- [ ] API examples show real requests/responses
- [ ] Examples are tested and working

**Maintenance**:
- [ ] "Last Updated" date set to today
- [ ] Broken links fixed or removed
- [ ] Deprecated docs marked as such

---

## Related Documentation

- **JavaScript Guide**: [/docs/standards/JAVASCRIPT_GUIDE.md](/docs/standards/JAVASCRIPT_GUIDE.md) - JSDoc syntax
- **Git Workflow Guide**: [/docs/standards/GIT_WORKFLOW_GUIDE.md](/docs/standards/GIT_WORKFLOW_GUIDE.md) - Commit messages
- **Master Code Standards**: [/docs/CODE_STANDARDS.md](/docs/CODE_STANDARDS.md)

**External Resources**:
- **JSDoc Reference**: https://jsdoc.app/
- **Markdown Guide**: https://www.markdownguide.org/
- **ADR Best Practices**: https://github.com/joelparkerhenderson/architecture-decision-record

---

**Last Updated**: 2025-11-04
**Maintained By**: All developers
**Status**: ✅ Active - Required for all documentation
