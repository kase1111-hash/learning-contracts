module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
      // Current coverage: statements 70.25%, branches 48.69%, lines 71.65%, functions 68.57%
      // Setting thresholds slightly below to prevent regression while tracking improvement
      branches: 45,
      functions: 65,
      lines: 68,
      statements: 68,
    },
  },
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
};
