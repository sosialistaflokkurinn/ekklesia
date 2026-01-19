/**
 * RBAC Middleware Tests
 *
 * Tests for Role-Based Access Control middleware.
 *
 * Covers:
 * - Firebase token verification
 * - Role mapping (superuser → superadmin, admin → election-manager)
 * - Permission checks (requireElectionManager, requireSuperadmin)
 * - Error handling and edge cases
 *
 * Note: Database verification tests require complex Firestore mocking.
 * Integration tests with Firestore emulator provide fuller coverage.
 */

// Mock winston first (before any imports)
jest.mock('winston', () => {
  const mockFormat = jest.fn(() => jest.fn(() => ({})));
  mockFormat.combine = jest.fn(() => ({}));
  mockFormat.timestamp = jest.fn(() => ({}));
  mockFormat.errors = jest.fn(() => ({}));
  mockFormat.json = jest.fn(() => ({}));
  mockFormat.colorize = jest.fn(() => ({}));
  mockFormat.simple = jest.fn(() => ({}));
  mockFormat.printf = jest.fn(() => ({}));
  mockFormat.metadata = jest.fn(() => ({}));

  return {
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
    format: mockFormat,
    transports: { Console: jest.fn() },
  };
});

jest.mock('@google-cloud/logging-winston', () => ({
  LoggingWinston: jest.fn(() => ({ log: jest.fn() })),
}));

// Create mock functions that we can control
const mockVerifyIdToken = jest.fn();
const mockFirestoreDocGet = jest.fn();

// Mock the local firebase module
jest.mock('../src/firebase', () => ({
  auth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
  firestore: () => ({
    collection: () => ({
      doc: () => ({
        get: mockFirestoreDocGet,
      }),
    }),
  }),
}));

// Import after mocks
const {
  verifyFirebaseToken,
  requireElectionManager,
  requireSuperadmin,
  hasRole,
  hasAnyRole,
} = require('../src/middleware/middleware-rbac-auth');

// Helper to create mock req/res/next
const createMockReqRes = (headers = {}, user = null) => {
  const req = {
    header: jest.fn((name) => headers[name]),
    headers,
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    user,
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const next = jest.fn();

  return { req, res, next };
};

describe('RBAC Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyFirebaseToken', () => {
    test('should reject request without Authorization header', async () => {
      const { req, res, next } = createMockReqRes({});

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          code: 'MISSING_AUTH_TOKEN',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with invalid Authorization format', async () => {
      const { req, res, next } = createMockReqRes({
        Authorization: 'InvalidFormat token123',
      });

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          code: 'MISSING_AUTH_TOKEN',
        })
      );
    });

    test('should reject invalid Firebase token', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const { req, res, next } = createMockReqRes({
        Authorization: 'Bearer invalid-token',
      });

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Authentication failed',
        })
      );
    });

    test('should accept valid token and attach user to request (non-elevated role)', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-123',
        email: 'test@example.com',
        role: 'member', // Non-elevated role, no DB verification needed
      });

      const { req, res, next } = createMockReqRes({
        Authorization: 'Bearer valid-token',
      });

      await verifyFirebaseToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.uid).toBe('user-123');
      expect(req.user.email).toBe('test@example.com');
      expect(req.user.role).toBe('member');
    });

    test('should accept valid token with null role', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-123',
        email: 'test@example.com',
        role: null,
      });

      const { req, res, next } = createMockReqRes({
        Authorization: 'Bearer valid-token',
      });

      await verifyFirebaseToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.role).toBeNull();
    });

    describe('Role Mapping with Database Verification', () => {
      test('should map superuser to superadmin and verify against database', async () => {
        mockVerifyIdToken.mockResolvedValue({
          uid: 'superuser-123',
          email: 'super@example.com',
          role: 'superuser',
        });

        mockFirestoreDocGet.mockResolvedValue({
          exists: true,
          data: () => ({ roles: ['superuser'] }),
        });

        const { req, res, next } = createMockReqRes({
          Authorization: 'Bearer valid-token',
        });

        await verifyFirebaseToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.role).toBe('superadmin');
      });

      test('should map admin to election-manager and verify against database', async () => {
        mockVerifyIdToken.mockResolvedValue({
          uid: 'admin-123',
          email: 'admin@example.com',
          role: 'admin',
        });

        mockFirestoreDocGet.mockResolvedValue({
          exists: true,
          data: () => ({ roles: ['admin'] }),
        });

        const { req, res, next } = createMockReqRes({
          Authorization: 'Bearer valid-token',
        });

        await verifyFirebaseToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.role).toBe('election-manager');
      });

      test('should reject if Firestore document does not exist', async () => {
        mockVerifyIdToken.mockResolvedValue({
          uid: 'admin-123',
          email: 'admin@example.com',
          role: 'admin',
        });

        mockFirestoreDocGet.mockResolvedValue({
          exists: false,
        });

        const { req, res, next } = createMockReqRes({
          Authorization: 'Bearer valid-token',
        });

        await verifyFirebaseToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Forbidden',
            code: 'ROLE_VERIFICATION_FAILED',
          })
        );
        expect(next).not.toHaveBeenCalled();
      });

      test('should reject if role claim does not match database', async () => {
        mockVerifyIdToken.mockResolvedValue({
          uid: 'user-123',
          email: 'user@example.com',
          role: 'superuser', // Claims superuser
        });

        mockFirestoreDocGet.mockResolvedValue({
          exists: true,
          data: () => ({ roles: ['member'] }), // But only member in DB
        });

        const { req, res, next } = createMockReqRes({
          Authorization: 'Bearer valid-token',
        });

        await verifyFirebaseToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });

      test('should reject if database verification fails', async () => {
        mockVerifyIdToken.mockResolvedValue({
          uid: 'admin-123',
          email: 'admin@example.com',
          role: 'admin',
        });

        mockFirestoreDocGet.mockRejectedValue(new Error('Database error'));

        const { req, res, next } = createMockReqRes({
          Authorization: 'Bearer valid-token',
        });

        await verifyFirebaseToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('requireElectionManager', () => {
    test('should allow election-manager role', () => {
      const { req, res, next } = createMockReqRes({}, {
        uid: 'user-123',
        role: 'election-manager',
      });

      requireElectionManager(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow superadmin role', () => {
      const { req, res, next } = createMockReqRes({}, {
        uid: 'user-123',
        role: 'superadmin',
      });

      requireElectionManager(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject member role', () => {
      const { req, res, next } = createMockReqRes({}, {
        uid: 'user-123',
        role: 'member',
      });

      requireElectionManager(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: 'Access denied',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject null role', () => {
      const { req, res, next } = createMockReqRes({}, {
        uid: 'user-123',
        role: null,
      });

      requireElectionManager(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('should return 500 if req.user is missing', () => {
      const { req, res, next } = createMockReqRes({});

      requireElectionManager(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
          message: 'RBAC middleware misconfigured',
        })
      );
    });
  });

  describe('requireSuperadmin', () => {
    test('should allow superadmin role', () => {
      const { req, res, next } = createMockReqRes({}, {
        uid: 'user-123',
        role: 'superadmin',
      });

      requireSuperadmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject election-manager role', () => {
      const { req, res, next } = createMockReqRes({}, {
        uid: 'user-123',
        role: 'election-manager',
      });

      requireSuperadmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: 'Access denied',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject member role', () => {
      const { req, res, next } = createMockReqRes({}, {
        uid: 'user-123',
        role: 'member',
      });

      requireSuperadmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('should return 500 if req.user is missing', () => {
      const { req, res, next } = createMockReqRes({});

      requireSuperadmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Helper Functions', () => {
    describe('hasRole', () => {
      test('should return true when user has matching role', () => {
        const user = { role: 'superadmin' };
        expect(hasRole(user, 'superadmin')).toBe(true);
      });

      test('should return false when user has different role', () => {
        const user = { role: 'member' };
        expect(hasRole(user, 'superadmin')).toBe(false);
      });

      test('should return falsy when user is null', () => {
        expect(hasRole(null, 'superadmin')).toBeFalsy();
      });

      test('should return falsy when user is undefined', () => {
        expect(hasRole(undefined, 'superadmin')).toBeFalsy();
      });
    });

    describe('hasAnyRole', () => {
      test('should return true when user has one of the roles', () => {
        const user = { role: 'election-manager' };
        expect(hasAnyRole(user, ['election-manager', 'superadmin'])).toBe(true);
      });

      test('should return false when user has none of the roles', () => {
        const user = { role: 'member' };
        expect(hasAnyRole(user, ['election-manager', 'superadmin'])).toBe(false);
      });

      test('should return falsy when user is null', () => {
        expect(hasAnyRole(null, ['election-manager', 'superadmin'])).toBeFalsy();
      });

      test('should return false when roles array is empty', () => {
        const user = { role: 'superadmin' };
        expect(hasAnyRole(user, [])).toBe(false);
      });
    });
  });
});
