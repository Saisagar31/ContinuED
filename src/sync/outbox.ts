/**
 * Sync outbox (task 11, client side). Pending de-identified events wait here in
 * IndexedDB ("continued-sync", separate from the teacher workspace DB) until the
 * school API acknowledges them by ID.
 *
 * Rules:
 *  - Only IDs the server lists as accepted or duplicate are removed.
 *  - Rejected events stay, with the server's reason, so the teacher can see them.
 *    They are not re-sent automatically (server validation would reject them again).
 *  - 401 → status 'reauth_required'; nothing is deleted and flushing stops.
 *  - Network failure or 5xx → bounded exponential backoff, then 'offline' / 'error';
 *    nothing is deleted.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { MAX_SYNC_BATCH, type SyncAck, type SyncEvent } from '../../shared/contracts';
import { checkSyncAck } from '../../shared/guards';

export interface OutboxEntry {
  eventId: string;
  event: SyncEvent;
  enqueuedAt: string;
  rejectedReason?: string;
  rejectedAt?: string;
}

interface SyncDB extends DBSchema {
  outbox: { key: string; value: OutboxEntry };
}

export const SYNC_DB_NAME = 'continued-sync';
const SYNC_DB_VERSION = 1;

let dbp: Promise<IDBPDatabase<SyncDB>> | null = null;

function openOutbox() {
  if (!dbp) {
    dbp = openDB<SyncDB>(SYNC_DB_NAME, SYNC_DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) db.createObjectStore('outbox', { keyPath: 'eventId' });
      },
    });
  }
  return dbp;
}

/** Closes the connection (tests use this between cases). */
export async function resetOutboxHandle() {
  if (dbp) (await dbp).close();
  dbp = null;
}

// ---------- status ----------

export type SyncState = 'idle' | 'syncing' | 'offline' | 'reauth_required' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastError?: string;
  lastSyncAt?: string; // last time the server acknowledged a batch
}

let status: SyncStatus = { state: 'idle' };
const listeners = new Set<(s: SyncStatus) => void>();

export const getSyncStatus = (): SyncStatus => status;

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  for (const fn of listeners) fn(status);
}

/** Tests only. */
export function resetSyncStatus() {
  status = { state: 'idle' };
}

// ---------- queue ----------

/** Adds an event. Re-enqueueing the same eventId replaces it (retries reuse the ID). */
export async function enqueue(event: SyncEvent): Promise<void> {
  const db = await openOutbox();
  await db.put('outbox', { eventId: event.eventId, event, enqueuedAt: new Date().toISOString() });
}

/** Every entry still on the device, including rejected ones (check rejectedReason). */
export async function pending(): Promise<OutboxEntry[]> {
  const db = await openOutbox();
  return db.getAll('outbox');
}

// ---------- flush ----------

export interface FlushOptions {
  apiUrl: string; // e.g. https://api.example.org (no trailing slash needed)
  deviceId: string;
  /** Current ID token, or null when the teacher must sign in again. */
  getToken: () => Promise<string | null>;
  fetch: typeof fetch;
  maxAttempts?: number; // per batch, default 6
  baseDelayMs?: number; // default 500; delay doubles each retry, capped at 30 s
  sleep?: (ms: number) => Promise<void>;
}

type Outcome = { kind: 'ack'; ack: SyncAck } | { kind: 'stop'; state: SyncState; error: string };

async function sendBatch(opts: FlushOptions, events: SyncEvent[]): Promise<Outcome> {
  const maxAttempts = opts.maxAttempts ?? 6;
  const base = opts.baseDelayMs ?? 500;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: Outcome = { kind: 'stop', state: 'error', error: 'not sent' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await sleep(Math.min(base * 2 ** (attempt - 2), 30_000));
    const token = await opts.getToken();
    if (!token) return { kind: 'stop', state: 'reauth_required', error: 'sign in again to sync' };

    let res: Response;
    try {
      res = await opts.fetch(`${opts.apiUrl.replace(/\/$/, '')}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ deviceId: opts.deviceId, events }),
      });
    } catch {
      last = { kind: 'stop', state: 'offline', error: 'network unavailable' };
      continue; // retry with backoff
    }

    if (res.status === 401) return { kind: 'stop', state: 'reauth_required', error: 'session expired — sign in again to sync' };
    if (res.status >= 500 || res.status === 429) {
      last = { kind: 'stop', state: 'error', error: `server error ${res.status}` };
      continue;
    }
    if (!res.ok) return { kind: 'stop', state: 'error', error: `request refused (${res.status})` };

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { kind: 'stop', state: 'error', error: 'server reply was not JSON' };
    }
    const bad = checkSyncAck(body);
    if (bad) return { kind: 'stop', state: 'error', error: `bad acknowledgement: ${bad}` };
    return { kind: 'ack', ack: body as SyncAck };
  }
  return last;
}

/** Sends every non-rejected pending event in batches of at most MAX_SYNC_BATCH. */
export async function flush(opts: FlushOptions): Promise<SyncStatus> {
  if (status.state === 'syncing') return status;
  setStatus({ state: 'syncing' });
  const db = await openOutbox();
  const toSend = (await db.getAll('outbox')).filter((e) => !e.rejectedReason);

  for (let i = 0; i < toSend.length; i += MAX_SYNC_BATCH) {
    const chunk = toSend.slice(i, i + MAX_SYNC_BATCH);
    const out = await sendBatch(
      opts,
      chunk.map((e) => e.event),
    );
    if (out.kind === 'stop') {
      setStatus({ state: out.state, lastError: out.error });
      return status;
    }
    const sent = new Set(chunk.map((e) => e.eventId));
    const tx = db.transaction('outbox', 'readwrite');
    for (const id of [...out.ack.accepted, ...out.ack.duplicate]) if (sent.has(id)) await tx.store.delete(id);
    for (const r of out.ack.rejected) {
      if (!sent.has(r.eventId)) continue;
      const entry = await tx.store.get(r.eventId);
      if (entry) await tx.store.put({ ...entry, rejectedReason: r.reason, rejectedAt: out.ack.asOf });
    }
    await tx.done;
    setStatus({ lastSyncAt: out.ack.asOf });
  }
  setStatus({ state: 'idle', lastError: undefined });
  return status;
}
