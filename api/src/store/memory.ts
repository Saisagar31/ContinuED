/**
 * In-memory SchoolStore for tests and the dev server. Mirrors the DynamoDB
 * single-table layout and semantics described in types.ts. Each mutation runs
 * synchronously with no await between check and write, so it is atomic within
 * the Node event loop (the in-process equivalent of one TransactWriteItems).
 * Data is lost when the process exits.
 */
import {
  counterKeysFor,
  districtPk,
  eventSk,
  expiresAtFor,
  parseCounterSk,
  schoolPk,
  storedEventFields,
  type Counter,
  type PutEventInput,
  type PutResult,
  type SchoolStore,
} from './types';

type Item = Record<string, unknown> & { PK: string; SK: string };

export function memoryStore(): SchoolStore & { items(): Item[] } {
  const table = new Map<string, Map<string, Item>>();
  const part = (pk: string) => {
    let p = table.get(pk);
    if (!p) table.set(pk, (p = new Map()));
    return p;
  };
  const add = (pk: string, sk: string, delta: number) => {
    const p = part(pk);
    const cur = p.get(sk);
    p.set(sk, { PK: pk, SK: sk, n: ((cur?.n as number | undefined) ?? 0) + delta });
  };

  return {
    async putEvent(input: PutEventInput): Promise<PutResult> {
      const pk = schoolPk(input.schoolId);
      const sk = eventSk(input.event.eventId);
      if (part(pk).has(sk)) return 'duplicate'; // attribute_not_exists(PK) failed
      const aggKeys = counterKeysFor(input.event);
      part(pk).set(sk, {
        PK: pk,
        SK: sk,
        ...storedEventFields(input.event),
        schoolId: input.schoolId,
        deviceId: input.deviceId,
        receivedAt: input.receivedAt.toISOString(),
        expiresAt: expiresAtFor(input.receivedAt, input.retentionDays),
        aggKeys,
      });
      for (const k of aggKeys) add(pk, k, 1);
      if (input.district) part(districtPk(input.district)).set(pk, { PK: districtPk(input.district), SK: pk });
      return 'accepted';
    },

    async readCounters(schoolId, fromMonth, toMonth): Promise<Counter[]> {
      const lo = `AGG#${fromMonth}`;
      const hi = `AGG#${toMonth}#￿`;
      const out: Counter[] = [];
      for (const [sk, item] of table.get(schoolPk(schoolId)) ?? []) {
        if (sk < lo || sk > hi) continue;
        const c = parseCounterSk(schoolId, sk, item.n as number);
        if (c && c.n !== 0) out.push(c);
      }
      return out;
    },

    async schoolsInDistrict(district) {
      return [...(table.get(districtPk(district))?.keys() ?? [])].map((sk) => sk.slice('SCHOOL#'.length));
    },

    async deleteLearner(schoolId, learner) {
      const pk = schoolPk(schoolId);
      const p = table.get(pk);
      if (!p) return 0;
      let deleted = 0;
      for (const [sk, item] of [...p]) {
        if (!sk.startsWith('EVENT#') || item.learner !== learner) continue;
        p.delete(sk);
        for (const k of item.aggKeys as string[]) add(pk, k, -1);
        deleted++;
      }
      return deleted;
    },

    items: () => [...table.values()].flatMap((p) => [...p.values()]),
  };
}
