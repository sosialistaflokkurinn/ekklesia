# Ekklesia Quality & Testing Guide

**Last Updated**: 2025-11-04
**Status**: ✅ Active - Quality Assurance and Testing Standards
**Purpose**: Testing philosophy, standards, and quality assurance practices

---

## Overview

This guide defines quality and testing standards for the Ekklesia project. We prioritize:
- Automated testing ([unit](https://en.wikipedia.org/wiki/Unit_testing), [integration](https://en.wikipedia.org/wiki/Integration_testing), [E2E](https://www.browserstack.com/guide/end-to-end-testing))
- [Pre-commit quality checks](https://pre-commit.com/)
- Manual testing checklists
- Code quality tools ([ESLint](https://eslint.org/), [Prettier](https://prettier.io/))
### Pre-commit Hooks

Automatically runs before every commit:
- [ESLint](https://eslint.org/) checks
- [Prettier](https://prettier.io/) formatting
- Kennitala/PII detection (Optimized single-pass scan)
- File size limits

**Setup**:
```bash
# Install pre-commit hooks
npm install
# Hooks are automatically installed via package.json
# Custom optimized hooks are located in git-hooks/
```

### Code Health Scripts

We provide scripts to audit code quality on demand:

- `scripts/check-code-health.py`: Comprehensive health check (PII, patterns, file sizes)
- `scripts/check-code-patterns.sh`: Fast grep-based pattern check

**Usage**:
```bash
# Run full health check
python3 scripts/check-code-health.py

# Run fast pattern check
./scripts/check-code-patterns.sh
```

---

## Testing Philosophy

### Testing Pyramid

```
         /\
        /  \  E2E (Few)
       /____\
      /      \
     / Integration \ (Some)
    /______________\
   /                \
  /   Unit Tests     \ (Many)
 /____________________\
```

**Unit Tests** (70%):
- Test individual functions
- Fast, isolated, deterministic
- Focus on business logic

**Integration Tests** (20%):
- Test component interactions
- Database, API calls
- More realistic scenarios

**E2E Tests** (10%):
- Test full user flows
- Slowest, most brittle
- Critical paths only

---

## Unit Testing

### When to Write Unit Tests

Write unit tests for:
- **Business logic** (validation, calculations, transformations)
- **Utilities** (formatters, parsers, helpers)
- **Complex algorithms** (voting logic, data normalization)
- **Error handling** (edge cases, invalid input)

Don't unit test:
- **Simple getters/setters** (not worth the overhead)
- **Configuration** (static data)
- **UI components** (use integration tests instead)

### Unit Test Structure

Use **[Arrange-Act-Assert](https://automationpanda.com/2020/07/07/arrange-act-assert-a-pattern-for-writing-good-tests/)** pattern:

```javascript
// validators.test.js
import { validateKennitala, isValidEmail } from './validators.js';

describe('validateKennitala', () => {
  test('accepts valid 10-digit kennitala', () => {
    // Arrange
    const validKennitala = '9999999999';

    // Act
    const result = validateKennitala(validKennitala);

    // Assert
    expect(result).toBe(true);
  });

  test('rejects kennitala with invalid length', () => {
    // Arrange
    const shortKennitala = '123';

    // Act
    const result = validateKennitala(shortKennitala);

    // Assert
    expect(result).toBe(false);
  });

  test('rejects null kennitala', () => {
    expect(validateKennitala(null)).toBe(false);
  });

  test('rejects kennitala with non-digit characters', () => {
    expect(validateKennitala('0103-03390')).toBe(false);
  });
});

describe('isValidEmail', () => {
  test.each([
    ['test@example.com', true],
    ['user.name@domain.co.uk', true],
    ['invalid', false],
    ['@example.com', false],
    ['test@', false],
    [null, false],
    ['', false]
  ])('isValidEmail(%s) returns %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});
```

### Test Coverage Goals

| Category | Target Coverage | Why |
|----------|----------------|-----|
| Business Logic | 90%+ | Critical functionality |
| Utilities | 80%+ | High reusability |
| API Endpoints | 70%+ | Important but integration tests also cover |
| UI Components | 50%+ | E2E tests provide additional coverage |
| Overall | 70%+ | Balanced approach |

**Note**: Coverage is a metric, not a goal. Test what matters.

---

## Integration Testing

### When to Write Integration Tests

Write integration tests for:
- **API endpoints** (request → response flow)
- **Database operations** (CRUD operations)
- **Service interactions** (Elections ↔ Events ↔ Members)
- **Authentication flows** (OAuth, token validation)

### Integration Test Example

```javascript
// elections-api.test.js
import { app } from '../src/app.js';
import { db } from '../src/database.js';
import request from 'supertest';

describe('POST /api/elections/:id/vote', () => {
  let election, votingToken;

  beforeEach(async () => {
    // Arrange: Set up test data
    election = await db.elections.create({
      title: 'Test Election',
      status: 'open'
    });

    votingToken = await db.voting_tokens.create({
      election_id: election.id,
      user_id: 'test-user-123',
      token_hash: 'test-token-hash'
    });
  });

  afterEach(async () => {
    // Cleanup: Remove test data
    await db.elections.deleteAll();
    await db.voting_tokens.deleteAll();
  });

  test('successfully submits vote with valid token', async () => {
    // Act: Send vote request
    const response = await request(app)
      .post(`/api/elections/${election.id}/vote`)
      .set('Authorization', `Bearer ${votingToken.token}`)
      .send({ answer: 'yes' });

    // Assert: Check response
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('ballot_id');

    // Assert: Verify database state
    const ballot = await db.ballots.findById(response.body.ballot_id);
    expect(ballot.election_id).toBe(election.id);
    expect(ballot.answer).toBe('yes');

    // Assert: Token marked as used
    const token = await db.voting_tokens.findByHash('test-token-hash');
    expect(token.used).toBe(true);
  });

  test('rejects vote with already-used token', async () => {
    // Arrange: Mark token as used
    await db.voting_tokens.update(votingToken.id, { used: true });

    // Act
    const response = await request(app)
      .post(`/api/elections/${election.id}/vote`)
      .set('Authorization', `Bearer ${votingToken.token}`)
      .send({ answer: 'yes' });

    // Assert
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/already used/i);
  });

  test('rejects vote with invalid token', async () => {
    // Act
    const response = await request(app)
      .post(`/api/elections/${election.id}/vote`)
      .set('Authorization', 'Bearer invalid-token')
      .send({ answer: 'yes' });

    // Assert
    expect(response.status).toBe(401);
  });
});
```

---

## End-to-End (E2E) Testing

### When to Write E2E Tests

Write E2E tests for:
- **Critical user paths** (login → vote → see results)
- **Multi-service flows** (authentication → token → vote)
- **UI interactions** (button clicks, form submission)

Use E2E tests sparingly - they're slow and brittle.

### E2E Test Example (Playwright)

```javascript
// voting-flow.e2e.js
import { test, expect } from '@playwright/test';

test.describe('Complete Voting Flow', () => {
  test('member can login, request token, and vote', async ({ page }) => {
    // 1. Login with Kenni.is
    await page.goto('https://ekklesia-prod-10-2025.web.app');
    await page.click('#btn-login');

    // Wait for Kenni.is redirect
    await page.waitForURL(/kenni.is/);
    // ... (Kenni.is login flow - complex, may use test account)

    // 2. Navigate to elections page
    await expect(page).toHaveURL(/dashboard/);
    await page.click('text=Atkvæðagreiðslur');

    // 3. Select election
    await expect(page).toHaveTitle(/Atkvæðagreiðslur/);
    await page.click('.election-card:first-child');

    // 4. Request voting token
    await page.click('#btn-request-token');
    await expect(page.locator('#token-status')).toContainText('Token received');

    // 5. Submit vote
    await page.click('#btn-vote-yes');
    await expect(page.locator('#vote-status')).toContainText('Vote submitted');

    // 6. Verify cannot vote again
    await expect(page.locator('#btn-vote-yes')).toBeDisabled();
    await expect(page.locator('#vote-status')).toContainText('Already voted');
  });
});
```

---

## Manual Testing Checklist

### Before Creating Pull Request

**Functionality**:
- [ ] Feature works as intended
- [ ] Edge cases handled (empty input, very long input, special chars)
- [ ] Error messages are clear and helpful
- [ ] Success feedback is visible

**Browser Testing**:
- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] Tested in Safari (if available)
- [ ] Tested on mobile (responsive design)

**Accessibility**:
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader tested (or ARIA labels verified)
- [ ] Focus indicators visible
- [ ] Color contrast sufficient

**Performance**:
- [ ] Page loads quickly (<2 seconds)
- [ ] No console errors
- [ ] No memory leaks (check DevTools)

**Code Quality**:
- [ ] No commented-out code
- [ ] No console.log statements
- [ ] ESLint passes (`npm run lint`)
- [ ] Prettier formatted (`npm run format`)

---

## Load Testing

### When to Load Test

Load test before:
- First large meeting (500 attendees)
- Major architecture changes
- New high-load features (voting, authentication)

### Load Test Scenarios

**Scenario 1: Voting Spike** (Critical):
- **Load**: 300 votes in 1 second
- **Expected**: <5% failures, <300ms p95 latency
- **Tool**: k6 or artillery

```javascript
// k6-vote-spike.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1s', target: 300 },  // Ramp to 300 users in 1 second
    { duration: '3s', target: 300 },  // Hold 300 users for 3 seconds
    { duration: '1s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_failed': ['rate<0.05'],  // <5% failures
    'http_req_duration': ['p(95)<300'], // p95 <300ms
  },
};

export default function () {
  const electionId = __ENV.ELECTION_ID;
  const votingToken = __ENV.VOTING_TOKEN;  // Each VU has unique token

  const response = http.post(
    `https://elections-service.run.app/api/elections/${electionId}/vote`,
    JSON.stringify({ answer: 'yes' }),
    {
      headers: {
        'Authorization': `Bearer ${votingToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has ballot_id': (r) => r.json('ballot_id') !== undefined,
  });
}
```

**Run load test**:
```bash
k6 run --vus 300 --duration 5s k6-vote-spike.js
```

**Scenario 2: Token Requests**:
- **Load**: 400 token requests over 30 seconds
- **Expected**: <1% failures, <500ms p95 latency

**Scenario 3: Authentication**:
- **Load**: 300 logins over 15 minutes
- **Expected**: <1% failures, <5s p95 latency (depends on Kenni.is)

---

## Code Quality Tools

### ESLint (JavaScript Linter)

**Configuration**: `.eslintrc.json` (see separate task)

**Run ESLint**:
```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

**Common Rules**:
- No unused variables
- No console.log in production
- Prefer const over let
- Require JSDoc for functions
- Consistent spacing and formatting

---

### Prettier (Code Formatter)

**Configuration**: `.prettierrc.json` (see separate task)

**Run Prettier**:
```bash
# Format all files
npm run format

# Check formatting (don't modify)
npm run format:check
```

**Formatting Rules**:
- 2-space indentation
- Single quotes for strings
- Semicolons required
- 100 character line width
- Trailing commas in multi-line

---

## Pre-Commit Hooks

### Setup Pre-Commit Hooks

**Install Husky**:
```bash
npm install --save-dev husky
npx husky install
npm pkg set scripts.prepare="husky install"
```

**Add Pre-Commit Hook**:
```bash
npx husky add .husky/pre-commit "npm run lint && npm run format:check"
```

**Hook File** (`.husky/pre-commit`):
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit checks..."

# Run ESLint
echo "→ Checking code quality (ESLint)..."
npm run lint || {
  echo "❌ ESLint failed. Fix issues and try again."
  exit 1
}

# Check Prettier formatting
echo "→ Checking code formatting (Prettier)..."
npm run format:check || {
  echo "❌ Code not formatted. Run 'npm run format' and try again."
  exit 1
}

# Check for sensitive data (kennitalas, etc.)
echo "→ Checking for sensitive data..."
if git diff --cached --name-only | xargs grep -E '\b[0-9]{6}-?[0-9]{4}\b' 2>/dev/null; then
  echo "❌ Kennitala detected in staged files. Remove and try again."
  exit 1
fi

echo "✅ All pre-commit checks passed!"
```

### What Pre-Commit Checks

- ✅ ESLint passes
- ✅ Prettier formatting correct
- ✅ No kennitalas in code
- ✅ No API tokens or secrets
- ✅ File size limits (<1MB)

---

## CI/CD Quality Gates

### GitHub Actions Workflow

**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Check Prettier formatting
        run: npm run format:check

      - name: Run unit tests
        run: npm run test

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Build
        run: npm run build

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Quality Gates (Must Pass Before Merge)

- [ ] All tests passing (unit + integration)
- [ ] ESLint passing (no errors)
- [ ] Prettier formatted
- [ ] Code coverage >70%
- [ ] Build succeeds
- [ ] Code review approved

---

## Testing Best Practices

### ✅ Do

- Write tests as you code (not after)
- Test edge cases (null, empty, very long input)
- Use descriptive test names ("accepts valid email")
- Keep tests fast (<5 seconds for full suite)
- Mock external dependencies (APIs, databases)
- Test error handling (not just happy path)
- Use test.each for similar test cases
- Run tests before committing
- Update tests when code changes

### ❌ Don't

- Skip writing tests (technical debt)
- Test implementation details (test behavior, not internals)
- Write flaky tests (random failures)
- Ignore failing tests (fix or remove)
- Leave console.log in tests
- Test framework code (trust libraries)
- Write tests for the sake of coverage
- Copy-paste test code (extract helpers)

---

## Test Organization

### File Structure

```
src/
├── validators.js
└── validators.test.js       # Co-located with source

services/
└── elections/
    ├── src/
    │   ├── api/
    │   │   ├── elections.js
    │   │   └── elections.test.js
    │   └── db/
    │       ├── database.js
    │       └── database.test.js
    ├── tests/
    │   ├── integration/
    │   │   └── elections-api.test.js
    │   └── e2e/
    │       └── voting-flow.e2e.js
    └── package.json
```

**Naming Conventions**:
- Unit tests: `{file}.test.js` (co-located with source)
- Integration tests: `tests/integration/{feature}.test.js`
- E2E tests: `tests/e2e/{flow}.e2e.js`

---

## Testing Checklist

Before marking a feature as "done":

**Code Quality**:
- [ ] ESLint passes
- [ ] Prettier formatted
- [ ] JSDoc added for all functions
- [ ] No console.log statements

**Testing**:
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing (if applicable)
- [ ] Manual testing completed
- [ ] Edge cases tested
- [ ] Error cases tested

**Documentation**:
- [ ] README updated (if needed)
- [ ] API docs updated (if endpoints changed)
- [ ] Comments explain complex logic

**Accessibility**:
- [ ] Keyboard navigation tested
- [ ] ARIA labels verified
- [ ] Screen reader tested (or labels checked)

**Performance**:
- [ ] No performance regressions
- [ ] Load test passed (for high-load features)
- [ ] No memory leaks

---

## Related Documentation

- **JavaScript Guide**: [/docs/standards/JAVASCRIPT_GUIDE.md](/docs/standards/JAVASCRIPT_GUIDE.md) - Testing patterns
- **Git Workflow Guide**: [/docs/standards/GIT_WORKFLOW_GUIDE.md](/docs/standards/GIT_WORKFLOW_GUIDE.md) - Pre-commit hooks
- **Master Code Standards**: [/docs/CODE_STANDARDS_MAP.md](/docs/CODE_STANDARDS_MAP.md)

**External Resources**:
- **Jest Documentation**: https://jestjs.io/
- **Playwright E2E Testing**: https://playwright.dev/
- **k6 Load Testing**: https://k6.io/docs/
- **ESLint Rules**: https://eslint.org/docs/rules/

---

**Last Updated**: 2025-11-04
**Maintained By**: All developers
**Status**: ✅ Active - Required for all code changes
