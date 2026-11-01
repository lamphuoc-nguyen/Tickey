export interface WizardTicketItem {
  id?: string;
  tempId: string;
  name: string;
  kind: 'PAID' | 'FREE' | 'COMP';
  price: number;
  quota: number;
  zoneIds: string[];
  refundPolicy: 'ONLY_IF_CANCELLED' | 'REFUNDABLE_BEFORE_DEADLINE' | 'NO_REFUNDS';
}

/**
 * Free tiers that would have no seat to sell: in a seated zone a PAID tier takes the seats and a FREE tier gets none
 * until seats are assigned by hand (save_ticket_type, C-05). A standing zone is sold by quantity, so it is fine.
 */
export function freeTiersWithoutSeats(
  tickets: WizardTicketItem[],
  zones: Array<{ id: string; kind?: string }>,
): WizardTicketItem[] {
  const effectiveZones = (t: WizardTicketItem) =>
    t.zoneIds.length > 0 ? t.zoneIds : zones[0]?.id ? [zones[0].id] : [];
  const paidZones = new Set(tickets.filter((t) => t.kind === 'PAID').flatMap(effectiveZones));
  const seated = new Set(zones.filter((z) => z.kind === 'SEATED').map((z) => z.id));
  return tickets.filter((t) => {
    const ids = effectiveZones(t);
    return t.kind === 'FREE' && ids.length > 0 && ids.every((id) => seated.has(id) && paidZones.has(id));
  });
}

export async function persistWizardTickets(
  tickets: WizardTicketItem[],
  createdSessionId: string,
  zones: Array<{ id: string }>,
  saveFn: (payload: Record<string, unknown> & { id?: string }) => Promise<{ id: string }>,
  onTicketSaved?: (index: number, id: string) => void,
  previousSavedIds: string[] = [],
  onTicketDeactivated?: (id: string) => void,
): Promise<WizardTicketItem[]> {
  const currentIds = new Set(tickets.map((t) => t.id).filter(Boolean));
  const removedIds = previousSavedIds.filter((id) => !currentIds.has(id));

  for (const removedId of removedIds) {
    await saveFn({ id: removedId, status: 'INACTIVE' });
    onTicketDeactivated?.(removedId);
  }

  const updatedTickets = [...tickets];
  for (let i = 0; i < updatedTickets.length; i++) {
    const t = updatedTickets[i];
    const effectiveZones = t.zoneIds.length > 0 ? t.zoneIds : (zones[0]?.id ? [zones[0].id] : []);
    const res = await saveFn({
      id: t.id,
      sessionId: createdSessionId,
      name: t.name.trim(),
      kind: t.kind,
      priceAmount: t.kind === 'PAID' ? t.price : 0,
      quota: t.quota,
      zoneIds: effectiveZones,
      refundPolicy: t.refundPolicy,
      visibility: 'PUBLIC',
      status: 'ACTIVE',
    });
    if (res?.id) {
      updatedTickets[i] = { ...t, id: res.id };
      onTicketSaved?.(i, res.id);
    }
  }
  return updatedTickets;
}
