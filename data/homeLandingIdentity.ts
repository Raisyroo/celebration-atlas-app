export const HOME_LANDING_IDENTITY_SESSION_KEY =
  'celebration-atlas:landing-identity-dismissed:v1';

const DISMISSED_SESSION_VALUE = 'dismissed';

export type HomeLandingIdentityState =
  | 'unresolved'
  | 'welcome'
  | 'dismissed';

export type HomeLandingIdentitySessionStore = Pick<
  Storage,
  'getItem' | 'setItem'
>;

export function getHomeLandingIdentitySessionStore(): HomeLandingIdentitySessionStore | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readHomeLandingIdentityDismissed(
  store: HomeLandingIdentitySessionStore | null | undefined,
): boolean {
  if (!store) return false;

  try {
    return store.getItem(HOME_LANDING_IDENTITY_SESSION_KEY) === DISMISSED_SESSION_VALUE;
  } catch {
    return false;
  }
}

export function persistHomeLandingIdentityDismissed(
  store: HomeLandingIdentitySessionStore | null | undefined,
): void {
  if (!store) return;

  try {
    store.setItem(HOME_LANDING_IDENTITY_SESSION_KEY, DISMISSED_SESSION_VALUE);
  } catch {
    // The in-memory latch still works when storage is unavailable.
  }
}

export function resolveHomeLandingIdentityState({
  currentState,
  wasDismissedInSession,
  hasDurableDiscoveryState,
}: {
  currentState: HomeLandingIdentityState;
  wasDismissedInSession: boolean;
  hasDurableDiscoveryState: boolean;
}): Exclude<HomeLandingIdentityState, 'unresolved'> {
  if (
    currentState === 'dismissed' ||
    wasDismissedInSession ||
    hasDurableDiscoveryState
  ) {
    return 'dismissed';
  }

  return 'welcome';
}
