import { describe, it, expect, vi } from 'vitest';
import { persistWizardTickets, type WizardTicketItem } from './wizard-tickets';

describe('EventCreationWizard ticket persistence (F-07)', () => {
  const sampleTickets: WizardTicketItem[] = [
    {
      tempId: 't1',
      name: 'Vé VIP',
      kind: 'PAID',
      price: 500000,
      quota: 50,
      zoneIds: ['zone-1'],
      refundPolicy: 'ONLY_IF_CANCELLED',
    },
    {
      tempId: 't2',
      name: 'Vé Tiêu Chuẩn',
      kind: 'PAID',
      price: 250000,
      quota: 200,
      zoneIds: ['zone-2'],
      refundPolicy: 'ONLY_IF_CANCELLED',
    },
  ];

  const zones = [{ id: 'zone-1' }, { id: 'zone-2' }];

  it('saving step 3 twice calls PUT with existing IDs on the second save', async () => {
    let callCount = 0;
    const savedCalls: Array<{ id?: string; name: string }> = [];

    // Simulate saveFn (POST if id is undefined, PUT if id is present)
    const mockSaveFn = vi.fn(async (payload: Record<string, unknown> & { id?: string }) => {
      callCount++;
      savedCalls.push({ id: payload.id, name: payload.name as string });
      return { id: payload.id ?? `server-tt-${callCount}` };
    });

    // 1. First save (Step 3 -> Step 4 for the first time)
    const firstSaveResult = await persistWizardTickets(
      sampleTickets,
      'session-abc',
      zones,
      mockSaveFn,
    );

    // Initial calls should not have id (calls POST)
    expect(mockSaveFn).toHaveBeenCalledTimes(2);
    expect(savedCalls[0].id).toBeUndefined();
    expect(savedCalls[1].id).toBeUndefined();

    // Result should have IDs populated
    expect(firstSaveResult[0].id).toBe('server-tt-1');
    expect(firstSaveResult[1].id).toBe('server-tt-2');

    // Reset captured calls for the second save
    savedCalls.length = 0;

    // 2. Second save (user navigated back from Step 4 to Step 3 and clicked next again)
    const secondSaveResult = await persistWizardTickets(
      firstSaveResult,
      'session-abc',
      zones,
      mockSaveFn,
    );

    expect(mockSaveFn).toHaveBeenCalledTimes(4); // 2 more calls
    expect(savedCalls).toHaveLength(2);

    // Crucial F-07 assertion: the second save MUST send the existing id (PUT), not create duplicates
    expect(savedCalls[0].id).toBe('server-tt-1');
    expect(savedCalls[1].id).toBe('server-tt-2');
    expect(secondSaveResult[0].id).toBe('server-tt-1');
    expect(secondSaveResult[1].id).toBe('server-tt-2');
  });

  it('preserves saved IDs for earlier tickets if an error occurs mid-loop', async () => {
    const savedIds: Record<number, string> = {};
    const onTicketSaved = vi.fn((idx: number, id: string) => {
      savedIds[idx] = id;
    });

    const mockSaveFn = vi.fn(async (payload: Record<string, unknown> & { id?: string }) => {
      if (payload.name === 'Vé Tiêu Chuẩn') {
        throw new Error('Network error on ticket 2');
      }
      return { id: 'saved-vip-id' };
    });

    await expect(
      persistWizardTickets(sampleTickets, 'session-abc', zones, mockSaveFn, onTicketSaved),
    ).rejects.toThrow('Network error on ticket 2');

    // First ticket succeeded and had onTicketSaved invoked
    expect(onTicketSaved).toHaveBeenCalledWith(0, 'saved-vip-id');
    expect(savedIds[0]).toBe('saved-vip-id');
  });

  it('deactivates tickets removed from step 3 with PUT status INACTIVE and does not POST new tickets', async () => {
    let callCount = 0;
    const calls: Array<{ id?: string; status?: string; isPost: boolean }> = [];

    const mockSaveFn = vi.fn(async (payload: Record<string, unknown> & { id?: string }) => {
      callCount++;
      const isPost = !payload.id;
      const assignedId = payload.id ?? `server-tt-${callCount}`;
      calls.push({
        id: payload.id ?? assignedId,
        status: payload.status as string,
        isPost,
      });
      return { id: assignedId };
    });

    // 1. Initial save of 2 tickets
    const firstSaveResult = await persistWizardTickets(
      sampleTickets,
      'session-abc',
      zones,
      mockSaveFn,
      undefined,
      [],
    );
    expect(firstSaveResult).toHaveLength(2);
    expect(firstSaveResult[0].id).toBe('server-tt-1');
    expect(firstSaveResult[1].id).toBe('server-tt-2');
    const previouslySavedIds = firstSaveResult.map((t) => t.id!);

    // 2. User removes 1 ticket (sampleTickets[1], id: server-tt-2)
    const remainingTickets = [firstSaveResult[0]];
    calls.length = 0;

    // 3. User saves again
    const secondSaveResult = await persistWizardTickets(
      remainingTickets,
      'session-abc',
      zones,
      mockSaveFn,
      undefined,
      previouslySavedIds,
    );

    // Verify calls:
    // Exactly 1 PUT INACTIVE for server-tt-2 (removed ticket)
    // Exactly 1 PUT ACTIVE for server-tt-1 (existing remaining ticket)
    // 0 POST calls
    const postCalls = calls.filter((c) => c.isPost);
    expect(postCalls).toHaveLength(0);

    const inactiveCalls = calls.filter((c) => c.id === 'server-tt-2');
    expect(inactiveCalls).toHaveLength(1);
    expect(inactiveCalls[0].status).toBe('INACTIVE');
    expect(inactiveCalls[0].isPost).toBe(false);

    const activeCalls = calls.filter((c) => c.id === 'server-tt-1');
    expect(activeCalls).toHaveLength(1);
    expect(activeCalls[0].status).toBe('ACTIVE');
    expect(activeCalls[0].isPost).toBe(false);

    expect(secondSaveResult).toHaveLength(1);
    expect(secondSaveResult[0].id).toBe('server-tt-1');
  });

  it('deactivates tickets removed after a previous save failed mid-loop (F-09)', async () => {
    let callCount = 0;
    const calls: Array<{ id?: string; status?: string; isPost: boolean }> = [];

    const mockSaveFn = vi.fn(async (payload: Record<string, unknown> & { id?: string }) => {
      callCount++;
      const isPost = !payload.id;
      const assignedId = payload.id ?? `server-tt-${callCount}`;
      calls.push({
        id: payload.id ?? assignedId,
        status: payload.status as string,
        isPost,
      });

      // Simulate failure on third ticket during initial save
      if (payload.name === 'Vé Thử Nghiệm Lỗi') {
        throw new Error('VALIDATION_FAILED: Invalid configuration for ticket 3');
      }

      return { id: assignedId };
    });

    let currentTickets: WizardTicketItem[] = [
      {
        tempId: 't1',
        name: 'Vé VIP',
        kind: 'PAID',
        price: 500000,
        quota: 50,
        zoneIds: ['zone-1'],
        refundPolicy: 'ONLY_IF_CANCELLED',
      },
      {
        tempId: 't2',
        name: 'Vé Tiêu Chuẩn',
        kind: 'PAID',
        price: 250000,
        quota: 200,
        zoneIds: ['zone-2'],
        refundPolicy: 'ONLY_IF_CANCELLED',
      },
      {
        tempId: 't3',
        name: 'Vé Thử Nghiệm Lỗi',
        kind: 'PAID',
        price: 100000,
        quota: 50,
        zoneIds: ['zone-1'],
        refundPolicy: 'ONLY_IF_CANCELLED',
      },
    ];

    let savedTicketIds: string[] = [];

    const onTicketSaved = (idx: number, id: string) => {
      currentTickets = currentTickets.map((t, i) => (i === idx ? { ...t, id } : t));
      if (!savedTicketIds.includes(id)) {
        savedTicketIds.push(id);
      }
    };

    const onTicketDeactivated = (deactivatedId: string) => {
      savedTicketIds = savedTicketIds.filter((id) => id !== deactivatedId);
    };

    // 1. First save attempt - fails on ticket 3
    await expect(
      persistWizardTickets(
        currentTickets,
        'session-abc',
        zones,
        mockSaveFn,
        onTicketSaved,
        savedTicketIds,
        onTicketDeactivated,
      ),
    ).rejects.toThrow('VALIDATION_FAILED');

    // First two tickets succeeded and their IDs were saved
    expect(currentTickets[0].id).toBe('server-tt-1');
    expect(currentTickets[1].id).toBe('server-tt-2');
    expect(currentTickets[2].id).toBeUndefined();
    expect(savedTicketIds).toEqual(['server-tt-1', 'server-tt-2']);

    // 2. User removes ticket 2 (server-tt-2) and fixes ticket 3 name
    currentTickets = [
      currentTickets[0],
      { ...currentTickets[2], name: 'Vé Khuyến Mãi Đã Sửa' },
    ];
    calls.length = 0;

    // 3. Second save attempt
    const secondSaveResult = await persistWizardTickets(
      currentTickets,
      'session-abc',
      zones,
      mockSaveFn,
      onTicketSaved,
      savedTicketIds,
      onTicketDeactivated,
    );

    // Assertions for F-09:
    // - Ticket 2 must have been deactivated with PUT status INACTIVE
    const inactiveCalls = calls.filter((c) => c.id === 'server-tt-2');
    expect(inactiveCalls).toHaveLength(1);
    expect(inactiveCalls[0].status).toBe('INACTIVE');
    expect(inactiveCalls[0].isPost).toBe(false);

    // - Ticket 1 was updated with PUT status ACTIVE
    const activeTicket1Calls = calls.filter((c) => c.id === 'server-tt-1');
    expect(activeTicket1Calls).toHaveLength(1);
    expect(activeTicket1Calls[0].status).toBe('ACTIVE');
    expect(activeTicket1Calls[0].isPost).toBe(false);

    // - Ticket 3 (new) was created with POST
    const newTicketCalls = calls.filter((c) => c.isPost);
    expect(newTicketCalls).toHaveLength(1);
    expect(newTicketCalls[0].id).toBe('server-tt-6');

    // - Resulting ticket list has 2 tickets with correct IDs
    expect(secondSaveResult).toHaveLength(2);
    expect(secondSaveResult[0].id).toBe('server-tt-1');
    expect(secondSaveResult[1].id).toBe('server-tt-6');
    expect(savedTicketIds).toEqual(['server-tt-1', 'server-tt-6']);
  });
});
