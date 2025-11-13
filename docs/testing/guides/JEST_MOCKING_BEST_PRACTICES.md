# Jest Test Mocking Learnings - Elections Service Vote Submission Tests

**Date**: 2025-11-13
**Issue**: #268 - Vote submission tests
**Status**: In Progress - 4/4 happy path tests passing, authentication tests hanging

---

## Key Learnings

### 1. Module Mocking Strategy

**Problem**: Tests need to mock Firebase Admin SDK and database without actually loading them.

**Solution**: Mock entire modules at the top level, implement helper functions inline.

```javascript
jest.mock('../src/middleware/memberAuth', () => {
  // Implement ALL exported functions inline
  // DO NOT use jest.requireActual() - it loads Firebase/database

  function isEligible(election, req) {
    // Full implementation here
  }

  function validateVotingWindow(election) {
    // Full implementation here
  }

  return {
    verifyMemberToken: mockVerifyMemberToken,
    isEligible,
    validateVotingWindow,
    validateAnswers,
    hasVoted: jest.fn(),
    filterElectionsByEligibility: jest.fn(),
  };
});
```

**Why**: `jest.requireActual()` loads the real module, which imports Firebase and database, causing timeouts and circular dependencies.

---

### 2. Database Mocking for Vote Submission

**Challenge**: Vote submission involves multiple database queries in a specific order:
1. BEGIN transaction
2. SELECT election
3. Call check_member_voted_v2 function
4. INSERT ballot(s) - one per answer for multi-choice
5. COMMIT transaction

**Solution**: Create reusable helper function that handles both single and multi-choice votes.

```javascript
function setupSuccessfulVoteScenario(election, ballotIds = 'ballot-123') {
  const ballotIdArray = Array.isArray(ballotIds) ? ballotIds : [ballotIds];
  let ballotIdCounter = 0;

  mockClient.query.mockImplementation(async (sql, params) => {
    if (sql === 'BEGIN') {
      return { rows: [], command: 'BEGIN' };
    }
    if (sql.includes('SELECT') && sql.includes('elections.elections')) {
      return { rows: [election], rowCount: 1 };
    }
    if (sql.includes('check_member_voted_v2')) {
      return { rows: [{ has_voted: false }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO elections.ballots')) {
      const ballotId = ballotIdArray[ballotIdCounter % ballotIdArray.length];
      ballotIdCounter++;
      return { rows: [{ id: ballotId }], rowCount: 1 };
    }
    if (sql === 'COMMIT') {
      return { rows: [], command: 'COMMIT' };
    }
    if (sql === 'ROLLBACK') {
      return { rows: [], command: 'ROLLBACK' };
    }
    return { rows: [], rowCount: 0 };
  });
}
```

**Usage**:
```javascript
// Single-choice vote
setupSuccessfulVoteScenario(singleChoiceElection, 'ballot-123');

// Multi-choice vote (3 answers)
setupSuccessfulVoteScenario(multiChoiceElection, ['ballot-1', 'ballot-2', 'ballot-3']);
```

---

### 3. Authentication Helper Functions

**Pattern**: Create helper functions to set up authenticated or unauthenticated states.

```javascript
function setupAuthenticatedUser(user) {
  mockVerifyMemberToken.mockImplementation((req, res, next) => {
    req.user = {
      uid: user.uid,
      email: user.email,
      roles: user.roles || [],
      isMember: user.isMember !== undefined ? user.isMember : true,
      isAdmin: user.isAdmin || false,
      claims: {
        uid: user.uid,
        email: user.email,
        roles: user.roles || [],
      },
    };
    next();
  });
}

function setupUnauthenticated(errorMessage = 'Invalid or expired token') {
  mockVerifyMemberToken.mockImplementation((req, res, next) => {
    return res.status(401).json({
      error: 'Unauthorized',
      message: errorMessage,
      code: 'INVALID_AUTH_TOKEN',
    });
  });
}
```

---

### 4. Validation Order Matters

**Discovery**: Route validates in this order (src/routes/elections.js:268-287):
1. Eligibility check (403 if fails)
2. Voting window check (403 if fails)
3. Answer validation (400 if fails)

**Implication**: Tests expecting 400 for invalid answers will get 403 if eligibility fails first.

**Example**:
```javascript
// This test will get 403, not 400, if user is not eligible
test('should reject invalid answer IDs (400)', async () => {
  // MUST set up eligible user first!
  setupAuthenticatedUser(memberUser);
  setupSuccessfulVoteScenario(singleChoiceElection);

  const response = await request(app)
    .post('/api/elections/election-1/vote')
    .set('Authorization', `Bearer ${validToken}`)
    .send({ answer_ids: ['invalid-answer'] })
    .expect(400); // Now gets 400, not 403
});
```

---

### 5. Audit Service Fire-and-Forget Pattern

**Discovery**: Audit service uses `pool.query()` without `await`, but expects promise.

**Code** (src/services/auditService.js:31):
```javascript
return pool.query(
  `INSERT INTO audit.member_actions ...`
).then(() => {
  logger.info('Audit log recorded', { member_uid });
}).catch((err) => {
  logger.error('Failed to log audit entry', { error: err.message });
});
```

**Problem**: If `pool.query` returns undefined, it crashes with "Cannot read property 'then' of undefined".

**Test Fix**:
```javascript
// In setup.js or beforeEach:
pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
```

**Production Issue**: Should be investigated - audit logging might be fragile.

---

### 6. Express Rate Limiter Mocking

**Problem**: express-rate-limit throws validation errors in tests about IPv6 addresses.

**Solution**: Mock the entire module to return a no-op middleware.

```javascript
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});
```

---

### 7. Test Structure Pattern

**Pattern**: Use describe blocks to group tests by category, helper functions for setup.

```javascript
describe('POST /api/elections/:id/vote - Vote Submission', () => {
  beforeEach(() => {
    // Reset state for each test
    app = express();
    app.use(express.json());
    app.use('/api', electionsRouter);

    mockClient = createMockClient();
    pool.connect.mockResolvedValue(mockClient);
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

    mockVerifyMemberToken.mockClear();
  });

  afterEach(() => {
    mockClient._reset();
  });

  describe('Happy Path - Successful Vote Submission', () => {
    test('should accept single-choice vote (1 answer)', async () => {
      setupAuthenticatedUser(memberUser);
      setupSuccessfulVoteScenario(singleChoiceElection, 'ballot-123');

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        ballot_ids: ['ballot-123'],
        message: 'Vote recorded successfully',
      });
    });
  });
});
```

---

## Current Issues

### Timeout Issue with Authentication Tests

**Problem**: Tests that verify 401 responses (no auth header, invalid format) are timing out after 10 seconds.

**Tests affected**:
1. "should reject request without Authorization header (401)"
2. "should reject request with invalid Authorization format (401)"

**What we tried**:
1. Default mock returns 401 - doesn't check header
2. Mock checks Authorization header - still times out
3. Using `.mockImplementation()` instead of direct mock - still times out

**Hypothesis**: Something in the request flow is hanging, possibly:
- Database connection not releasing
- Middleware not calling next() or returning response
- Pool.connect() hanging
- Some async operation not resolving

**Next steps**:
1. Add debug logging to mock to see if it's being called
2. Check if pool.connect() is being called for auth failures
3. Verify response is actually being sent
4. Try mocking with synchronous return instead of async

---

## Test Results Summary

**Passing Tests** (4/47):
- ✓ should accept single-choice vote (1 answer)
- ✓ should accept multi-choice vote (2 answers)
- ✓ should accept multi-choice vote (3 answers, max selections)
- ✓ should insert ballots with correct data structure

**Hanging Tests** (2/47):
- ⏱️ should reject request without Authorization header (401)
- ⏱️ should reject request with invalid Authorization format (401)

**Not Yet Run** (41/47):
- Remaining authentication tests (2)
- All validation tests (8)
- All voting window tests (5)
- All eligibility tests (4)
- All duplicate vote tests (2)
- All transaction tests (8)
- All edge case tests (9)
- All integration tests (3)

---

## References

- **Main test file**: `services/elections/tests/vote-submission.test.js` (1,400+ lines)
- **Route implementation**: `services/elections/src/routes/elections.js:268-287`
- **Middleware**: `services/elections/src/middleware/memberAuth.js`
- **Test helpers**: `services/elections/tests/helpers/db-mock.js`
- **Test fixtures**: `services/elections/tests/fixtures/elections.js`
- **Test setup**: `services/elections/tests/setup.js`

---

## Commits Made

1. `c46fd24` - Initial test infrastructure setup
2. `ac9dd53` - Refactor happy path tests to use setupSuccessfulVoteScenario helper

---

**Last Updated**: 2025-11-13 (during active debugging session)
