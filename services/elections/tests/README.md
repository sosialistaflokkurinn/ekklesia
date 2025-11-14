# Elections Service Tests

Comprehensive test suite for the Elections Service API endpoints.

**Last Updated**: 2025-11-13 (Issue #268 - In Progress)

---

## Overview

Test framework setup for elections service using Jest and Supertest.

**Current Status**:
- ✅ Jest and Supertest installed
- ✅ Test configuration created (jest.config.js)
- ✅ Test helpers and mocks created
- ✅ 47 comprehensive test cases written for vote submission endpoint
- ⏳ Authentication mocking needs refinement (4/47 tests passing)

---

## Test Files

### Test Suites

**`tests/vote-submission.test.js`** (1,369 lines, 47 tests)
- POST /api/elections/:id/vote endpoint
- Categories:
  1. Happy Path (4 tests) - Single/multi-choice votes
  2. Authentication (4 tests) - Token validation ✅ **ALL PASSING**
  3. Validation (8 tests) - Input validation
  4. Voting Window (5 tests) - Status and time checks
  5. Eligibility (4 tests) - Permission checks
  6. Duplicate Vote (2 tests) - Already voted detection
  7. Transaction (8 tests) - DB transaction integrity
  8. Edge Cases (9 tests) - Error handling
  9. Integration (3 tests) - Multi-step flows

### Test Helpers

**`tests/helpers/db-mock.js`**
- `createMockClient()` - Mock database client with transaction support
- `createMockPool()` - Mock connection pool
- Transaction state tracking (BEGIN, COMMIT, ROLLBACK)
- Query history for assertions

**`tests/fixtures/elections.js`**
- Sample election data (single-choice, multi-choice, draft, closed, etc.)
- Sample users (member, admin)
- Sample ballots
- Test tokens

**`tests/setup.js`**
- Global test configuration
- Firebase Admin SDK mock
- Winston logger mock
- Google Cloud Logging mock
- Environment variables
- `global.mockAuth` - Shared Firebase auth mock

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- vote-submission.test.js

# Run with coverage
npm test:coverage

# Watch mode
npm test:watch
```

---

## Test Configuration

**jest.config.js**:
- Test environment: Node.js
- Test match: `tests/**/*.test.js`
- Coverage threshold: 70-80%
- Setup file: `tests/setup.js`
- Timeout: 10 seconds

---

## Current Issues

### Authentication Mocking (To Fix)

**Problem**: Only 4/47 tests passing - authentication tests that expect 401 Unauthorized.

**Root Cause**: The `verifyMemberToken` middleware calls `admin.auth().verifyIdToken()`, but the mock isn't properly intercepting this call.

**Current Setup**:
```javascript
// setup.js
global.mockAuth = {
  verifyIdToken: jest.fn(),
};

jest.mock('firebase-admin', () => ({
  auth: jest.fn(() => global.mockAuth),
  // ...
}));
```

**Test Setup**:
```javascript
// In each test that needs authentication
mockAuth.verifyIdToken.mockResolvedValue({
  uid: memberUser.uid,
  email: memberUser.email,
  roles: memberUser.roles,
});
```

**Issue**: The middleware is loaded before tests run, so the mock doesn't intercept the auth() call.

**Possible Solutions**:

1. **Mock the memberAuth middleware directly** (recommended):
   ```javascript
   jest.mock('../src/middleware/memberAuth', () => ({
     verifyMemberToken: (req, res, next) => {
       req.user = { uid: 'test-uid', email: 'test@example.com', roles: ['member'] };
       next();
     },
     // ... other exports
   }));
   ```

2. **Use Jest's `doMock()` for dynamic mocking**:
   ```javascript
   beforeEach(() => {
     jest.resetModules();
     jest.doMock('firebase-admin', () => ({
       auth: () => mockAuth,
     }));
   });
   ```

3. **Create a test-specific Express app that doesn't use middleware**:
   - Test the route handler logic directly
   - Mock request/response objects

---

## Next Steps

### To Complete Issue #268

1. **Fix authentication mocking** (1-2 hours)
   - Implement one of the solutions above
   - Verify all 47 tests pass
   - Adjust mock data as needed

2. **Verify transaction behavior** (30 min)
   - Ensure BEGIN/COMMIT/ROLLBACK are called correctly
   - Test error rollback scenarios

3. **Run coverage report** (15 min)
   ```bash
   npm test:coverage -- vote-submission.test.js
   ```
   - Target: >90% coverage of vote submission endpoint

4. **Document learnings** (15 min)
   - Update this README with solutions
   - Add troubleshooting section

5. **Close Issue #268** ✅

### For Issue #270 - Results Tests

After completing vote submission tests, create similar test suite for:
- GET /api/policy-sessions/:id/results
- Results calculation logic
- Vote counting accuracy
- Edge cases (zero votes, ties, etc.)

Estimated effort: 4-6 hours

---

## Test Data

### Sample Elections

```javascript
// Single-choice election
{
  id: 'election-1',
  voting_type: 'single-choice',
  max_selections: 1,
  answers: [
    { id: 'answer-yes', text: 'Yes' },
    { id: 'answer-no', text: 'No' }
  ]
}

// Multi-choice election
{
  id: 'election-2',
  voting_type: 'multi-choice',
  max_selections: 3,
  answers: [
    { id: 'answer-1', text: 'Healthcare' },
    { id: 'answer-2', text: 'Education' },
    // ... 5 answers total
  ]
}
```

### Sample Users

```javascript
const memberUser = {
  uid: 'user-123',
  email: 'member@example.com',
  roles: ['member'],
  isMember: true,
  isAdmin: false,
};

const adminUser = {
  uid: 'admin-456',
  email: 'admin@example.com',
  roles: ['admin'],
  isMember: true,
  isAdmin: true,
};
```

---

## Troubleshooting

### "Cannot find module" errors

- Run `npm install` to ensure all dependencies are installed
- Check that `jest.config.js` module paths are correct

### "verifyIdToken is not a function"

- Ensure `global.mockAuth` is properly set up in `tests/setup.js`
- Check that the mock is created BEFORE any modules that use Firebase are loaded

### Tests timeout

- Increase timeout in `jest.config.js` (current: 10000ms)
- Check for unresolved promises in async code
- Ensure mock functions resolve/reject properly

### Database connection errors

- Tests should NOT connect to real database
- Verify `jest.mock('../src/config/database')` is set up
- Check that `createMockPool()` is used

---

## Code Coverage Goals

**Target Coverage**:
- Branches: 70%
- Functions: 75%
- Lines: 80%
- Statements: 80%

**Current Coverage**: Run `npm test:coverage` to see current metrics.

---

## Related

- **Issue #268**: Vote submission tests (in progress)
- **Issue #270**: Results tests (pending)
- **PR #250**: Where manual testing was done
- **Epic #186**: Member Voting Experience

---

## Contributing

When adding new tests:

1. Follow existing test structure (describe blocks by category)
2. Use descriptive test names
3. Set up mocks in beforeEach
4. Clean up mocks in afterEach/beforeEach
5. Test both happy paths and error cases
6. Aim for >85% code coverage of tested endpoints

---

**Last Updated**: 2025-11-13
**Status**: In Progress - Authentication mocking needs refinement
**Test Count**: 47 tests written, 4 passing
