import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCognitoClient, decodeJwtPayload, profileFromIdToken, staffAuthConfigFromEnv } from './cognito';
import { AUTH_DB_NAME, TRUST_STORAGE_KEY, createStaffSession, resetAuthDbHandle, type StaffSession } from './session';
import { deviceTrustStore } from '../transfer/deviceTrust';
import { openDB } from 'idb';

// ---------- helpers ----------

const b64u = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
/** Unsigned test JWT (the client never verifies signatures; the API does). */
const jwt = (claims: Record<string, unknown>) => `${b64u(JSON.stringify({ alg: 'RS256', kid: 'k' }))}.${b64u(JSON.stringify(claims))}.sig`;

const T0 = Date.UTC(2026, 10, 26, 10, 0, 0);
let clock = T0;
const now = () => clock;

const idToken = (sub: string, expSec: number, extra: Record<string, unknown> = {}) =>
  jwt({ sub, email: `${sub}@school.example`, 'custom:school_id': 'SCH-A', 'custom:district': 'DIST-1', 'cognito:groups': ['teacher'], token_use: 'id', exp: expSec, ...extra });

const authOk = (sub = 'u1', expSec = T0 / 1000 + 3600, refresh: string | undefined = 'rt-1') => ({
  AuthenticationResult: { IdToken: idToken(sub, expSec), AccessToken: 'at', ExpiresIn: 3600, TokenType: 'Bearer', ...(refresh ? { RefreshToken: refresh } : {}) },
  ChallengeParameters: {},
});

const awsError = (type: string, message = 'x') => new Response(JSON.stringify({ __type: type, message }), { status: 400, headers: { 'content-type': 'application/x-amz-json-1.1' } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const TRUST = {
  keys: [{ kid: 'issuer-1', issuer: 'School A', publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, notBefore: '2026-01-01', notAfter: '2027-12-31' }],
  revoked: [],
  asOf: '2026-11-26T10:00:00.000Z',
};

interface Call {
  url: string;
  target: string | null;
  contentType: string | null;
  auth: string | null;
  body: Record<string, any> | undefined;
}

/** Routes Cognito calls to `cognito(target, body)` and API calls to `api(path)`. */
function mockFetch(cognito: (target: string, body: Record<string, any>, n: number) => Response | Promise<Response>, api: (path: string) => Response = () => json(TRUST)) {
  const calls: Call[] = [];
  let n = 0;
  const f = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: String(url), target: h.get('x-amz-target'), contentType: h.get('content-type'), auth: h.get('authorization'), body });
    if (String(url).startsWith('https://cognito-idp.')) return cognito(h.get('x-amz-target')!.split('.')[1], body, ++n);
    return api(new URL(String(url)).pathname);
  }) as typeof fetch;
  return { f, calls };
}

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

function makeSession(teacherId: string, f: typeof fetch, storage: MemStorage | null = new MemStorage()): StaffSession {
  const client = createCognitoClient({ region: 'ap-south-1', clientId: 'client123', fetch: f });
  return createStaffSession({ teacherId, client, apiUrl: 'https://api.example.org/', fetch: f, now, storage });
}

async function storedRecord(teacherId: string) {
  await resetAuthDbHandle();
  const db = await openDB(AUTH_DB_NAME, 1, { upgrade: (d) => void d.createObjectStore('sessions', { keyPath: 'teacherId' }) });
  const rec = await db.get('sessions', teacherId);
  db.close();
  return rec;
}

beforeEach(async () => {
  clock = T0;
  await resetAuthDbHandle();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(AUTH_DB_NAME);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

// ---------- cognito client ----------

describe('cognito client', () => {
  it('sends USER_PASSWORD_AUTH to the regional endpoint with the JSON 1.1 headers and parses the ID token', async () => {
    const { f, calls } = mockFetch(() => json(authOk()));
    const c = createCognitoClient({ region: 'ap-south-1', clientId: 'client123', fetch: f });
    const r = await c.signIn('u1@school.example', 'Secret-password-1');
    expect(calls[0].url).toBe('https://cognito-idp.ap-south-1.amazonaws.com/');
    expect(calls[0].target).toBe('AWSCognitoIdentityProviderService.InitiateAuth');
    expect(calls[0].contentType).toBe('application/x-amz-json-1.1');
    expect(calls[0].auth).toBeNull(); // public client: unsigned
    expect(calls[0].body).toEqual({ ClientId: 'client123', AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: 'u1@school.example', PASSWORD: 'Secret-password-1' } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.session.profile).toEqual({ sub: 'u1', email: 'u1@school.example', schoolId: 'SCH-A', district: 'DIST-1', roles: ['teacher'] });
    expect(r.session.expiresAt).toBe(T0 + 3600_000);
    expect(r.session.refreshToken).toBe('rt-1');
  });

  it('maps Cognito error names, including namespaced __type and the x-amzn-errortype header', async () => {
    const replies = [
      awsError('NotAuthorizedException'),
      awsError('com.amazonaws.cognito#UserNotFoundException'),
      awsError('PasswordResetRequiredException'),
      awsError('TooManyRequestsException'),
      new Response('', { status: 400, headers: { 'x-amzn-errortype': 'UserNotConfirmedException:http://internal.amazon.com/' } }),
      awsError('SomethingNewException'),
    ];
    const { f } = mockFetch((_t, _b, n) => replies[n - 1]);
    const c = createCognitoClient({ region: 'r', clientId: 'c', fetch: f });
    const codes = [];
    for (let i = 0; i < replies.length; i++) {
      const r = await c.signIn('a', 'b');
      codes.push(!r.ok && 'error' in r ? r.error : 'ok');
    }
    expect(codes).toEqual(['not_authorized', 'user_not_found', 'password_reset_required', 'too_many_requests', 'user_not_confirmed', 'unknown']);
  });

  it('reports unsupported challenges instead of pretending to sign in', async () => {
    const { f } = mockFetch(() => json({ ChallengeName: 'MFA_SETUP', Session: 'sess', ChallengeParameters: {} }));
    const r = await createCognitoClient({ region: 'r', clientId: 'c', fetch: f }).signIn('a', 'b');
    expect(r).toMatchObject({ ok: false, error: 'unsupported_challenge' });
  });

  it('decodes base64url payloads with non-ASCII text and rejects malformed tokens', () => {
    const t = jwt({ sub: 's', email: 'शिक्षक@school.example', exp: 1 });
    expect(decodeJwtPayload(t)?.email).toBe('शिक्षक@school.example');
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(profileFromIdToken(jwt({ email: 'no-sub' }))).toBeNull();
  });

  it('config is off unless region, client id and API URL are all set', () => {
    expect(staffAuthConfigFromEnv({})).toBeNull();
    expect(staffAuthConfigFromEnv({ VITE_COGNITO_REGION: 'ap-south-1', VITE_COGNITO_CLIENT_ID: 'c', VITE_API_URL: '' })).toBeNull();
    expect(staffAuthConfigFromEnv({ VITE_COGNITO_REGION: 'ap-south-1', VITE_COGNITO_CLIENT_ID: 'c', VITE_API_URL: 'https://api' })).toEqual({ region: 'ap-south-1', clientId: 'c', apiUrl: 'https://api' });
  });
});

// ---------- session store ----------

describe('staff session', () => {
  it('signs in, keeps tokens in memory, stores only refresh token + profile, and fetches the trust list', async () => {
    const storage = new MemStorage();
    (globalThis as { localStorage?: unknown }).localStorage = storage; // deviceTrustStore() reads the global
    const { f, calls } = mockFetch(() => json(authOk()));
    const s = makeSession('TCH-1', f, storage);
    const seen: string[] = [];
    s.onChange((st) => seen.push(st.status));

    const out = await s.signIn(' u1@school.example ', 'pw');
    expect(out).toEqual({ ok: true, profile: expect.objectContaining({ sub: 'u1', schoolId: 'SCH-A' }) });
    expect(calls[0].body?.AuthParameters.USERNAME).toBe('u1@school.example');
    expect(await s.getToken()).toBe(idToken('u1', T0 / 1000 + 3600));
    expect(seen).toEqual(['signed_in']);

    const rec = await storedRecord('TCH-1');
    expect(Object.keys(rec).sort()).toEqual(['profile', 'refreshToken', 'savedAt', 'teacherId']);
    expect(rec.refreshToken).toBe('rt-1');
    expect(JSON.stringify(rec)).not.toContain('"at"');
    expect(JSON.stringify(rec)).not.toContain(idToken('u1', T0 / 1000 + 3600));

    const trustCall = calls.find((c) => c.url === 'https://api.example.org/trust')!;
    expect(trustCall.auth).toBe(`Bearer ${idToken('u1', T0 / 1000 + 3600)}`);
    expect(deviceTrustStore()).toEqual({ keys: TRUST.keys, revoked: [], revocationListAsOf: TRUST.asOf });
    expect(JSON.parse(storage.getItem(TRUST_STORAGE_KEY)!).keys[0].kid).toBe('issuer-1');
  });

  it('wrong password → not_authorized, nothing stored', async () => {
    const { f } = mockFetch(() => awsError('NotAuthorizedException', 'Incorrect username or password.'));
    const s = makeSession('TCH-1', f);
    expect(await s.signIn('u1@school.example', 'wrong')).toEqual({ ok: false, error: 'not_authorized' });
    expect(s.state().status).toBe('signed_out');
    expect(await s.getToken()).toBeNull();
    expect(await storedRecord('TCH-1')).toBeUndefined();
  });

  it('NEW_PASSWORD_REQUIRED: answers the challenge with USERNAME, NEW_PASSWORD and the session', async () => {
    const { f, calls } = mockFetch((target) =>
      target === 'InitiateAuth'
        ? json({ ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: 'S1', ChallengeParameters: { USER_ID_FOR_SRP: 'uuid-u1', requiredAttributes: '[]' } })
        : json(authOk()),
    );
    const s = makeSession('TCH-1', f);
    expect(await s.signIn('u1@school.example', 'Temp-pass-1')).toEqual({ ok: false, challenge: 'NEW_PASSWORD_REQUIRED' });
    expect(s.state().challenge).toBe('NEW_PASSWORD_REQUIRED');
    expect(await s.submitMfaCode('123456')).toEqual({ ok: false, error: 'no_pending_challenge' });
    const out = await s.completeNewPassword('A-much-longer-pass1');
    expect(out.ok).toBe(true);
    const resp = calls.find((c) => c.target === 'AWSCognitoIdentityProviderService.RespondToAuthChallenge')!;
    expect(resp.body).toEqual({ ClientId: 'client123', ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: 'S1', ChallengeResponses: { USERNAME: 'uuid-u1', NEW_PASSWORD: 'A-much-longer-pass1' } });
    expect(s.state()).toMatchObject({ status: 'signed_in' });
    expect(s.state().challenge).toBeUndefined();
  });

  it('SOFTWARE_TOKEN_MFA: wrong code can be retried, right code signs in', async () => {
    const { f, calls } = mockFetch((target, body) => {
      if (target === 'InitiateAuth') return json({ ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'S2', ChallengeParameters: {} });
      return body.ChallengeResponses.SOFTWARE_TOKEN_MFA_CODE === '654321' ? json(authOk()) : awsError('CodeMismatchException');
    });
    const s = makeSession('TCH-1', f);
    expect(await s.signIn('u1@school.example', 'pw')).toEqual({ ok: false, challenge: 'SOFTWARE_TOKEN_MFA' });
    expect(await s.submitMfaCode('111111')).toEqual({ ok: false, error: 'code_mismatch' });
    expect(await s.submitMfaCode('654 321')).toMatchObject({ ok: true });
    const last = calls.filter((c) => c.target?.endsWith('RespondToAuthChallenge')).at(-1)!;
    expect(last.body?.ChallengeResponses).toEqual({ USERNAME: 'u1@school.example', SOFTWARE_TOKEN_MFA_CODE: '654321' });
    expect(last.body?.Session).toBe('S2');
  });

  it('refreshes when the ID token expires within 60 s, keeping the old refresh token if none is returned', async () => {
    const { f, calls } = mockFetch((_t, body) =>
      body.AuthFlow === 'REFRESH_TOKEN_AUTH' ? json(authOk('u1', T0 / 1000 + 7200, undefined)) : json(authOk('u1', T0 / 1000 + 3600)),
    );
    const s = makeSession('TCH-1', f);
    await s.signIn('u1@school.example', 'pw');
    clock = T0 + 3600_000 - 61_000; // 61 s left: still fine
    expect(await s.getToken()).toBe(idToken('u1', T0 / 1000 + 3600));
    clock = T0 + 3600_000 - 30_000; // 30 s left: refresh
    const [a, b] = await Promise.all([s.getToken(), s.getToken()]);
    expect(a).toBe(idToken('u1', T0 / 1000 + 7200));
    expect(b).toBe(a);
    const refreshes = calls.filter((c) => c.body?.AuthFlow === 'REFRESH_TOKEN_AUTH');
    expect(refreshes).toHaveLength(1); // concurrent callers share one refresh
    expect(refreshes[0].body?.AuthParameters).toEqual({ REFRESH_TOKEN: 'rt-1' });
    expect((await storedRecord('TCH-1')).refreshToken).toBe('rt-1');
  });

  it('after an app restart, a stored refresh token gives a new ID token', async () => {
    const { f } = mockFetch((_t, body) => json(body.AuthFlow === 'REFRESH_TOKEN_AUTH' ? authOk('u1', T0 / 1000 + 3600, 'rt-2') : authOk()));
    await makeSession('TCH-1', f).signIn('u1@school.example', 'pw');
    const restarted = makeSession('TCH-1', f);
    expect((await restarted.load()).status).toBe('signed_in');
    expect(await restarted.getToken()).toBe(idToken('u1', T0 / 1000 + 3600));
    expect((await storedRecord('TCH-1')).refreshToken).toBe('rt-2'); // rotated token saved
  });

  it('refresh refused (NotAuthorized) → session cleared, getToken() null, state reauth_required', async () => {
    const { f } = mockFetch((_t, body) => (body.AuthFlow === 'REFRESH_TOKEN_AUTH' ? awsError('NotAuthorizedException', 'Refresh Token has expired') : json(authOk())));
    const s = makeSession('TCH-1', f);
    await s.signIn('u1@school.example', 'pw');
    clock = T0 + 3600_000;
    expect(await s.getToken()).toBeNull();
    expect(s.state().status).toBe('reauth_required');
    expect(await storedRecord('TCH-1')).toBeUndefined();
    expect(await s.getToken()).toBeNull(); // no further refresh attempts
  });

  it('refresh while offline → null but the refresh token is kept for later', async () => {
    let offline = false;
    const { f } = mockFetch(() => {
      if (offline) throw new TypeError('Failed to fetch');
      return json(authOk());
    });
    const s = makeSession('TCH-1', f);
    await s.signIn('u1@school.example', 'pw');
    offline = true;
    clock = T0 + 3600_000;
    expect(await s.getToken()).toBeNull();
    expect(s.state().status).toBe('signed_in');
    expect((await storedRecord('TCH-1')).refreshToken).toBe('rt-1');
  });

  it('two local teacher profiles on one phone never share a school session', async () => {
    const { f } = mockFetch((_t, body) => json(authOk(body.AuthParameters?.USERNAME === 'b@school.example' ? 'u2' : 'u1', T0 / 1000 + 3600, body.AuthParameters?.USERNAME === 'b@school.example' ? 'rt-B' : 'rt-A')));
    const a = makeSession('TCH-A', f);
    await a.signIn('a@school.example', 'pw');
    a.dispose(); // teacher switches

    const b = makeSession('TCH-B', f);
    expect((await b.load()).status).toBe('signed_out');
    expect(await b.getToken()).toBeNull();
    await b.signIn('b@school.example', 'pw');
    expect((await storedRecord('TCH-A')).refreshToken).toBe('rt-A');
    expect((await storedRecord('TCH-B')).refreshToken).toBe('rt-B');

    await b.signOut();
    expect(await storedRecord('TCH-B')).toBeUndefined();
    expect((await storedRecord('TCH-A')).refreshToken).toBe('rt-A'); // A's session untouched
    expect(await a.getToken()).toBeNull(); // disposed instance holds nothing
  });

  it('signOut clears memory and the stored refresh token', async () => {
    const { f } = mockFetch(() => json(authOk()));
    const s = makeSession('TCH-1', f);
    await s.signIn('u1@school.example', 'pw');
    const seen: string[] = [];
    s.onChange((st) => seen.push(st.status));
    await s.signOut();
    expect(await s.getToken()).toBeNull();
    expect(seen).toEqual(['signed_out']);
    expect(await storedRecord('TCH-1')).toBeUndefined();
    expect((await makeSession('TCH-1', f).load()).status).toBe('signed_out');
  });

  it('offline sign-in returns a clear error and does not throw', async () => {
    const { f } = mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const s = makeSession('TCH-1', f);
    await expect(s.signIn('u1@school.example', 'pw')).resolves.toEqual({ ok: false, error: 'network' });
    expect(s.state().status).toBe('signed_out');
  });

  it('sign-in still succeeds when the trust list is unavailable or invalid, and reports it', async () => {
    const storage = new MemStorage();
    const { f } = mockFetch(
      () => json(authOk()),
      () => json({ keys: [{ kid: 'k', issuer: 'X', publicJwk: { kty: 'EC', crv: 'P-256', d: 'secret' }, notBefore: '2026-01-01', notAfter: '2027-01-01' }], revoked: [], asOf: TRUST.asOf }),
    );
    const s = makeSession('TCH-1', f, storage);
    expect((await s.signIn('u1@school.example', 'pw')).ok).toBe(true);
    expect(s.state().trustError).toMatch(/publicJwk/);
    expect(storage.getItem(TRUST_STORAGE_KEY)).toBeNull();
  });
});
