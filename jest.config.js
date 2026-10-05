/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'jest-expo',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/jest.setup.js'],
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', '\\.tz\\.test\\.ts$'],
    },
    {
      displayName: 'node-tz',
      preset: 'jest-expo',
      testEnvironment: 'node',
      globalSetup: '<rootDir>/jest.tz.setup.js',
      setupFiles: ['<rootDir>/jest.setup.js'],
      testMatch: ['<rootDir>/src/**/*.tz.test.ts'],
    },
    {
      displayName: 'app',
      preset: 'jest-expo',
      setupFiles: ['<rootDir>/jest.setup.js', '<rootDir>/jest.setup.app.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.after.js'],
      testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/app/**/*.test.tsx'],
    },
  ],
};
