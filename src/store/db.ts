/**
 * Teacher workspace storage (task 07). IndexedDB, scoped by teacher.
 *
 * Every read goes through a teacher-scoped accessor, so a signed-out or
 * different teacher cannot list or open another teacher's records through the
 * app. NOTE: this is app-level isolation on a shared device, not encryption.
 * The agreed device policy (task 01) may require encrypting at rest with a
 * credential-derived key; the accessor boundary here is where that would go.
 *
 * Committing an answer and advancing the cursor happen in one transaction
 * (see commitAttempt) so a restart never loses or duplicates an attempt.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Attempt, Learner, PresentedItem, ReceivedTransfer, Session, Teacher } from '../domain/types';
import { toB64u, utf8 } from '../transfer/bytes';

interface WorkspaceDB extends DBSchema {
  teachers: { key: string; value: Teacher };
  learners: { key: string; value: Learner; indexes: { byTeacher: string } };
  sessions: { key: string; value: Session; indexes: { byTeacher: string; byLearner: string } };
  transfers: { key: [string, string]; value: ReceivedTransfer; indexes: { byTeacher: string } };
  meta: { key: string; value: { key: string; value: string } };
}

export const DB_NAME = 'continued-workspace';
export const DB_VERSION = 1;

let dbp: Promise<IDBPDatabase<WorkspaceDB>> | null = null;

export function openWorkspace(name = DB_NAME) {
  if (!dbp) {
    dbp = openDB<WorkspaceDB>(name, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Migrations are additive and keyed on oldVersion so upgrades keep drafts.
        if (oldVersion < 1) {
          db.createObjectStore('teachers', { keyPath: 'id' });
          const l = db.createObjectStore('learners', { keyPath: 'id' });
          l.createIndex('byTeacher', 'teacherId');
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('byTeacher', 'teacherId');
          s.createIndex('byLearner', 'learnerId');
          const t = db.createObjectStore('transfers', { keyPath: ['teacherId', 'tid'] });
          t.createIndex('byTeacher', 'teacherId');
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbp;
}

/** Closes the connection (tests simulate an app restart with this). */
export async function resetWorkspaceHandle() {
  if (dbp) (await dbp).close();
  dbp = null;
}

const nowIso = () => new Date().toISOString();

function randomId(prefix: string, groups = 2): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I for read-aloud IDs
  const bytes = crypto.getRandomValues(new Uint8Array(groups * 4));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `${prefix}-${chars.match(/.{4}/g)!.join('-')}`;
}
export const newLearnerId = () => randomId('L');
export const newSessionId = () => randomId('S', 3);

async function hashPin(pin: string, salt: string) {
  const h = await crypto.subtle.digest('SHA-256', utf8(`${salt}:${pin}`));
  return toB64u(new Uint8Array(h));
}

// ---------- teacher profiles (local stand-in until Cognito, task 11) ----------

export async function listTeachers(): Promise<Pick<Teacher, 'id' | 'displayName'>[]> {
  const db = await openWorkspace();
  return (await db.getAll('teachers')).map(({ id, displayName }) => ({ id, displayName }));
}

export async function createTeacher(displayName: string, pin: string): Promise<Teacher> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4–8 digits');
  const salt = toB64u(crypto.getRandomValues(new Uint8Array(12)));
  const t: Teacher = { id: randomId('TCH'), displayName: displayName.trim(), pinSalt: salt, pinHash: await hashPin(pin, salt), createdAt: nowIso() };
  const db = await openWorkspace();
  await db.add('teachers', t);
  return t;
}

export async function signIn(teacherId: string, pin: string): Promise<Workspace | null> {
  const db = await openWorkspace();
  const t = await db.get('teachers', teacherId);
  if (!t || (await hashPin(pin, t.pinSalt)) !== t.pinHash) return null;
  return new Workspace(t.id, t.displayName);
}

// ---------- teacher-scoped workspace ----------

export class Workspace {
  constructor(readonly teacherId: string, readonly displayName: string) {}

  private own<T extends { teacherId: string }>(v: T | undefined): T | undefined {
    return v && v.teacherId === this.teacherId ? v : undefined;
  }

  async learners(): Promise<Learner[]> {
    const db = await openWorkspace();
    const all = await db.getAllFromIndex('learners', 'byTeacher', this.teacherId);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async learner(id: string) {
    return this.own(await (await openWorkspace()).get('learners', id));
  }

  async addLearner(input: Partial<Pick<Learner, 'label' | 'ageBand' | 'id' | 'source'>> = {}): Promise<Learner> {
    const db = await openWorkspace();
    const id = input.id ?? newLearnerId();
    const existing = await db.get('learners', id);
    if (existing) {
      if (existing.teacherId === this.teacherId) return existing;
      throw new Error('Learner ID already exists in another workspace on this device');
    }
    const l: Learner = { id, teacherId: this.teacherId, label: input.label?.trim() || undefined, ageBand: input.ageBand, createdAt: nowIso(), source: input.source ?? 'local' };
    await db.add('learners', l);
    return l;
  }

  async updateLearner(id: string, patch: Partial<Pick<Learner, 'label' | 'ageBand'>>) {
    const db = await openWorkspace();
    const l = this.own(await db.get('learners', id));
    if (!l) throw new Error('Learner not found');
    await db.put('learners', { ...l, ...patch });
  }

  /** Deletes the learner and all of their local sessions in one transaction. */
  async deleteLearner(id: string) {
    const db = await openWorkspace();
    const tx = db.transaction(['learners', 'sessions'], 'readwrite');
    const l = this.own(await tx.objectStore('learners').get(id));
    if (!l) throw new Error('Learner not found');
    const sessions = await tx.objectStore('sessions').index('byLearner').getAll(id);
    for (const s of sessions) if (s.teacherId === this.teacherId) await tx.objectStore('sessions').delete(s.id);
    await tx.objectStore('learners').delete(id);
    await tx.done;
  }

  async sessions(learnerId?: string): Promise<Session[]> {
    const db = await openWorkspace();
    const all = learnerId
      ? (await db.getAllFromIndex('sessions', 'byLearner', learnerId)).filter((s) => s.teacherId === this.teacherId)
      : await db.getAllFromIndex('sessions', 'byTeacher', this.teacherId);
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async session(id: string) {
    return this.own(await (await openWorkspace()).get('sessions', id));
  }

  async drafts() {
    return (await this.sessions()).filter((s) => s.status === 'draft');
  }

  async startSession(learnerId: string, opts: Pick<Session, 'assessmentLang' | 'contentVersion' | 'rubricVersion'>): Promise<Session> {
    if (!(await this.learner(learnerId))) throw new Error('Learner not found');
    const prior = (await this.sessions(learnerId)).find((s) => s.status === 'completed');
    const s: Session = {
      id: newSessionId(),
      teacherId: this.teacherId,
      learnerId,
      predecessorId: prior?.id,
      contentVersion: opts.contentVersion,
      assessmentLang: opts.assessmentLang,
      ...(opts.rubricVersion ? { rubricVersion: opts.rubricVersion } : {}),
      status: 'draft',
      startedAt: nowIso(),
      updatedAt: nowIso(),
      attempts: [],
      confirmed: {},
      overrides: {},
    };
    await (await openWorkspace()).add('sessions', s);
    return s;
  }

  /** Persist the presented item BEFORE it is shown so resume restores the same question. */
  async present(sessionId: string, item: PresentedItem): Promise<Session> {
    return this.mutate(sessionId, (s) => ({ ...s, current: item }));
  }

  /**
   * "Different question": show `item` instead of the current one, and remember the
   * replaced item so it is not offered again in this session. Not an attempt.
   */
  async replaceCurrent(sessionId: string, item: PresentedItem): Promise<Session> {
    return this.mutate(sessionId, (s) => ({
      ...s,
      current: item,
      shownNotAttempted: s.current ? [...(s.shownNotAttempted ?? []), s.current.itemId] : s.shownNotAttempted,
    }));
  }

  /** Commit an answer and advance the cursor atomically. */
  async commitAttempt(sessionId: string, attempt: Attempt, next?: PresentedItem): Promise<Session> {
    return this.mutate(sessionId, (s) => {
      if (s.current?.itemId !== attempt.itemId) throw new Error('Attempt does not match the presented item');
      return { ...s, attempts: [...s.attempts, attempt], current: next };
    });
  }

  async complete(sessionId: string, confirmed: Session['confirmed'], overrides: Session['overrides']) {
    return this.mutate(sessionId, (s) => ({ ...s, status: 'completed', current: undefined, confirmed, overrides, completedAt: nowIso() }));
  }

  async deleteSession(id: string) {
    const db = await openWorkspace();
    if (!this.own(await db.get('sessions', id))) throw new Error('Session not found');
    await db.delete('sessions', id);
  }

  private async mutate(id: string, fn: (s: Session) => Session): Promise<Session> {
    const db = await openWorkspace();
    const tx = db.transaction('sessions', 'readwrite');
    const s = this.own(await tx.store.get(id));
    if (!s) throw new Error('Session not found');
    if (s.status === 'completed') throw new Error('Session is already completed');
    const next = { ...fn(s), updatedAt: nowIso() };
    await tx.store.put(next);
    await tx.done;
    return next;
  }

  // ---------- received transfers ----------

  async saveTransfer(t: Omit<ReceivedTransfer, 'teacherId' | 'receivedAt'>) {
    const db = await openWorkspace();
    const rec: ReceivedTransfer = { ...t, teacherId: this.teacherId, receivedAt: nowIso() };
    await db.put('transfers', rec);
    return rec;
  }

  async transfers(): Promise<ReceivedTransfer[]> {
    const db = await openWorkspace();
    return (await db.getAllFromIndex('transfers', 'byTeacher', this.teacherId)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  async deleteTransfer(tid: string) {
    await (await openWorkspace()).delete('transfers', [this.teacherId, tid]);
  }

  /** Removes the whole local workspace for this teacher (device handover / leaving). */
  async deleteEverything() {
    const db = await openWorkspace();
    const tx = db.transaction(['teachers', 'learners', 'sessions', 'transfers'], 'readwrite');
    for (const l of await tx.objectStore('learners').index('byTeacher').getAll(this.teacherId)) await tx.objectStore('learners').delete(l.id);
    for (const s of await tx.objectStore('sessions').index('byTeacher').getAll(this.teacherId)) await tx.objectStore('sessions').delete(s.id);
    for (const t of await tx.objectStore('transfers').index('byTeacher').getAll(this.teacherId)) await tx.objectStore('transfers').delete([t.teacherId, t.tid]);
    await tx.objectStore('teachers').delete(this.teacherId);
    await tx.done;
  }
}
