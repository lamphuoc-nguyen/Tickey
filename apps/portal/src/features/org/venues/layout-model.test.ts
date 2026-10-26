import { describe, expect, it } from 'vitest';
import { definitionErrors, fromDefinition, rowLabel, nextZoneId, toDefinition, type EditorZone } from './layout-model';

const seated = (id: string, rows: number, seatsPerRow: number): EditorZone => ({
  id,
  name: `Khu ${id}`,
  type: 'seated',
  rows,
  seatsPerRow,
  capacity: 0,
});
const standing = (id: string, capacity: number): EditorZone => ({
  id,
  name: `Khu ${id}`,
  type: 'standing',
  rows: 0,
  seatsPerRow: 0,
  capacity,
});

describe('layout model', () => {
  it('generates a unique next zone id even when a middle zone is removed (F-08)', () => {
    // 1. Initial 4 zones A, B, C, D
    const stadium = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
    expect(nextZoneId(stadium)).toBe('E');

    // 2. Remove middle zone B -> remaining: A, C, D
    const remaining = stadium.filter((z) => z.id !== 'B');
    expect(remaining.map((z) => z.id)).toEqual(['A', 'C', 'D']);

    // 3. Adding next zone must NOT return 'D' (which would duplicate existing zone 'D' because length is 3)
    const nextId = nextZoneId(remaining);
    expect(nextId).toBe('B');
    expect(remaining.some((z) => z.id === nextId)).toBe(false);

    // 4. After adding 'B' back, next should be 'E'
    const updated = [...remaining, { id: nextId }];
    expect(nextZoneId(updated)).toBe('E');
  });

  it('labels rows A..Z then AA', () => {
    expect([0, 25, 26, 27].map(rowLabel)).toEqual(['A', 'Z', 'AA', 'AB']);
  });

  it('writes the JSON publish_layout_version expects: unique seat ids, row/number/x/y, standing capacity', () => {
    const definition = toDefinition([seated('A', 2, 3), standing('GA', 150)]);
    const [a, ga] = definition.zones;
    expect(a).toMatchObject({ id: 'A', type: 'seated', capacity: 6 });
    expect(a.type === 'seated' && a.seats.map((s) => s.id)).toEqual([
      'A-A1',
      'A-A2',
      'A-A3',
      'A-B1',
      'A-B2',
      'A-B3',
    ]);
    expect(ga).toMatchObject({ id: 'GA', type: 'standing', capacity: 150 });
  });

  it('stacks seated zones so their seats never overlap', () => {
    const [a, b] = toDefinition([seated('A', 3, 4), seated('B', 2, 4)]).zones;
    const lowestA = Math.max(...(a.type === 'seated' ? a.seats.map((s) => s.y) : []));
    const highestB = Math.min(...(b.type === 'seated' ? b.seats.map((s) => s.y) : []));
    expect(highestB).toBeGreaterThan(lowestA);
  });

  it('round-trips a saved definition back into the editor', () => {
    const zones = [seated('A', 4, 5), standing('GA', 80)];
    expect(fromDefinition(toDefinition(zones))).toEqual(zones);
  });

  it('flags a layout bigger than the venue before the server rejects it', () => {
    expect(definitionErrors([seated('A', 10, 10)], 120)).toEqual([]);
    expect(definitionErrors([seated('A', 10, 10), standing('GA', 50)], 120)[0]).toContain('vượt sức chứa');
  });

  it('requires at least one zone with seats or capacity', () => {
    expect(definitionErrors([], 100)).toContain('Sơ đồ cần ít nhất một khu vực.');
    expect(definitionErrors([standing('GA', 0)], 100).join()).toContain('sức chứa phải lớn hơn 0');
  });
});
