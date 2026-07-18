import assert from 'node:assert/strict';
import {
  getHomeLandingIdentitySessionStore,
  HOME_LANDING_IDENTITY_SESSION_KEY,
  persistHomeLandingIdentityDismissed,
  readHomeLandingIdentityDismissed,
  resolveHomeLandingIdentityState,
  type HomeLandingIdentitySessionStore,
} from '../data/homeLandingIdentity.ts';

assert.equal(
  getHomeLandingIdentitySessionStore(),
  null,
  'server-side resolution never reads a browser storage API',
);

function createMemoryStore(): HomeLandingIdentitySessionStore {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const emptyStore = createMemoryStore();
assert.equal(readHomeLandingIdentityDismissed(emptyStore), false);
assert.equal(
  resolveHomeLandingIdentityState({
    currentState: 'unresolved',
    wasDismissedInSession: false,
    hasDurableDiscoveryState: false,
  }),
  'welcome',
  'a new session at the bare homepage receives the welcome identity',
);

persistHomeLandingIdentityDismissed(emptyStore);
assert.equal(
  emptyStore.getItem(HOME_LANDING_IDENTITY_SESSION_KEY),
  'dismissed',
  'dismissal writes the versioned session value',
);
assert.equal(
  readHomeLandingIdentityDismissed(emptyStore),
  true,
  'a persisted dismissal is reconstructable in the same session',
);
assert.equal(
  resolveHomeLandingIdentityState({
    currentState: 'unresolved',
    wasDismissedInSession: true,
    hasDurableDiscoveryState: false,
  }),
  'dismissed',
  'a stored dismissal survives a homepage remount',
);
assert.equal(
  resolveHomeLandingIdentityState({
    currentState: 'unresolved',
    wasDismissedInSession: false,
    hasDurableDiscoveryState: true,
  }),
  'dismissed',
  'a durable search URL starts in discovery identity state',
);
assert.equal(
  resolveHomeLandingIdentityState({
    currentState: 'dismissed',
    wasDismissedInSession: false,
    hasDurableDiscoveryState: false,
  }),
  'dismissed',
  'clearing temporary activity cannot restore the welcome identity',
);

const throwingStore: HomeLandingIdentitySessionStore = {
  getItem: () => {
    throw new Error('storage blocked');
  },
  setItem: () => {
    throw new Error('storage blocked');
  },
};
assert.doesNotThrow(() => persistHomeLandingIdentityDismissed(throwingStore));
assert.equal(readHomeLandingIdentityDismissed(throwingStore), false);

console.log('Home landing identity validation passed.');
