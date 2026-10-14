import { create } from 'zustand';
import type { CreateBookingParams } from '@event/core';

interface Draft {
  sessionId: string;
  eventId: string;
  selected: string[];
  conflicts: string[];
  zoneId: string;
  ticketTypeId: string;
  quantity: number;
  intent: CreateBookingParams | null;
  unresolved: boolean;
  chooseSession: (id: string, eventId?: string) => void;
  toggleSeat: (id: string) => void;
  setStanding: (values: { zoneId?: string; ticketTypeId?: string; quantity?: number }) => void;
  setIntent: (intent: CreateBookingParams) => void;
  setUnresolved: (value: boolean) => void;
  conflict: (ids: string[]) => void;
  clear: () => void;
}
const initial = {
  sessionId: '',
  eventId: '',
  selected: [],
  conflicts: [],
  zoneId: '',
  ticketTypeId: '',
  quantity: 1,
  intent: null,
  unresolved: false,
};
export const useBookingDraft = create<Draft>((set) => ({
  ...initial,
  chooseSession: (id, eventId) =>
    set((s) =>
      s.sessionId === id
        ? { ...s, eventId: eventId ?? s.eventId }
        : s.unresolved
          ? s
          : { ...initial, sessionId: id, eventId: eventId ?? '' },
    ),
  toggleSeat: (id) =>
    set((s) =>
      s.unresolved
        ? s
        : {
            selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
            conflicts: s.conflicts.filter((x) => x !== id),
            intent: null,
          },
    ),
  setStanding: (values) => set((s) => (s.unresolved ? s : { ...values, intent: null })),
  setIntent: (intent) => set({ intent }),
  setUnresolved: (unresolved) => set({ unresolved }),
  conflict: (ids) =>
    set((s) => ({
      selected: s.selected.filter((id) => !ids.includes(id)),
      conflicts: ids,
      intent: null,
      unresolved: false,
    })),
  clear: () => set(initial),
}));
