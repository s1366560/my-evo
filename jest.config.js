/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  // Limit workers to reduce memory pressure and prevent SIGKILL
  maxWorkers: 2,
  // Per-worker memory limit in MB
  workerIdleMemoryLimit: '512MB',

  collectCoverageFrom: [
    'src/**/service.ts',
    'src/**/routes.ts',
    'src/shared/**/*.ts',
    '!src/**/*.test.ts',
    '!src/shared/**/*.test.ts',
  ],
  coverageReporters: ['json', 'lcov', 'text'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 63,
      functions: 80,
      lines: 79,
      statements: 78,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  restoreMocks: true,
};
