import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { checkSyncEvent } from '../../shared/guards';
import type { Session } from '../domain/types';
import { pending } from '../sync/outbox';
import { API_URL, assessmentCompletedEvent, record, transferIssuedEvent, transferReceivedEvent } from './services';

const session: Session = {
  id: 'S-ABCD-EFGH-JKLM', teacherId: 'T-1', learnerId: 'L-7K3Q-9FX2', contentVersion: 'draft-1.0', assessmentLang: 'mr',
  status: 'completed', startedAt: '2026-11-26T09:00:00Z', updatedAt: '2026-11-26T09:20:00Z', completedAt: '2026-11-26T09:20:00Z',
  attempts: [], confirmed: { 'num.sub_borrow': 'not_yet' }, overrides: {},
};
const summary = [{ skillId: 'num.sub_borrow', status: 'not_yet' as const, evidence: { independent: 0, prompted: 1, incorrect: 2, skipped: 0 } }];

describe('sync events built by the app (integration of tasks 07/08 with task 11)', () => {
  it('pass the server-side validator and carry no learner name', () => {
    const events = [
      assessmentCompletedEvent(session, summary),
      transferIssuedEvent('T-ABCD-EFGH-JKLM', session.learnerId, 'mr', 'draft-1.0', summary),
      transferReceivedEvent('T-ABCD-EFGH-JKLM', 'T-XY12-34ZW', session.learnerId, 'mr', 'kn', 'draft-1.0', summary),
    ];
    for (const e of events) {
      expect(e).not.toBeNull();
      expect(checkSyncEvent(e, 'event')).toBeNull();
      expect(JSON.stringify(e)).not.toMatch(/label|nickname|name/i);
    }
  });

  it('use the same event ID for the same operation, so retries and reprints never double count', () => {
    expect(assessmentCompletedEvent(session, summary)!.eventId).toBe(assessmentCompletedEvent(session, summary)!.eventId);
    const a = transferIssuedEvent('T-1234', 'L-1', 'mr', 'draft-1.0', summary)!;
    const b = transferIssuedEvent('T-1234', 'L-1', 'mr', 'draft-1.0', summary)!;
    expect(a.eventId).toBe(b.eventId);
    // Two teachers receiving the same slip are two receipts.
    expect(transferReceivedEvent('T-1', 'TEACH-A', 'L-1', 'mr', 'kn', 'v', summary)!.eventId).not.toBe(
      transferReceivedEvent('T-1', 'TEACH-B', 'L-1', 'mr', 'kn', 'v', summary)!.eventId,
    );
  });

  it('skips empty summaries', () => {
    expect(assessmentCompletedEvent(session, [])).toBeNull();
  });

  it('stores and sends nothing when this build has no school services', async () => {
    expect(API_URL).toBeNull();
    await record(assessmentCompletedEvent(session, summary), null);
    expect(await pending()).toHaveLength(0);
  });
});
