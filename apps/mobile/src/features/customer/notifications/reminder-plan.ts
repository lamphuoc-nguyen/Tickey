import type { NotificationPreferences, Ticket } from '@event/core';
export function reminderPlan(tickets: Ticket[], preferences: NotificationPreferences, now: number) {
  const sessions = new Map(
    tickets
      .filter((t) => t.status === 'ISSUED' && t.session && t.session.status !== 'CANCELLED')
      .map((t) => [t.session!.id, t.session!]),
  );
  return [...sessions.values()].flatMap((session) =>
    [24, 2].flatMap((hours) => {
      const enabled = hours === 24 ? preferences.reminder24h : preferences.reminder2h;
      const at = Date.parse(session.startsAt) - hours * 3600000;
      return preferences.pushEnabled && enabled && at > now
        ? [{ sessionId: session.id, eventTitle: session.event?.title ?? 'Sự kiện Tickey', hours, at }]
        : [];
    }),
  );
}
