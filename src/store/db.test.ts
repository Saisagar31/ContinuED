import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTeacher, listTeachers, resetWorkspaceHandle, signIn, type Workspace } from './db';
import type { PresentedItem } from '../domain/types';

const item = (n: number): PresentedItem => ({
  itemId: `i${n}`,
  skillId: 'num.add_no_carry',
  band: 1,
  prompt: `${n} + 1`,
  expected: String(n + 1),
  selectionReason: 'test',
  presentedAt: new Date().toISOString(),
});

let a: Workspace;
let b: Workspace;

beforeEach(async () => {
  await resetWorkspaceHandle();
  await new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase('continued-workspace');
    r.onsuccess = res;
    r.onerror = rej;
  });
  const ta = await createTeacher('Teacher A', '1234');
  const tb = await createTeacher('Teacher B', '9876');
  a = (await signIn(ta.id, '1234'))!;
  b = (await signIn(tb.id, '9876'))!;
});

describe('teacher workspace', () => {
  it('rejects a wrong PIN', async () => {
    const [t] = await listTeachers();
    expect(await signIn(t.id, '0000')).toBeNull();
  });

  it('keeps two teachers isolated on one device', async () => {
    const l = await a.addLearner({ label: 'Front row', ageBand: '7-8' });
    await a.startSession(l.id, { assessmentLang: 'mr', contentVersion: 'sample-0.1' });
    expect(await a.learners()).toHaveLength(1);
    expect(await b.learners()).toHaveLength(0);
    expect(await b.learner(l.id)).toBeUndefined();
    expect(await b.sessions()).toHaveLength(0);
    await expect(b.deleteLearner(l.id)).rejects.toThrow();
    await expect(b.addLearner({ id: l.id })).rejects.toThrow(/another workspace/);
  });

  it('records the rubric version and remembers questions swapped out with "Different question"', async () => {
    const l = await a.addLearner();
    const s = await a.startSession(l.id, { assessmentLang: 'en', contentVersion: 'draft-1.0', rubricVersion: 'draft-rubric-1' });
    expect(s.rubricVersion).toBe('draft-rubric-1');
    await a.present(s.id, item(1));
    await a.replaceCurrent(s.id, item(2));
    const after = await a.replaceCurrent(s.id, item(3));
    expect(after.current?.itemId).toBe('i3');
    expect(after.shownNotAttempted).toEqual(['i1', 'i2']);
    expect(after.attempts).toHaveLength(0); // swapping is not an attempt
    expect((await a.session(s.id))?.shownNotAttempted).toEqual(['i1', 'i2']);
  });

  it('persists the presented item and resumes exactly after a restart', async () => {
    const l = await a.addLearner();
    const s = await a.startSession(l.id, { assessmentLang: 'en', contentVersion: 'sample-0.1' });
    await a.present(s.id, item(1));
    await a.commitAttempt(s.id, { ...item(1), observation: 'independent', answeredAt: new Date().toISOString() }, item(2));

    await resetWorkspaceHandle(); // simulate app restart
    const [t] = (await listTeachers()).filter((x) => x.displayName === 'Teacher A');
    const again = (await signIn(t.id, '1234'))!;
    const resumed = await again.session(s.id);
    expect(resumed?.current?.itemId).toBe('i2');
    expect(resumed?.attempts.map((x) => x.itemId)).toEqual(['i1']);
    expect((await again.drafts()).map((d) => d.id)).toEqual([s.id]);
  });

  it('refuses an attempt that does not match the presented item', async () => {
    const l = await a.addLearner();
    const s = await a.startSession(l.id, { assessmentLang: 'en', contentVersion: 'sample-0.1' });
    await a.present(s.id, item(1));
    await expect(a.commitAttempt(s.id, { ...item(9), observation: 'skipped', answeredAt: '' })).rejects.toThrow();
  });

  it('links a reassessment to its predecessor and keeps history', async () => {
    const l = await a.addLearner();
    const s1 = await a.startSession(l.id, { assessmentLang: 'en', contentVersion: 'sample-0.1' });
    await a.complete(s1.id, { 'num.recognition': 'developing' }, {});
    const s2 = await a.startSession(l.id, { assessmentLang: 'en', contentVersion: 'sample-0.1' });
    expect(s2.predecessorId).toBe(s1.id);
    expect(await a.sessions(l.id)).toHaveLength(2);
    await expect(a.present(s1.id, item(1))).rejects.toThrow(/completed/);
  });

  it('deletes a learner with their sessions, and a whole workspace', async () => {
    const l = await a.addLearner();
    await a.startSession(l.id, { assessmentLang: 'en', contentVersion: 'sample-0.1' });
    await a.deleteLearner(l.id);
    expect(await a.learners()).toHaveLength(0);
    expect(await a.sessions()).toHaveLength(0);

    await b.addLearner();
    await b.deleteEverything();
    expect((await listTeachers()).map((t) => t.displayName)).toEqual(['Teacher A']);
  });
});
