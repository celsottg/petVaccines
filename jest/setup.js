// expo-crypto is a native module and returns undefined under jest; back
// randomUUID with Node's implementation so id generation works in tests.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

// useLiveQuery depends on expo-sqlite's native change listener, which does not
// exist under jest. Screen tests also mock `@/db/client` with `createLiveTestDb()`.
jest.mock('drizzle-orm/expo-sqlite', () => ({
  ...jest.requireActual('drizzle-orm/expo-sqlite'),
  useLiveQuery: (...args) => require('../src/data/testLive').useLiveQuery(...args),
}));
