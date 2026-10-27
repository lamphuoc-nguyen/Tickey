import type { Event, Session } from '@event/core';

export function homeSections(events: readonly Event[], featured: readonly Event[]) {
  const unique = (items: readonly Event[]) => [...new Map(items.map((event) => [event.id, event])).values()];
  const banners = unique(featured).slice(0, 5);
  const bannerIds = new Set(banners.map((event) => event.id));
  return { banners, discovery: unique(events).filter((event) => !bannerIds.has(event.id)) };
}

/** A known upcoming date is not evidence that tickets are available. */
export function nextEventDate(event: Event, now: number): string | undefined {
  return event.sessions
    ?.filter(
      (session) =>
        !['CANCELLED', 'POSTPONED', 'ENDED'].includes(session.status) && Date.parse(session.startsAt) >= now,
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]?.startsAt;
}

export function sessionChoices(sessions: readonly Session[]) {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return {
    available: sorted.filter((session) => session.status === 'ON_SALE' && !session.salesPaused),
    other: sorted.filter((session) => session.status !== 'ON_SALE' || session.salesPaused),
  };
}
