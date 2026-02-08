module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      // Actual coverage (2026-02-08 Phase 3): statements 74.93%, branches 63.51%, functions 73.56%, lines 75.27%
      // Thresholds set 2% below actual to prevent regression
      branches: 61,
      functions: 71,
      lines: 73,
      statements: 72,
    },
  },
  transformIgnorePatterns: ['/node_modules/(?!uuid)'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
};
