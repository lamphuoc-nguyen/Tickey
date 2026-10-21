import { describe, it, expect } from 'vitest';
import { selectedSeatItems, selectionLimit } from './selection-rules';
describe('selection limits from catalog', () => {
  it('keeps selected seats across seated zones and reports missing prices', () => {
    expect(
      selectedSeatItems(
        ['a', 'b', 'c'],
        new Map([
          ['a', 'paid'],
          ['b', 'free'],
        ]),
      ),
    ).toEqual({
      items: [
        { seatId: 'a', ticketTypeId: 'paid' },
        { seatId: 'b', ticketTypeId: 'free' },
      ],
      missing: ['c'],
    });
  });
  it.each([0, -1, 1.5, NaN])('rejects invalid quantities (%s) before submission', (quantity) => {
    expect(
      selectionLimit([{ ticketTypeId: 'type', quantity }], [{ id: 'type', maxPerOrder: 10 }]),
    ).not.toBeNull();
  });
  it('rejects duplicated seats even when assigned to different types', () => {
    expect(
      selectionLimit(
        [
          { seatId: 'a', ticketTypeId: 'x' },
          { seatId: 'a', ticketTypeId: 'y' },
        ],
        [
          { id: 'x', maxPerOrder: 2 },
          { id: 'y', maxPerOrder: 2 },
        ],
      ),
    ).toContain('một lần');
  });
  it('counts both seated and standing lines against server limits', () => {
    expect(
      selectionLimit(
        [
          { ticketTypeId: 'type', seatId: 'a' },
          { ticketTypeId: 'type', quantity: 2, zoneId: 'z' },
        ],
        [{ id: 'type', maxPerOrder: 2 }],
      ),
    ).toContain('giới hạn');
  });
  it('requires a known type without inventing an account cap', () => {
    expect(selectionLimit([{ ticketTypeId: 'type', seatId: 'a' }], [])).toContain('Chưa xác định');
    expect(
      selectionLimit([{ ticketTypeId: 'type', quantity: 3 }], [{ id: 'type', maxPerOrder: 10 }]),
    ).toBeNull();
    expect(
      selectionLimit([{ ticketTypeId: 'type', quantity: 3 }], [{ id: 'type', maxPerOrder: 10 }], 2),
    ).toContain('tối đa 2');
  });
});
