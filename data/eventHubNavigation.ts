export type EventHubHomeLink = Readonly<{
  href: string;
  label: string;
}>;

export const DEFAULT_EVENT_HUB_HOME_LINK: EventHubHomeLink = {
  href: '/',
  label: 'Celebration Atlas home',
};

export function resolveEventHubHomeLink(
  homeLink?: EventHubHomeLink,
): EventHubHomeLink {
  return homeLink ?? DEFAULT_EVENT_HUB_HOME_LINK;
}
