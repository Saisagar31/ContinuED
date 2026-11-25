import { describe, expect, it } from 'vitest';
import { aggregate, syntheticEvents, SUPPRESS_BELOW, type TransferEvent } from './aggregates';

const ev = (id: string, over: Partial<TransferEvent> = {}): TransferEvent => ({
  eventId: id,
  district: 'D1',
  school: 'S1',
  from: 'mr',
  to: 'kn',
  month: '2026-03',
  needsSupport: ['num.place_value'],
  ...over,
});

const Q = { fromMonth: '2026-01', toMonth: '2026-12' };

describe('aggregates', () => {
  it('counts retried events once', () => {
    const events = [...Array.from({ length: 6 }, (_, i) => ev(`e${i}`)), ev('e0'), ev('e1')];
    const r = aggregate(events, Q, 1, 'now');
    expect(r.totalTransfers).toBe(6);
    expect(r.corridors).toEqual([{ from: 'mr', to: 'kn', count: 6 }]);
    expect(r.skills).toEqual([{ skillId: 'num.place_value', count: 6 }]);
  });

  it('suppresses small cohorts', () => {
    const events = [...Array.from({ length: 6 }, (_, i) => ev(`a${i}`)), ...Array.from({ length: SUPPRESS_BELOW - 1 }, (_, i) => ev(`b${i}`, { from: 'ta', to: 'ml', needsSupport: [] }))];
    const r = aggregate(events, Q, 1, 'now');
    expect(r.corridors.find((c) => c.from === 'ta')?.count).toBeNull();
    expect(r.corridors.find((c) => c.from === 'mr')?.count).toBe(6);
  });

  it('matches independently computed totals on the synthetic dataset', () => {
    const events = syntheticEvents(7, 300);
    const unique = new Map(events.map((e) => [e.eventId, e]));
    expect(events.length).toBeGreaterThan(unique.size); // dataset really contains retries
    const r = aggregate(events, Q, 18, 'now');
    expect(r.totalTransfers).toBe(unique.size);
    const pune = aggregate(events, { ...Q, district: 'Pune' }, 18, 'now');
    const expected = [...unique.values()].filter((e) => e.district === 'Pune').length;
    expect(pune.totalTransfers).toBe(expected);
    const mar = aggregate(events, { fromMonth: '2026-03', toMonth: '2026-03' }, 18, 'now');
    expect(mar.byMonth.map((m) => m.month)).toEqual(['2026-03']);
  });
});
