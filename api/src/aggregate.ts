/**
 * Turns stored counters into an AggregateResponse, with the same small-cohort
 * suppression rule as src/dashboard/aggregates.ts (same SUPPRESS_BELOW value).
 */
import { SUPPRESS_BELOW, type AggregateResponse, type Count } from '../../shared/contracts';
import type { LangCode } from '../../shared/domain';
import type { Counter } from './store/types';

const suppress = (n: number): Count => (n > 0 && n < SUPPRESS_BELOW ? null : n);

export function summarise(counters: Counter[], opts: { originLang?: LangCode; schoolsTotal: number; asOf: string }): AggregateResponse {
  const corridor = new Map<string, number>();
  const skill = new Map<string, number>();
  const month = new Map<string, number>();
  const reporting = new Set<string>();
  let total = 0;

  for (const c of counters) {
    if (c.n <= 0) continue;
    if (c.dimension === 'CORRIDOR') {
      const [from] = c.key.split('>');
      if (opts.originLang && from !== opts.originLang) continue;
      corridor.set(c.key, (corridor.get(c.key) ?? 0) + c.n);
      month.set(c.month, (month.get(c.month) ?? 0) + c.n);
      total += c.n;
      reporting.add(c.schoolId);
    } else {
      const sep = c.key.indexOf('#');
      const from = c.key.slice(0, sep);
      if (opts.originLang && from !== opts.originLang) continue;
      const skillId = c.key.slice(sep + 1);
      skill.set(skillId, (skill.get(skillId) ?? 0) + c.n);
    }
  }

  return {
    asOf: opts.asOf,
    coverage: { schoolsReporting: reporting.size, schoolsTotal: opts.schoolsTotal },
    totalTransfers: suppress(total),
    corridors: [...corridor]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([k, n]) => {
        const [from, to] = k.split('>') as [LangCode, LangCode];
        return { from, to, count: suppress(n) };
      }),
    skills: [...skill].sort(([a], [b]) => a.localeCompare(b)).map(([skillId, n]) => ({ skillId, count: suppress(n) })),
    byMonth: [...month].sort(([a], [b]) => a.localeCompare(b)).map(([m, n]) => ({ month: m, count: suppress(n) })),
    suppressionThreshold: SUPPRESS_BELOW,
  };
}
