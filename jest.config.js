/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'jest-expo',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/jest.setup.js'],
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      transform: { '\\.mjs$': 'babel-jest' },
      moduleNameMapper: {
        '^@office-kit/xlsx/(.*)$': '<rootDir>/node_modules/@office-kit/xlsx/dist/$1.mjs',
      },
      transformIgnorePatterns: [
        '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@office-kit))',
        '/node_modules/react-native-reanimated/plugin/',
        '/node_modules/@react-native/babel-preset/',
      ],
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
