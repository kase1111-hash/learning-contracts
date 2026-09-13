module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^learning-contracts$': '<rootDir>/../../src',
  },
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
};
