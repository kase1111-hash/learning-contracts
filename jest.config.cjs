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
      // Actual coverage (2026-02-08): statements 61.03%, branches 48.69%, lines 61.83%, functions 57.97%
      // Thresholds set 2% below actual to prevent regression
      branches: 45,
      functions: 55,
      lines: 59,
      statements: 59,
    },
  },
  transformIgnorePatterns: ['/node_modules/(?!uuid)'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
};
