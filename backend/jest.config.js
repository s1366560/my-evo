/**
 * Jest Configuration
 *
 * testPathIgnorePatterns:
 * - security.integration.test.ts: Skipped — requires a live running backend server
 *   at http://127.0.0.1:3001 with a seeded database. These are live API security
 *   tests (auth, CORS, rate-limiting, SQL injection, XSS) not suitable for unit-test
 *   CI runs. Run manually with `npm run dev` then `npx jest security.integration`.
 *   See: docs/architecture/Database-Schema-Reference.md
 */

/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['security\\.integration\\.test\\.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'Node',
        isolatedModules: true,
      },
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
