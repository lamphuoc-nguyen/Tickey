import { describe, it, expect } from 'vitest';
import { selectionLimit } from './selection-rules';
describe('selection limits from catalog', () => {
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
