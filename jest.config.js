export default {
  testEnvironment: 'jsdom',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],
  collectCoverageFrom: [
    'apps/members-portal/admin-elections/js/**/*.js',
    '!apps/members-portal/admin-elections/js/**/*.test.js',
    '!apps/members-portal/admin-elections/js/__tests__/**',
    '!apps/members-portal/admin-elections/js/*-i18n.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true
};
