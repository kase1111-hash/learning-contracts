module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^learning-contracts$': '<rootDir>/../../src',
  },
  transformIgnorePatterns: ['/node_modules/(?!uuid)'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
};
