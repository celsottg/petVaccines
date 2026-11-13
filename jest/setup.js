// expo-crypto is a native module and returns undefined under jest; back
// randomUUID with Node's implementation so id generation works in tests.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));
