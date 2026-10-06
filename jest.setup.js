/* global jest */
// Shared by both jest projects. Native modules are replaced by in-memory or no-op versions.

// MMKV loads its Nitro native module at import time; use the package's own in-memory mock instead.
jest.mock('react-native-mmkv', () => {
  const { createMockMMKV } = jest.requireActual('react-native-mmkv/lib/createMMKV/createMockMMKV');
  return { createMMKV: (config) => createMockMMKV(config) };
});

// Reanimated 4's worklets runtime is native-only; its package ships a jest mock.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// expo-crypto is native; node's randomUUID has the same contract.
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
