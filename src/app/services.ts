/**
 * Glue between the screens and the school services, sync outbox and audio packs
 * (tasks 07/08/10/11/12 integration). Everything here is optional: with no
 * VITE_* configuration the app keeps working fully offline and nothing leaves
 * the phone.
 */
import { staffAuthConfigFromEnv } from '../auth/cognito';
import type { StaffSession } from '../auth/session';
import type { SyncEvent } from '../../shared/contracts';
import type { LangCode, Session, SkillSummary } from '../domain/types';
import { enqueue, flush, type SyncStatus } from '../sync/outbox';

/** Bound fetch: an unbound window.fetch throws "Illegal invocation" in browsers. */
export const webFetch: typeof fetch = (input, init) => fetch(input, init);

/** School sign-in / sync / signing / trends API, or null when this build has none. */
export const AUTH_CONFIG = staffAuthConfigFromEnv();
export const API_URL = AUTH_CONFIG?.apiUrl ?? null;

/** Where published audio packs live: `${AUDIO_BASE_URL}/<lang>/manifest.json`. Empty = feature off. */
export const AUDIO_BASE_URL = ((import.meta.env.VITE_AUDIO_BASE_URL as string | undefined) ?? '').trim().replace(/\/$/, '') || null;

const DEVICE_KEY = 'continued.deviceId';

/** A random ID for this phone, kept across restarts. Identifies the device to the sync API, never the learner. */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const id = `DEV-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'DEV-UNKNOWN';
  }
}

/** Event IDs must match /^[A-Za-z0-9-]{4,64}$/; the same operation always yields the same ID, so retries never double count. */
const eventId = (...parts: string[]) => parts.join('-').replace(/[^A-Za-z0-9-]/g, '-').slice(0, 64);

export function assessmentCompletedEvent(s: Session, summary: SkillSummary[]): SyncEvent | null {
  if (summary.length === 0) return null;
  return {
    eventId: eventId('EV-A', s.id),
    type: 'assessment_completed',
    occurredAt: s.completedAt ?? new Date().toISOString(),
    learner: s.learnerId,
    contentVersion: s.contentVersion,
    originLang: s.assessmentLang,
    summary,
  };
}

export function transferIssuedEvent(tid: string, learner: string, originLang: LangCode, contentVersion: string, summary: SkillSummary[]): SyncEvent | null {
  if (summary.length === 0) return null;
  return { eventId: eventId('EV-I', tid), type: 'transfer_issued', occurredAt: new Date().toISOString(), learner, contentVersion, originLang, summary };
}

export function transferReceivedEvent(tid: string, teacherId: string, learner: string, originLang: LangCode, destLang: LangCode, contentVersion: string, summary: SkillSummary[]): SyncEvent | null {
  if (summary.length === 0) return null;
  return {
    eventId: eventId('EV-R', tid, teacherId),
    type: 'transfer_received',
    occurredAt: new Date().toISOString(),
    learner,
    contentVersion,
    originLang,
    destLang,
    summary,
  };
}

/**
 * Queues a de-identified event on this phone, then tries to send the queue.
 * Only when school sync is configured for this build; otherwise nothing is
 * stored or sent. Never throws: sync problems show in the sync status, not as
 * errors in the teacher's flow.
 */
export async function record(event: SyncEvent | null, staff: StaffSession | null): Promise<void> {
  if (!event || !API_URL) return;
  try {
    await enqueue(event);
    await syncNow(staff);
  } catch {
    /* the outbox keeps the event; a later flush retries */
  }
}

/** Sends pending events when online and signed in to school services. */
export async function syncNow(staff: StaffSession | null): Promise<SyncStatus | null> {
  if (!API_URL || !staff || staff.state().status !== 'signed_in') return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  try {
    return await flush({ apiUrl: API_URL, deviceId: deviceId(), getToken: staff.getToken, fetch: webFetch });
  } catch {
    return null;
  }
}
