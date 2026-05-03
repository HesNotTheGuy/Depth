import '@testing-library/jest-dom/vitest';

// jsdom does not implement crypto.randomUUID in older Node versions; ensure it exists.
if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.randomUUID !== 'function') {
  const c = (globalThis as { crypto?: Crypto }).crypto ?? ({} as Crypto);
  let counter = 0;
  (c as unknown as { randomUUID: () => `${string}-${string}-${string}-${string}-${string}` }).randomUUID = () =>
    `uuid-${++counter}-${Date.now()}-x-y` as `${string}-${string}-${string}-${string}-${string}`;
  (globalThis as { crypto: Crypto }).crypto = c;
}
