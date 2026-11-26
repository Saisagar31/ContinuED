/**
 * Staff session store (task 11), one instance per local teacher profile.
 *
 * Shared-phone rules (task 07):
 *  - ID and access tokens live in memory only, inside this instance.
 *  - IndexedDB ("continued-auth") keeps ONLY the refresh token and non-secret profile
 *    facts (school, district, roles, display email), keyed by the local teacher id.
 *    Another teacher's instance reads a different record, so it never sees this
 *    teacher's school session. NOTE: like the workspace DB, this is app-level
 *    isolation, not encryption at rest.
 *  - When the app switches teacher it must drop this instance (call dispose()).
 *
 * getToken() is what the outbox, apiAggregateSource and serverSigner take. It returns
 * a valid ID token, refreshing when it expires within 60 s. If Cognito refuses the
 * refresh token, the stored session is cleared and null is returned, so callers show
 * 'reauth_required'. If the refresh only fails for lack of network, the refresh token
 * is kept and null is returned (the request could not have been made anyway).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { checkTrustList } from '../../shared/guards';
import type { TrustListResponse } from '../../shared/contracts';
import type { TrustStore } from '../transfer/trust';
import type { AuthErrorCode, CognitoClient, CognitoTokens, StaffProfile, SupportedChallenge } from './cognito';

export const AUTH_DB_NAME = 'continued-auth';
const AUTH_DB_VERSION = 1;
/** Same key src/transfer/deviceTrust.ts reads. */
export const TRUST_STORAGE_KEY = 'continued.trust.v1';
const REFRESH_MARGIN_MS = 60_000;

export interface StoredSession {
  teacherId: string;
  refreshToken: string;
  profile: StaffProfile;
  savedAt: string;
}

interface AuthDB extends DBSchema {
  sessions: { key: string; value: StoredSession };
}

let dbp: Promise<IDBPDatabase<AuthDB>> | null = null;

function openAuthDb() {
  if (!dbp) {
    dbp = openDB<AuthDB>(AUTH_DB_NAME, AUTH_DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) db.createObjectStore('sessions', { keyPath: 'teacherId' });
      },
    });
  }
  return dbp;
}

/** Closes the connection (tests use this between cases). */
export async function resetAuthDbHandle() {
  if (dbp) (await dbp).close();
  dbp = null;
}

export type SessionStatus = 'signed_out' | 'signed_in' | 'reauth_required';

export interface SessionState {
  status: SessionStatus;
  profile?: StaffProfile;
  /** Set while a sign-in waits for a new password or an MFA code. */
  challenge?: SupportedChallenge;
  /** Last trust-list fetch problem, if any (sign-in still succeeds without it). */
  trustError?: string;
}

export type SignInOutcome =
  | { ok: true; profile: StaffProfile }
  | { ok: false; challenge: SupportedChallenge }
  | { ok: false; error: AuthErrorCode | 'no_pending_challenge' };

export interface StaffSessionOptions {
  teacherId: string;
  client: CognitoClient;
  apiUrl: string;
  fetch: typeof fetch;
  now?: () => number;
  /** Where the trust list goes; defaults to window.localStorage when available. */
  storage?: Pick<Storage, 'setItem'> | null;
}

export interface StaffSession {
  readonly teacherId: string;
  /** Reads the stored record for this teacher (call once after creating). */
  load(): Promise<SessionState>;
  state(): SessionState;
  signIn(username: string, password: string): Promise<SignInOutcome>;
  completeNewPassword(newPassword: string): Promise<SignInOutcome>;
  submitMfaCode(code: string): Promise<SignInOutcome>;
  getToken(): Promise<string | null>;
  signOut(): Promise<void>;
  /** Forgets in-memory tokens without touching storage (call when switching teacher). */
  dispose(): void;
  onChange(fn: (s: SessionState) => void): () => void;
}

function defaultStorage(): Pick<Storage, 'setItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function createStaffSession(opts: StaffSessionOptions): StaffSession {
  const now = opts.now ?? Date.now;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const listeners = new Set<(s: SessionState) => void>();

  let tokens: CognitoTokens | null = null; // memory only
  let refreshToken: string | null = null;
  let pending: { challenge: SupportedChallenge; session: string; username: string } | null = null;
  let current: SessionState = { status: 'signed_out' };
  let inflight: Promise<string | null> | null = null;
  let generation = 0; // bumps on signOut/dispose so a late refresh cannot resurrect a session

  function set(next: SessionState) {
    current = next;
    for (const fn of listeners) fn(current);
  }

  async function persist() {
    if (!tokens || !refreshToken) return;
    const db = await openAuthDb();
    await db.put('sessions', { teacherId: opts.teacherId, refreshToken, profile: tokens.profile, savedAt: new Date(now()).toISOString() });
  }

  async function clearStored() {
    const db = await openAuthDb();
    await db.delete('sessions', opts.teacherId);
  }

  async function fetchTrust(idToken: string): Promise<string | undefined> {
    let res: Response;
    try {
      res = await opts.fetch(`${opts.apiUrl.replace(/\/$/, '')}/trust`, { headers: { authorization: `Bearer ${idToken}` } });
    } catch {
      return 'network unavailable';
    }
    if (!res.ok) return `trust request failed (${res.status})`;
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return 'trust reply was not JSON';
    }
    const bad = checkTrustList(body);
    if (bad) return bad;
    const t = body as TrustListResponse;
    const store: TrustStore = { keys: t.keys, revoked: t.revoked, revocationListAsOf: t.asOf };
    try {
      storage?.setItem(TRUST_STORAGE_KEY, JSON.stringify(store));
    } catch {
      return 'could not save trust list';
    }
    return storage ? undefined : 'no storage for trust list';
  }

  async function finish(t: CognitoTokens): Promise<SignInOutcome> {
    tokens = t;
    if (t.refreshToken) refreshToken = t.refreshToken;
    pending = null;
    await persist();
    const trustError = await fetchTrust(t.idToken);
    set({ status: 'signed_in', profile: t.profile, ...(trustError ? { trustError } : {}) });
    return { ok: true, profile: t.profile };
  }

  async function handle(r: Awaited<ReturnType<CognitoClient['signIn']>>): Promise<SignInOutcome> {
    if (r.ok) return finish(r.session);
    if ('challenge' in r) {
      pending = { challenge: r.challenge, session: r.session, username: r.username };
      set({ ...current, challenge: r.challenge });
      return { ok: false, challenge: r.challenge };
    }
    // A failed challenge answer may still be retried with the same Cognito session,
    // except when Cognito says the session itself is no longer valid.
    if (pending && r.error === 'not_authorized') {
      pending = null;
      const { challenge: _drop, ...rest } = current;
      set(rest);
    }
    return { ok: false, error: r.error };
  }

  async function doRefresh(): Promise<string | null> {
    if (!refreshToken) return null;
    const gen = generation;
    const r = await opts.client.refresh(refreshToken);
    if (gen !== generation) return null;
    if (r.ok) {
      tokens = { ...r.session, refreshToken: r.session.refreshToken ?? refreshToken };
      refreshToken = tokens.refreshToken!;
      await persist();
      set({ status: 'signed_in', profile: tokens.profile });
      return tokens.idToken;
    }
    if (r.error === 'not_authorized') {
      tokens = null;
      refreshToken = null;
      await clearStored();
      set({ status: 'reauth_required', ...(current.profile ? { profile: current.profile } : {}) });
    }
    return null;
  }

  return {
    teacherId: opts.teacherId,

    async load() {
      const db = await openAuthDb();
      const rec = await db.get('sessions', opts.teacherId);
      if (rec && rec.teacherId === opts.teacherId) {
        refreshToken = rec.refreshToken;
        set({ status: 'signed_in', profile: rec.profile });
      }
      return current;
    },

    state: () => current,

    async signIn(username, password) {
      pending = null;
      return handle(await opts.client.signIn(username.trim(), password));
    },

    async completeNewPassword(newPassword) {
      if (!pending || pending.challenge !== 'NEW_PASSWORD_REQUIRED') return { ok: false, error: 'no_pending_challenge' };
      return handle(await opts.client.completeNewPassword(pending.username, pending.session, newPassword));
    },

    async submitMfaCode(code) {
      if (!pending || pending.challenge !== 'SOFTWARE_TOKEN_MFA') return { ok: false, error: 'no_pending_challenge' };
      return handle(await opts.client.submitMfaCode(pending.username, pending.session, code.replace(/\s+/g, '')));
    },

    async getToken() {
      if (tokens && tokens.expiresAt - now() > REFRESH_MARGIN_MS) return tokens.idToken;
      if (!inflight) inflight = doRefresh().finally(() => (inflight = null));
      return inflight;
    },

    async signOut() {
      generation++;
      tokens = null;
      refreshToken = null;
      pending = null;
      await clearStored();
      set({ status: 'signed_out' });
    },

    dispose() {
      generation++;
      tokens = null;
      refreshToken = null;
      pending = null;
      listeners.clear();
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
