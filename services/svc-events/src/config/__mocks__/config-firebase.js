/**
 * Mock Firebase configuration for tests
 */

const mockAuth = {
  verifyIdToken: jest.fn().mockResolvedValue({
    uid: 'test-uid',
    email: 'test@example.com'
  })
};

const mockFirestore = {
  collection: jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn()
    })
  })
};

const mockAdmin = {
  auth: () => mockAuth,
  firestore: () => mockFirestore
};

module.exports = {
  admin: mockAdmin,
  auth: mockAuth,
  firestore: mockFirestore
};
